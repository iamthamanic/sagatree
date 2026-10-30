/**
 * Host persistence facade — open DB, migrate, integrity (composition root only).
 * Location: server/src/persistence/index.ts
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openHostDatabase,
  foreignKeysEnabled,
  isSqliteBusyError,
  createHostDatabase,
  unwrapSqliteClient,
  isHostDatabase,
  type HostDatabase,
} from './open-database.ts';
import {
  runMigrations,
  listMigrationFiles,
  readMigrationFailure,
  readSchemaVersion,
  legacySchemaUpgradeLockPresent,
  clearLegacySchemaUpgradeLockAfterVerifiedStandstill,
  LEGACY_LOCK_PRESENT_ERROR,
  LEGACY_SCHEMA_UPGRADE_LOCK_FILE,
  type MigrateResult,
} from './migration-runner.ts';
import {
  runIntegrityCheck,
  type IntegrityCheckMode,
  type IntegrityResult,
} from './integrity-check.ts';
import { TABLE_OWNERSHIP, assertUniqueTableOwnership, owningModuleForTable } from './table-ownership.ts';
import { SQLITE_HOST_POLICY } from './sqlite-policy.ts';
import { hostSchema } from './schema/index.ts';

export {
  openHostDatabase,
  foreignKeysEnabled,
  isSqliteBusyError,
  createHostDatabase,
  unwrapSqliteClient,
  isHostDatabase,
  hostSchema,
  runMigrations,
  listMigrationFiles,
  readMigrationFailure,
  readSchemaVersion,
  legacySchemaUpgradeLockPresent,
  clearLegacySchemaUpgradeLockAfterVerifiedStandstill,
  LEGACY_LOCK_PRESENT_ERROR,
  LEGACY_SCHEMA_UPGRADE_LOCK_FILE,
  runIntegrityCheck,
  TABLE_OWNERSHIP,
  assertUniqueTableOwnership,
  owningModuleForTable,
  SQLITE_HOST_POLICY,
};
export type { HostDatabase, MigrateResult, IntegrityResult, IntegrityCheckMode };

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
  /** Intermediate migration boots may omit later owned tables. */
  integrityMode?: IntegrityCheckMode;
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

  const integrity = runIntegrityCheck(opened.db, options.integrityMode ?? 'full');
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
