/**
 * Host persistence facade — open DB, migrate, integrity (composition root only).
 * Location: server/src/persistence/index.ts
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openHostDatabase,
  foreignKeysEnabled,
  acquireSchemaUpgradeLock,
  tryRecoverStaleSchemaUpgradeLock,
  type HostDatabase,
} from './open-database.ts';
import {
  runMigrations,
  listMigrationFiles,
  readMigrationFailure,
  readSchemaVersion,
  type MigrateResult,
} from './migration-runner.ts';
import { runIntegrityCheck, type IntegrityResult } from './integrity-check.ts';
import { TABLE_OWNERSHIP, assertUniqueTableOwnership, owningModuleForTable } from './table-ownership.ts';
import { SQLITE_HOST_POLICY } from './sqlite-policy.ts';

export {
  openHostDatabase,
  foreignKeysEnabled,
  acquireSchemaUpgradeLock,
  tryRecoverStaleSchemaUpgradeLock,
  runMigrations,
  listMigrationFiles,
  readMigrationFailure,
  readSchemaVersion,
  runIntegrityCheck,
  TABLE_OWNERSHIP,
  assertUniqueTableOwnership,
  owningModuleForTable,
  SQLITE_HOST_POLICY,
};
export type { HostDatabase, MigrateResult, IntegrityResult };

const defaultMigrationsDir = join(fileURLToPath(new URL('../../migrations', import.meta.url)));

export type BootstrapPersistenceResult =
  | { ok: true; db: HostDatabase; schemaVersion: number }
  | { ok: false; error: string; failedStepId: string | null };

/**
 * Open host.sqlite under dataDir, apply catalog migrations, run integrity gate.
 */
export function bootstrapHostPersistence(options: {
  dataDir: string;
  migrationsDir?: string;
  dbFileName?: string;
}): BootstrapPersistenceResult {
  assertUniqueTableOwnership();
  const dbPath = join(options.dataDir, options.dbFileName ?? 'host.sqlite');
  const opened = openHostDatabase(dbPath);
  if (!opened.ok) {
    return { ok: false, error: opened.error, failedStepId: null };
  }

  const migrate = runMigrations({
    db: opened.db,
    dataDir: options.dataDir,
    migrationsDir: options.migrationsDir ?? defaultMigrationsDir,
  });

  if (!migrate.ok) {
    const failedStepId = migrate.failedStep?.id ?? readMigrationFailure(options.dataDir)?.id ?? null;
    try {
      opened.db.close();
    } catch {
      /* ignore */
    }
    return { ok: false, error: migrate.error, failedStepId };
  }

  const integrity = runIntegrityCheck(opened.db);
  if (!integrity.ok) {
    try {
      opened.db.close();
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: `integrity check failed: ${integrity.errors.join('; ')}`,
      failedStepId: null,
    };
  }

  if (!foreignKeysEnabled(opened.db)) {
    try {
      opened.db.close();
    } catch {
      /* ignore */
    }
    return { ok: false, error: 'foreign_keys not enabled after bootstrap', failedStepId: null };
  }

  return { ok: true, db: opened.db, schemaVersion: migrate.schemaVersion };
}
