/**
 * Atomic SQLite migration journal runner for the host catalog.
 * Location: server/src/persistence/migration-runner.ts
 *
 * Exclusive write authority for each migration step is SQLite BEGIN IMMEDIATE
 * (GATE-04 single-writer). Schema version is re-read inside the transaction so
 * concurrent hosts cannot double-apply. Legacy schema-upgrade.lock files are
 * ignored (not authoritative) and removed best-effort when present.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { HostDatabase } from './open-database.ts';
import { foreignKeysEnabled, isSqliteBusyError } from './open-database.ts';

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
const LEGACY_LOCK_FILE = 'schema-upgrade.lock';
const MIGRATION_FILE_RE = /^(\d{4})_(.+)\.sql$/;

function failurePath(dataDir: string): string {
  return join(dataDir, FAILURE_FILE);
}

/**
 * Pre-MIG-011 follow-up hosts may still have a file lock. It is not used for
 * exclusion anymore — remove best-effort so operators are not confused.
 * Failures to unlink are ignored (never fail-open into migration).
 */
export function discardLegacySchemaUpgradeLockFile(dataDir: string): void {
  const lockPath = join(dataDir, LEGACY_LOCK_FILE);
  if (!existsSync(lockPath)) return;
  try {
    unlinkSync(lockPath);
  } catch {
    /* ignore — leftover file is non-authoritative */
  }
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

  const seen = new Map<number, string>();
  for (const entry of entries) {
    const prior = seen.get(entry.version);
    if (prior) {
      throw new Error(
        `duplicate migration version ${String(entry.version).padStart(4, '0')}: ${prior} and ${entry.id}`,
      );
    }
    seen.set(entry.version, entry.id);
  }
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

function redact(message: string): string {
  return message.replace(/(?:token|key|secret|password)=[^\s]+/gi, '[redacted]');
}

/**
 * Apply pending SQL migrations atomically (DDL + journal row in one transaction).
 * Exclusive writer: BEGIN IMMEDIATE per step; version re-checked inside the TX.
 * On SQLITE_BUSY: fail-closed (no automatic retries — GATE-04).
 * On failure: transaction rolls back; failure sidecar records the same step for the next start.
 */
export function runMigrations(options: {
  db: HostDatabase;
  dataDir: string;
  migrationsDir: string;
}): MigrateResult {
  discardLegacySchemaUpgradeLockFile(options.dataDir);

  if (!foreignKeysEnabled(options.db)) {
    return {
      ok: false,
      error: 'foreign_keys pragma is not enabled',
      failedStep: readMigrationFailure(options.dataDir),
      schemaVersion: readSchemaVersion(options.db),
    };
  }

  let files: { version: number; id: string; path: string }[];
  try {
    files = listMigrationFiles(options.migrationsDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: message,
      failedStep: readMigrationFailure(options.dataDir),
      schemaVersion: readSchemaVersion(options.db),
    };
  }

  const applied: string[] = [];
  let schemaVersion = readSchemaVersion(options.db);

  for (const file of files) {
    if (file.version <= schemaVersion) continue;

    const sql = readFileSync(file.path, 'utf8');
    let inTx = false;
    try {
      options.db.exec('BEGIN IMMEDIATE');
      inTx = true;

      // Re-read under reserved lock — concurrent hosts may have applied already.
      const current = readSchemaVersion(options.db);
      if (file.version <= current) {
        options.db.exec('COMMIT');
        inTx = false;
        schemaVersion = current;
        continue;
      }

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
      inTx = false;
      applied.push(file.id);
      schemaVersion = file.version;
      clearMigrationFailure(options.dataDir);
    } catch (err) {
      if (inTx) {
        try {
          options.db.exec('ROLLBACK');
        } catch {
          /* ignore */
        }
      }

      if (isSqliteBusyError(err)) {
        return {
          ok: false,
          error: 'schema upgrade busy (another writer holds the database)',
          failedStep: readMigrationFailure(options.dataDir),
          schemaVersion: readSchemaVersion(options.db),
        };
      }

      const message = redact(err instanceof Error ? err.message : String(err));
      // Unique journal race: another writer committed the same version between
      // our version check and insert (should be rare with IMMEDIATE; still fail-closed
      // unless the version is now present).
      if (/UNIQUE|constraint/i.test(message)) {
        const after = readSchemaVersion(options.db);
        if (after >= file.version) {
          schemaVersion = after;
          continue;
        }
      }

      const failedStep: MigrationFailure = {
        id: file.id,
        version: file.version,
        message,
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
}
