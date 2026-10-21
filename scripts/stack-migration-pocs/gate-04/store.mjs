import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

// Isolated storage-semantics fixture, not a port of SagaTree's gameplay resolvers.
export const POLICY = Object.freeze({
  busyTimeoutMs: 250,
  maxStateBytes: 4096,
  maxKeyBytes: 128,
  journalMode: 'wal',
  synchronous: 'FULL',
  automaticDatabaseRetries: 0,
});

export const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
export const digest = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
export const failure = (code, details = {}) => ({ ok: false, error: { code, ...details } });

export function connect(path) {
  // PRAGMA rather than the newer constructor timeout option keeps the API at Node 22.13.
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA busy_timeout=${POLICY.busyTimeoutMs}; PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA wal_autocheckpoint=0;`);
  return db;
}

export function seed(path, sessions) {
  const db = connect(path);
  db.exec(`
    CREATE TABLE session_runtime (
      session_id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL CHECK(revision >= 0),
      state_json TEXT NOT NULL CHECK(json_valid(state_json) AND length(CAST(state_json AS BLOB)) <= ${POLICY.maxStateBytes}),
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE session_members (
      session_id TEXT NOT NULL REFERENCES session_runtime(session_id),
      actor_user_id TEXT NOT NULL,
      can_write INTEGER NOT NULL CHECK(can_write IN (0,1)),
      PRIMARY KEY(session_id, actor_user_id)
    ) STRICT;
    CREATE TABLE command_idempotency (
      session_id TEXT NOT NULL REFERENCES session_runtime(session_id),
      idempotency_key TEXT NOT NULL,
      actor_user_id TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      result_json TEXT NOT NULL CHECK(json_valid(result_json)),
      PRIMARY KEY(session_id, idempotency_key)
    ) STRICT;
    CREATE TABLE session_events (
      session_id TEXT NOT NULL REFERENCES session_runtime(session_id),
      event_sequence INTEGER NOT NULL,
      revision INTEGER NOT NULL,
      actor_user_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
      PRIMARY KEY(session_id, event_sequence),
      UNIQUE(session_id, revision),
      UNIQUE(session_id, idempotency_key)
    ) STRICT;
  `);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const session of sessions) {
      db.prepare('INSERT INTO session_runtime VALUES (?, 0, ?, ?)').run(session.id, canonical({ value: 0, applied: 0, note: '' }), '2026-10-21T00:00:00.000Z');
      for (const actor of session.writers ?? []) db.prepare('INSERT INTO session_members VALUES (?, ?, 1)').run(session.id, actor);
      for (const actor of session.readers ?? []) db.prepare('INSERT INTO session_members VALUES (?, ?, 0)').run(session.id, actor);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

const onlyKeys = (object, allowed) => object && !Array.isArray(object) && typeof object === 'object'
  && Object.keys(object).every((key) => allowed.includes(key));

export class CommandStore {
  constructor(path, tokens, { brokenSplitCommit = false } = {}) {
    this.db = connect(path);
    // The fixture's token-to-actor mapping is server-owned; command payloads cannot choose actor identity.
    this.tokens = tokens;
    this.brokenSplitCommit = brokenSplitCommit;
    this.stats = { transactionsBegun: 0, commits: 0, rollbacks: 0, replays: 0, rejectedBeforeTransaction: 0 };
  }

  auth(token, sessionId, write) {
    const actor = Object.hasOwn(this.tokens, token ?? '') ? this.tokens[token] : null;
    if (!actor) return { denied: failure('UNAUTHENTICATED') };
    const member = this.db.prepare('SELECT can_write FROM session_members WHERE session_id=? AND actor_user_id=?').get(sessionId, actor);
    // Deliberately the same error for missing sessions and missing memberships.
    if (!member || (write && member.can_write !== 1)) return { denied: failure('FORBIDDEN') };
    return { actor };
  }

  async apply(token, command, hook = async () => {}) {
    let inTransaction = false;
    const rejectEarly = (result) => { this.stats.rejectedBeforeTransaction++; return result; };
    const actor = Object.hasOwn(this.tokens, token ?? '') ? this.tokens[token] : null;
    if (!actor) return rejectEarly(failure('UNAUTHENTICATED'));
    if (!onlyKeys(command, ['sessionId', 'expectedRevision', 'idempotencyKey', 'op']) || typeof command.sessionId !== 'string') return rejectEarly(failure('INVALID_COMMAND'));
    const access = this.auth(token, command.sessionId, true);
    if (access.denied) return rejectEarly(access.denied);
    const { sessionId, expectedRevision, idempotencyKey, op } = command;
    if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || Buffer.byteLength(idempotencyKey) > POLICY.maxKeyBytes) return rejectEarly(failure('INVALID_IDEMPOTENCY_KEY'));
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) return rejectEarly(failure('INVALID_REVISION'));
    if (!onlyKeys(op, ['type', 'delta', 'note']) || op.type !== 'adjust' || !Number.isSafeInteger(op.delta) || Math.abs(op.delta) > 100 || (op.note !== undefined && typeof op.note !== 'string')) return rejectEarly(failure('INVALID_OPERATION'));
    const normalizedOp = { type: 'adjust', delta: op.delta, note: op.note ?? '' };
    if (Buffer.byteLength(normalizedOp.note) > POLICY.maxStateBytes) return rejectEarly(failure('STATE_TOO_LARGE'));
    // expectedRevision is concurrency metadata, not part of the logical operation fingerprint.
    const payloadHash = digest({ version: 1, op: normalizedOp });
    try {
      this.db.exec('BEGIN IMMEDIATE');
      inTransaction = true;
      this.stats.transactionsBegun++;
      await hook('after-begin');
      // Recheck inside the transaction, also before any stored-result lookup.
      const accessInTransaction = this.auth(token, sessionId, true);
      if (accessInTransaction.denied) {
        this.db.exec('ROLLBACK'); inTransaction = false; this.stats.rollbacks++;
        return accessInTransaction.denied;
      }
      const existing = this.db.prepare('SELECT actor_user_id, payload_hash, result_json FROM command_idempotency WHERE session_id=? AND idempotency_key=?').get(sessionId, idempotencyKey);
      if (existing) {
        this.db.exec('ROLLBACK'); inTransaction = false; this.stats.rollbacks++;
        if (existing.actor_user_id !== actor || existing.payload_hash !== payloadHash) return failure('IDEMPOTENCY_MISMATCH');
        this.stats.replays++;
        return { ok: true, resultJson: existing.result_json, committed: false };
      }
      const current = this.db.prepare('SELECT revision, state_json FROM session_runtime WHERE session_id=?').get(sessionId);
      if (current.revision !== expectedRevision) {
        this.db.exec('ROLLBACK'); inTransaction = false; this.stats.rollbacks++;
        return failure('STALE_REVISION', { expected: expectedRevision, actual: current.revision });
      }
      const previous = JSON.parse(current.state_json);
      const revision = current.revision + 1;
      const state = { value: previous.value + normalizedOp.delta, applied: previous.applied + 1, note: normalizedOp.note };
      const stateJson = canonical(state);
      if (!Number.isSafeInteger(state.value) || !Number.isSafeInteger(revision)) {
        this.db.exec('ROLLBACK'); inTransaction = false; this.stats.rollbacks++;
        return failure('NUMERIC_OVERFLOW');
      }
      if (Buffer.byteLength(stateJson) > POLICY.maxStateBytes) {
        this.db.exec('ROLLBACK'); inTransaction = false; this.stats.rollbacks++;
        return failure('STATE_TOO_LARGE');
      }
      const eventSequence = revision;
      const resultJson = canonical({ sessionId, revision, eventSequence, state });
      // A controlled clock keeps the fixture and crash equality checks reproducible.
      const updatedAt = new Date(Date.UTC(2026, 9, 21) + revision).toISOString();
      const update = this.db.prepare('UPDATE session_runtime SET revision=?, state_json=?, updated_at=? WHERE session_id=? AND revision=?').run(revision, stateJson, updatedAt, sessionId, expectedRevision);
      if (update.changes !== 1) throw new Error('guarded UPDATE did not modify exactly one row');
      await hook('after-state-write');
      if (this.brokenSplitCommit) {
        // Intentional negative control: durable state without event/idempotency must be detected after SIGKILL.
        this.db.exec('COMMIT'); inTransaction = false;
        await hook('canary-after-state-commit');
        this.db.exec('BEGIN IMMEDIATE'); inTransaction = true;
      }
      const payloadJson = canonical({ op: normalizedOp, stateHash: digest(stateJson) });
      this.db.prepare('INSERT INTO session_events VALUES (?, ?, ?, ?, ?, ?)').run(sessionId, eventSequence, revision, actor, idempotencyKey, payloadJson);
      await hook('after-event-write');
      this.db.prepare('INSERT INTO command_idempotency VALUES (?, ?, ?, ?, ?)').run(sessionId, idempotencyKey, actor, payloadHash, resultJson);
      await hook('before-commit');
      this.db.exec('COMMIT'); inTransaction = false; this.stats.commits++;
      await hook('after-commit');
      return { ok: true, resultJson, committed: true };
    } catch (error) {
      if (inTransaction) { this.db.exec('ROLLBACK'); this.stats.rollbacks++; }
      if (error.errcode === 5 || error.code === 'SQLITE_BUSY' || /database is locked/i.test(error.message)) return failure('DATABASE_BUSY');
      if (error.message === 'INJECTED_FAILURE') return failure('INJECTED_FAILURE');
      throw error;
    }
  }

  reconnect(token, sessionId, afterSequence = 0) {
    const access = this.auth(token, sessionId, false);
    if (access.denied) return access.denied;
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) return failure('INVALID_CURSOR');
    this.db.exec('BEGIN');
    try {
      const row = this.db.prepare('SELECT * FROM session_runtime WHERE session_id=?').get(sessionId);
      const events = this.db.prepare('SELECT * FROM session_events WHERE session_id=? AND event_sequence>? ORDER BY event_sequence').all(sessionId, afterSequence);
      this.db.exec('COMMIT');
      return { ok: true, snapshot: { sessionId, revision: row.revision, state: JSON.parse(row.state_json), updatedAt: row.updated_at }, events };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  close() { this.db.close(); }
}

// Read-only independent relational audit. No storage implementation helper reconstructs the expected ledger.
export function inspect(path, sessionId) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const runtime = db.prepare('SELECT * FROM session_runtime WHERE session_id=?').get(sessionId);
    const events = db.prepare('SELECT * FROM session_events WHERE session_id=? ORDER BY event_sequence').all(sessionId);
    const idempotency = db.prepare('SELECT * FROM command_idempotency WHERE session_id=? ORDER BY idempotency_key').all(sessionId);
    return JSON.parse(JSON.stringify({ runtime, events, idempotency, integrity: db.prepare('PRAGMA integrity_check').all(), foreignKeys: db.prepare('PRAGMA foreign_key_check').all() }));
  } finally { db.close(); }
}
