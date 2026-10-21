/**
 * Open host SQLite with GATE-04 PRAGMAs and foreign_keys=ON on every connection.
 * Location: server/src/persistence/open-database.ts
 */
import { DatabaseSync } from 'node:sqlite';
import { openSync, closeSync, unlinkSync, constants, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SQLITE_HOST_POLICY } from './sqlite-policy.ts';

export type HostDatabase = DatabaseSync;

export type OpenDatabaseResult =
  | { ok: true; db: HostDatabase }
  | { ok: false; error: string; code: 'OPEN' };

export type UpgradeLock =
  | { ok: true; release: () => void }
  | { ok: false; error: string; code: 'LOCK' };

function applyPragmas(db: HostDatabase): void {
  db.exec(`PRAGMA busy_timeout=${SQLITE_HOST_POLICY.busyTimeoutMs}`);
  db.exec('PRAGMA foreign_keys=ON');
  db.exec(`PRAGMA journal_mode=${SQLITE_HOST_POLICY.journalMode}`);
  db.exec(`PRAGMA synchronous=${SQLITE_HOST_POLICY.synchronous}`);
}

/**
 * Exclusive upgrade lock file prevents concurrent uncoordinated schema upgrades.
 */
export function acquireSchemaUpgradeLock(dataDir: string): UpgradeLock {
  const lockPath = join(dataDir, 'schema-upgrade.lock');
  try {
    const fd = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    let released = false;
    return {
      ok: true,
      release: () => {
        if (released) return;
        released = true;
        try {
          closeSync(fd);
        } catch {
          /* ignore */
        }
        try {
          if (existsSync(lockPath)) unlinkSync(lockPath);
        } catch {
          /* ignore */
        }
      },
    };
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
    if (code === 'EEXIST') {
      return { ok: false, error: 'schema upgrade already in progress (lock held)', code: 'LOCK' };
    }
    return { ok: false, error: 'failed to acquire schema upgrade lock', code: 'LOCK' };
  }
}

export function openHostDatabase(dbPath: string): OpenDatabaseResult {
  try {
    const db = new DatabaseSync(dbPath);
    applyPragmas(db);
    return { ok: true, db };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to open database';
    return {
      ok: false,
      error: message.replace(/(?:token|key|secret|password)=[^\s]+/gi, '[redacted]'),
      code: 'OPEN',
    };
  }
}

export function foreignKeysEnabled(db: HostDatabase): boolean {
  const row = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number } | undefined;
  return row?.foreign_keys === 1;
}
