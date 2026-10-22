/**
 * Open host SQLite with GATE-04 PRAGMAs and foreign_keys=ON on every connection.
 * Location: server/src/persistence/open-database.ts
 *
 * Schema-upgrade exclusivity lives in migration-runner via BEGIN IMMEDIATE
 * (no file/PID lock — avoids stale-metadata / PID-reuse / recovery races).
 */
import { DatabaseSync } from 'node:sqlite';
import { SQLITE_HOST_POLICY } from './sqlite-policy.ts';

export type HostDatabase = DatabaseSync;

export type OpenDatabaseResult =
  | { ok: true; db: HostDatabase }
  | { ok: false; error: string; code: 'OPEN' };

function applyPragmas(db: HostDatabase): void {
  db.exec(`PRAGMA busy_timeout=${SQLITE_HOST_POLICY.busyTimeoutMs}`);
  db.exec('PRAGMA foreign_keys=ON');
  db.exec(`PRAGMA journal_mode=${SQLITE_HOST_POLICY.journalMode}`);
  db.exec(`PRAGMA synchronous=${SQLITE_HOST_POLICY.synchronous}`);
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

/** True when SQLite refused a write lock (fail-closed; no automatic retries). */
export function isSqliteBusyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  const message = err instanceof Error ? err.message : String(err);
  return (
    code === 'ERR_SQLITE_ERROR' && /SQLITE_BUSY|database is locked|locked/i.test(message)
  ) || /SQLITE_BUSY|database is locked/i.test(message);
}
