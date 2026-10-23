/**
 * SQLite SessionRuntime store — atomic state/revision/event/idempotency (ADR-ST-08).
 * Location: server/src/modules/session/internal/session-runtime-store.ts
 *
 * Private to the session module. expectedRevision is concurrency metadata only.
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';
import { isSqliteBusyError } from '../../../persistence/open-database.ts';
import { canonicalJson, digest } from './canonical.ts';

export type SessionRuntimeState = {
  readonly value: number;
  readonly applied: number;
  readonly note: string;
};

export type SessionCommandOp = {
  readonly type: 'adjust';
  readonly delta: number;
  readonly note?: string;
};

export type ApplyCommandInput = {
  readonly sessionId: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly op: SessionCommandOp;
};

export type ApplyCommandSuccess = {
  readonly ok: true;
  readonly committed: boolean;
  readonly sessionId: string;
  readonly revision: number;
  readonly eventSequence: number;
  readonly state: SessionRuntimeState;
};

export type ApplyCommandFailure = {
  readonly ok: false;
  readonly error:
    | 'UNAUTHENTICATED'
    | 'FORBIDDEN'
    | 'INVALID_COMMAND'
    | 'INVALID_IDEMPOTENCY_KEY'
    | 'INVALID_REVISION'
    | 'INVALID_OPERATION'
    | 'STALE_REVISION'
    | 'IDEMPOTENCY_MISMATCH'
    | 'STATE_TOO_LARGE'
    | 'NUMERIC_OVERFLOW'
    | 'DATABASE_BUSY'
    | 'SESSION_NOT_FOUND';
  readonly expected?: number;
  readonly actual?: number;
};

export type ApplyCommandResult = ApplyCommandSuccess | ApplyCommandFailure;

export type SessionRuntimeStore = {
  readonly seedSession: (input: {
    readonly sessionId: string;
    readonly projectId: string;
    readonly writers: readonly string[];
    readonly readers?: readonly string[];
    readonly initialState?: SessionRuntimeState;
  }) => void;
  readonly applyCommand: (actorUserId: string, command: ApplyCommandInput) => ApplyCommandResult;
  readonly readSnapshot: (
    actorUserId: string,
    sessionId: string,
  ) =>
    | { ok: true; sessionId: string; projectId: string; revision: number; state: SessionRuntimeState; updatedAt: string }
    | { ok: false; error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'SESSION_NOT_FOUND' };
};

const MAX_KEY_BYTES = 512;
const MAX_STATE_BYTES = 65_536;

function failure(
  error: ApplyCommandFailure['error'],
  extra: { expected?: number; actual?: number } = {},
): ApplyCommandFailure {
  return { ok: false, error, ...extra };
}

function memberCanWrite(db: HostDatabase, sessionId: string, actorUserId: string): boolean | null {
  const row = db
    .prepare('SELECT can_write FROM session_members WHERE session_id = ? AND actor_user_id = ?')
    .get(sessionId, actorUserId) as { can_write: number } | undefined;
  if (!row) return null;
  return row.can_write === 1;
}

function memberExists(db: HostDatabase, sessionId: string, actorUserId: string): boolean {
  const row = db
    .prepare('SELECT 1 AS ok FROM session_members WHERE session_id = ? AND actor_user_id = ?')
    .get(sessionId, actorUserId) as { ok: number } | undefined;
  return Boolean(row);
}

export function createSessionRuntimeStore(db: HostDatabase): SessionRuntimeStore {
  return {
    seedSession(input) {
      const state = input.initialState ?? { value: 0, applied: 0, note: '' };
      const stateJson = canonicalJson(state);
      const updatedAt = new Date(0).toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(
          'INSERT INTO session_runtime (session_id, project_id, revision, state_json, updated_at) VALUES (?, ?, 0, ?, ?)',
        ).run(input.sessionId, input.projectId, stateJson, updatedAt);
        for (const writer of input.writers) {
          db.prepare(
            'INSERT INTO session_members (session_id, actor_user_id, can_write) VALUES (?, ?, 1)',
          ).run(input.sessionId, writer);
        }
        for (const reader of input.readers ?? []) {
          db.prepare(
            'INSERT INTO session_members (session_id, actor_user_id, can_write) VALUES (?, ?, 0)',
          ).run(input.sessionId, reader);
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    applyCommand(actorUserId, command): ApplyCommandResult {
      if (!actorUserId) return failure('UNAUTHENTICATED');
      if (!command || typeof command.sessionId !== 'string' || !command.sessionId.trim()) {
        return failure('INVALID_COMMAND');
      }
      const sessionId = command.sessionId.trim();
      const idempotencyKey =
        typeof command.idempotencyKey === 'string' ? command.idempotencyKey.trim() : '';
      if (!idempotencyKey || Buffer.byteLength(idempotencyKey) > MAX_KEY_BYTES) {
        return failure('INVALID_IDEMPOTENCY_KEY');
      }
      if (
        typeof command.expectedRevision !== 'number' ||
        !Number.isSafeInteger(command.expectedRevision) ||
        command.expectedRevision < 0
      ) {
        return failure('INVALID_REVISION');
      }
      const op = command.op;
      if (
        !op ||
        op.type !== 'adjust' ||
        !Number.isSafeInteger(op.delta) ||
        Math.abs(op.delta) > 10_000 ||
        (op.note !== undefined && typeof op.note !== 'string')
      ) {
        return failure('INVALID_OPERATION');
      }
      const normalizedOp: SessionCommandOp = {
        type: 'adjust',
        delta: op.delta,
        note: op.note ?? '',
      };
      // expectedRevision excluded from fingerprint (ADR-ST-08).
      const payloadHash = digest({ version: 1, op: normalizedOp });

      let inTransaction = false;
      try {
        db.exec('BEGIN IMMEDIATE');
        inTransaction = true;

        const writeAccess = memberCanWrite(db, sessionId, actorUserId);
        if (writeAccess === null) {
          db.exec('ROLLBACK');
          inTransaction = false;
          return failure('FORBIDDEN');
        }
        if (!writeAccess) {
          db.exec('ROLLBACK');
          inTransaction = false;
          return failure('FORBIDDEN');
        }

        const existing = db
          .prepare(
            'SELECT actor_user_id, payload_hash, result_json FROM command_idempotency WHERE session_id = ? AND idempotency_key = ?',
          )
          .get(sessionId, idempotencyKey) as
          | { actor_user_id: string; payload_hash: string; result_json: string }
          | undefined;

        if (existing) {
          db.exec('ROLLBACK');
          inTransaction = false;
          if (existing.actor_user_id !== actorUserId || existing.payload_hash !== payloadHash) {
            return failure('IDEMPOTENCY_MISMATCH');
          }
          const prior = JSON.parse(existing.result_json) as {
            sessionId: string;
            revision: number;
            eventSequence: number;
            state: SessionRuntimeState;
          };
          return {
            ok: true,
            committed: false,
            sessionId: prior.sessionId,
            revision: prior.revision,
            eventSequence: prior.eventSequence,
            state: prior.state,
          };
        }

        const current = db
          .prepare('SELECT revision, state_json FROM session_runtime WHERE session_id = ?')
          .get(sessionId) as { revision: number; state_json: string } | undefined;
        if (!current) {
          db.exec('ROLLBACK');
          inTransaction = false;
          return failure('SESSION_NOT_FOUND');
        }
        if (current.revision !== command.expectedRevision) {
          db.exec('ROLLBACK');
          inTransaction = false;
          return failure('STALE_REVISION', {
            expected: command.expectedRevision,
            actual: current.revision,
          });
        }

        const previous = JSON.parse(current.state_json) as SessionRuntimeState;
        const revision = current.revision + 1;
        const state: SessionRuntimeState = {
          value: previous.value + normalizedOp.delta,
          applied: previous.applied + 1,
          note: normalizedOp.note ?? '',
        };
        if (!Number.isSafeInteger(state.value) || !Number.isSafeInteger(revision)) {
          db.exec('ROLLBACK');
          inTransaction = false;
          return failure('NUMERIC_OVERFLOW');
        }
        const stateJson = canonicalJson(state);
        if (Buffer.byteLength(stateJson) > MAX_STATE_BYTES) {
          db.exec('ROLLBACK');
          inTransaction = false;
          return failure('STATE_TOO_LARGE');
        }

        const eventSequence = revision;
        const resultPayload = {
          sessionId,
          revision,
          eventSequence,
          state,
        };
        const resultJson = canonicalJson(resultPayload);
        const updatedAt = new Date().toISOString();

        const update = db
          .prepare(
            'UPDATE session_runtime SET revision = ?, state_json = ?, updated_at = ? WHERE session_id = ? AND revision = ?',
          )
          .run(revision, stateJson, updatedAt, sessionId, command.expectedRevision);
        if (update.changes !== 1) {
          throw new Error('guarded UPDATE did not modify exactly one row');
        }

        const payloadJson = canonicalJson({
          op: normalizedOp,
          stateHash: digest(stateJson),
        });
        db.prepare(
          'INSERT INTO session_events (session_id, event_sequence, revision, actor_user_id, idempotency_key, payload_json) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(sessionId, eventSequence, revision, actorUserId, idempotencyKey, payloadJson);

        db.prepare(
          'INSERT INTO command_idempotency (session_id, idempotency_key, actor_user_id, payload_hash, result_json) VALUES (?, ?, ?, ?, ?)',
        ).run(sessionId, idempotencyKey, actorUserId, payloadHash, resultJson);

        db.exec('COMMIT');
        inTransaction = false;

        return {
          ok: true,
          committed: true,
          sessionId,
          revision,
          eventSequence,
          state,
        };
      } catch (err) {
        if (inTransaction) {
          try {
            db.exec('ROLLBACK');
          } catch {
            /* ignore */
          }
        }
        if (isSqliteBusyError(err)) return failure('DATABASE_BUSY');
        throw err;
      }
    },

    readSnapshot(actorUserId, sessionId) {
      if (!actorUserId) return { ok: false, error: 'UNAUTHENTICATED' };
      if (!memberExists(db, sessionId, actorUserId)) {
        return { ok: false, error: 'FORBIDDEN' };
      }
      const row = db
        .prepare(
          'SELECT session_id, project_id, revision, state_json, updated_at FROM session_runtime WHERE session_id = ?',
        )
        .get(sessionId) as
        | {
            session_id: string;
            project_id: string;
            revision: number;
            state_json: string;
            updated_at: string;
          }
        | undefined;
      if (!row) return { ok: false, error: 'SESSION_NOT_FOUND' };
      return {
        ok: true,
        sessionId: row.session_id,
        projectId: row.project_id,
        revision: row.revision,
        state: JSON.parse(row.state_json) as SessionRuntimeState,
        updatedAt: row.updated_at,
      };
    },
  };
}
