/**
 * Binding SQLite writer policy for host persistence (GATE-04 / ADR-ST-08).
 * Location: server/src/persistence/sqlite-policy.ts
 */
export const SQLITE_HOST_POLICY = Object.freeze({
  journalMode: 'wal' as const,
  synchronous: 'FULL' as const,
  busyTimeoutMs: 250,
  foreignKeys: true,
  automaticDatabaseRetries: 0,
});
