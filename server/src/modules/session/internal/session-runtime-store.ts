/**
 * SQLite SessionRuntime store — atomic state/revision/event/idempotency (ADR-ST-08).
 * Location: server/src/modules/session/internal/session-runtime-store.ts
 *
 * Persists the shared domain `SessionRuntimeState` contract (status/roster/gameplay).
 * Commands use domain `SessionEventKind` + payload (same shape as the legacy RPC port).
 * expectedRevision is concurrency metadata only — not part of the operation fingerprint.
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';
import { isSqliteBusyError } from '../../../persistence/open-database.ts';
import {
  assertPlaySessionStatusTransition,
  assertSessionEventKind,
  emptyGameplayState,
  normalizePlaySessionStatus,
  type PlaySessionStatus,
  type SessionEventKind,
  type SessionGameplayState,
  type SessionPresenceEntry,
  type SessionRuntimeState,
} from './session-runtime-domain.ts';
import { canonicalJson, digest } from './canonical.ts';

export type { SessionRuntimeState };

export type SessionCommandOp = {
  readonly kind: SessionEventKind | string;
  readonly payload?: Record<string, unknown>;
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
  readonly snapshot: SessionRuntimeState;
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
    readonly initial?: Partial<Pick<SessionRuntimeState, 'status' | 'roster' | 'gameplay'>>;
  }) => void;
  readonly applyCommand: (actorUserId: string, command: ApplyCommandInput) => ApplyCommandResult;
  readonly readSnapshot: (
    actorUserId: string,
    sessionId: string,
  ) =>
    | { ok: true; snapshot: SessionRuntimeState; projectId: string }
    | { ok: false; error: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'SESSION_NOT_FOUND' };
};

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

function emptySnapshot(sessionId: string): SessionRuntimeState {
  return {
    sessionId,
    revision: 0,
    status: 'waiting',
    roster: [],
    gameplay: emptyGameplayState(),
    updatedAt: new Date(0).toISOString(),
  };
}

function mergePresence(
  roster: readonly SessionPresenceEntry[],
  entry: SessionPresenceEntry,
): SessionPresenceEntry[] {
  const without = roster.filter((row) => row.userId !== entry.userId);
  return [...without, entry];
}

function applyOp(
  previous: SessionRuntimeState,
  kind: SessionEventKind,
  payload: Record<string, unknown>,
  updatedAt: string,
): SessionRuntimeState {
  if (kind === 'status') {
    const nextStatus = normalizePlaySessionStatus(String(payload.status ?? ''));
    assertPlaySessionStatusTransition(previous.status, nextStatus);
    return { ...previous, status: nextStatus, updatedAt };
  }
  if (kind === 'presence') {
    const userId = typeof payload.userId === 'string' ? payload.userId : '';
    if (!userId) throw new Error('INVALID_OPERATION');
    const entry: SessionPresenceEntry = {
      userId,
      characterId: typeof payload.characterId === 'string' ? payload.characterId : null,
      isOnline: payload.isOnline === true,
      joinedAt:
        typeof payload.joinedAt === 'string' && payload.joinedAt
          ? payload.joinedAt
          : updatedAt,
    };
    return { ...previous, roster: mergePresence(previous.roster, entry), updatedAt };
  }
  if (kind === 'gameplay' || kind === 'scene' || kind === 'combat') {
    const gameplay: SessionGameplayState = {
      sceneId:
        typeof payload.sceneId === 'string'
          ? payload.sceneId
          : previous.gameplay.sceneId,
      combatActive:
        typeof payload.combatActive === 'boolean'
          ? payload.combatActive
          : previous.gameplay.combatActive,
      shared:
        payload.shared && typeof payload.shared === 'object' && !Array.isArray(payload.shared)
          ? { ...previous.gameplay.shared, ...(payload.shared as Record<string, unknown>) }
          : previous.gameplay.shared,
    };
    return { ...previous, gameplay, updatedAt };
  }
  // Other event kinds append as no-op state mutation (audit via session_events) for CAS proof.
  return { ...previous, updatedAt };
}

export function createSessionRuntimeStore(db: HostDatabase): SessionRuntimeStore {
  return {
    seedSession(input) {
      const base = emptySnapshot(input.sessionId);
      const snapshot: SessionRuntimeState = {
        ...base,
        status: (input.initial?.status as PlaySessionStatus | undefined) ?? base.status,
        roster: input.initial?.roster ?? base.roster,
        gameplay: input.initial?.gameplay ?? base.gameplay,
      };
      const body = {
        status: snapshot.status,
        roster: snapshot.roster,
        gameplay: snapshot.gameplay,
      };
      const stateJson = canonicalJson(body);
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(
          'INSERT INTO session_runtime (session_id, project_id, revision, state_json, updated_at) VALUES (?, ?, 0, ?, ?)',
        ).run(input.sessionId, input.projectId, stateJson, snapshot.updatedAt);
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
      // Non-empty key required (ADR-ST-08). No product-wide byte cap (capacity deferred to MIG-700).
      if (!idempotencyKey) return failure('INVALID_IDEMPOTENCY_KEY');
      if (
        typeof command.expectedRevision !== 'number' ||
        !Number.isSafeInteger(command.expectedRevision) ||
        command.expectedRevision < 0
      ) {
        return failure('INVALID_REVISION');
      }

      let kind: SessionEventKind;
      try {
        kind = assertSessionEventKind(String(command.op?.kind ?? ''));
      } catch {
        return failure('INVALID_OPERATION');
      }
      const payload =
        command.op?.payload && typeof command.op.payload === 'object' && !Array.isArray(command.op.payload)
          ? command.op.payload
          : {};

      // expectedRevision excluded from fingerprint (ADR-ST-08).
      const payloadHash = digest({ version: 1, kind, payload });

      let inTransaction = false;
      try {
        db.exec('BEGIN IMMEDIATE');
        inTransaction = true;

        const writeAccess = memberCanWrite(db, sessionId, actorUserId);
        if (writeAccess === null || !writeAccess) {
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
          const prior = JSON.parse(existing.result_json) as SessionRuntimeState;
          return { ok: true, committed: false, snapshot: prior };
        }

        const current = db
          .prepare(
            'SELECT revision, state_json, updated_at FROM session_runtime WHERE session_id = ?',
          )
          .get(sessionId) as
          | { revision: number; state_json: string; updated_at: string }
          | undefined;
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

        const body = JSON.parse(current.state_json) as {
          status: PlaySessionStatus;
          roster: SessionPresenceEntry[];
          gameplay: SessionGameplayState;
        };
        const previous: SessionRuntimeState = {
          sessionId,
          revision: current.revision,
          status: body.status,
          roster: body.roster,
          gameplay: body.gameplay,
          updatedAt: current.updated_at,
        };

        const updatedAt = new Date().toISOString();
        let next: SessionRuntimeState;
        try {
          next = applyOp(previous, kind, payload, updatedAt);
        } catch {
          db.exec('ROLLBACK');
          inTransaction = false;
          return failure('INVALID_OPERATION');
        }
        next = { ...next, revision: current.revision + 1, updatedAt };

        const stateJson = canonicalJson({
          status: next.status,
          roster: next.roster,
          gameplay: next.gameplay,
        });
        const resultJson = canonicalJson(next);
        const eventSequence = next.revision;

        const update = db
          .prepare(
            'UPDATE session_runtime SET revision = ?, state_json = ?, updated_at = ? WHERE session_id = ? AND revision = ?',
          )
          .run(next.revision, stateJson, updatedAt, sessionId, command.expectedRevision);
        if (update.changes !== 1) {
          throw new Error('guarded UPDATE did not modify exactly one row');
        }

        db.prepare(
          'INSERT INTO session_events (session_id, event_sequence, revision, actor_user_id, idempotency_key, payload_json) VALUES (?, ?, ?, ?, ?, ?)',
        ).run(
          sessionId,
          eventSequence,
          next.revision,
          actorUserId,
          idempotencyKey,
          canonicalJson({ kind, payload, stateHash: digest(stateJson) }),
        );

        db.prepare(
          'INSERT INTO command_idempotency (session_id, idempotency_key, actor_user_id, payload_hash, result_json) VALUES (?, ?, ?, ?, ?)',
        ).run(sessionId, idempotencyKey, actorUserId, payloadHash, resultJson);

        db.exec('COMMIT');
        inTransaction = false;
        return { ok: true, committed: true, snapshot: next };
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
      const body = JSON.parse(row.state_json) as {
        status: PlaySessionStatus;
        roster: SessionPresenceEntry[];
        gameplay: SessionGameplayState;
      };
      return {
        ok: true,
        projectId: row.project_id,
        snapshot: {
          sessionId: row.session_id,
          revision: row.revision,
          status: body.status,
          roster: body.roster,
          gameplay: body.gameplay,
          updatedAt: row.updated_at,
        },
      };
    },
  };
}
