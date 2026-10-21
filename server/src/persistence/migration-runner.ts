/**
 * Atomic SQLite migration journal runner for the host catalog.
 * Location: server/src/persistence/migration-runner.ts
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { HostDatabase } from './open-database.ts';
import { acquireSchemaUpgradeLock, foreignKeysEnabled } from './open-database.ts';

export type MigrationFailure = {
  readonly id: string;
  readonly version: number;
  readonly message: string;
  readonly at: string;
};

export type MigrateResult =
  | { ok: true; schemaVersion: number; applied: readonly string[] }
  | { ok: false; error: string; failedStep: MigrationFailure | null; schemaVersion: number };

const FAILURE_FILE = 'migration-failure.json';
const MIGRATION_FILE_RE = /^(\d{4})_(.+)\.sql$/;

function failurePath(dataDir: string): string {
  return join(dataDir, FAILURE_FILE);
}

export function readMigrationFailure(dataDir: string): MigrationFailure | null {
  const path = failurePath(dataDir);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (
      raw &&
      typeof raw === 'object' &&
      typeof (raw as MigrationFailure).id === 'string' &&
      typeof (raw as MigrationFailure).version === 'number' &&
      typeof (raw as MigrationFailure).message === 'string' &&
      typeof (raw as MigrationFailure).at === 'string'
    ) {
      return raw as MigrationFailure;
    }
    return null;
  } catch {
    return null;
  }
}

function writeMigrationFailure(dataDir: string, failure: MigrationFailure): void {
  writeFileSync(failurePath(dataDir), `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
}

function clearMigrationFailure(dataDir: string): void {
  const path = failurePath(dataDir);
  if (existsSync(path)) unlinkSync(path);
}

export function listMigrationFiles(migrationsDir: string): { version: number; id: string; path: string }[] {
  const entries = readdirSync(migrationsDir)
    .map((name) => {
      const match = MIGRATION_FILE_RE.exec(name);
      if (!match) return null;
      return {
        version: Number(match[1]),
        id: `${match[1]}_${match[2]}`,
        path: join(migrationsDir, name),
      };
    })
    .filter((entry): entry is { version: number; id: string; path: string } => entry !== null)
    .sort((a, b) => a.version - b.version || a.id.localeCompare(b.id));
  return entries;
}

export function readSchemaVersion(db: HostDatabase): number {
  const table = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'`)
    .get() as { name: string } | undefined;
  if (!table) return 0;
  const row = db.prepare(`SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations`).get() as
    | { version: number }
    | undefined;
  return row?.version ?? 0;
}

/**
 * Apply pending SQL migrations atomically (DDL + journal row in one transaction).
 * On failure: transaction rolls back; failure sidecar records the same step for the next start.
 */
export function runMigrations(options: {
  db: HostDatabase;
  dataDir: string;
  migrationsDir: string;
}): MigrateResult {
  const lock = acquireSchemaUpgradeLock(options.dataDir);
  if (!lock.ok) {
    return {
      ok: false,
      error: lock.error,
      failedStep: readMigrationFailure(options.dataDir),
      schemaVersion: readSchemaVersion(options.db),
    };
  }

  try {
    if (!foreignKeysEnabled(options.db)) {
      return {
        ok: false,
        error: 'foreign_keys pragma is not enabled',
        failedStep: readMigrationFailure(options.dataDir),
        schemaVersion: readSchemaVersion(options.db),
      };
    }

    const files = listMigrationFiles(options.migrationsDir);
    const applied: string[] = [];
    let schemaVersion = readSchemaVersion(options.db);

    for (const file of files) {
      if (file.version <= schemaVersion) continue;

      const sql = readFileSync(file.path, 'utf8');
      try {
        options.db.exec('BEGIN IMMEDIATE');
        options.db.exec(sql);
        // Ensure journal exists even if migration SQL forgot CREATE (idempotent).
        options.db.exec(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER NOT NULL PRIMARY KEY,
            id TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL
          ) STRICT;
        `);
        const insert = options.db.prepare(
          `INSERT INTO schema_migrations (version, id, applied_at) VALUES (?, ?, ?)`,
        );
        insert.run(file.version, file.id, new Date().toISOString());
        options.db.exec('COMMIT');
        applied.push(file.id);
        schemaVersion = file.version;
        clearMigrationFailure(options.dataDir);
      } catch (err) {
        try {
          options.db.exec('ROLLBACK');
        } catch {
          /* ignore */
        }
        const message = err instanceof Error ? err.message : String(err);
        const redacted = message.replace(/(?:token|key|secret|password)=[^\s]+/gi, '[redacted]');
        const failedStep: MigrationFailure = {
          id: file.id,
          version: file.version,
          message: redacted,
          at: new Date().toISOString(),
        };
        writeMigrationFailure(options.dataDir, failedStep);
        return {
          ok: false,
          error: `migration failed: ${file.id}`,
          failedStep,
          schemaVersion: readSchemaVersion(options.db),
        };
      }
    }

    return { ok: true, schemaVersion, applied };
  } finally {
    lock.release();
  }
}
