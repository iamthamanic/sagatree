/**
 * HTTP transport canary use-case — typed command/query with revision + idempotency.
 * Location: server/src/application/transport/index.ts
 *
 * MIG-020 proof surface only. Full SessionRuntimeState persistence is MIG-022.
 * Pipeline order (binding): validate → authorize → execute.
 *
 * Idempotency (ADR-ST-08): key is session-scoped; stored actor is binding;
 * expectedRevision is replay metadata only (not part of operation fingerprint).
 */
import { createHash } from 'node:crypto';
import type { Actor } from '../../modules/identity/index.ts';
import type { PermissionsPorts } from '../../modules/permissions/index.ts';
import { projectSessionSnapshot, type ProjectionActor } from '../../projections/index.ts';

/** Documented pipeline steps for HTTP command/query handling. */
export const TRANSPORT_PIPELINE = ['validate', 'authorize', 'execute'] as const;
export type TransportPipelineStep = (typeof TRANSPORT_PIPELINE)[number];

export type TransportCommandInput = {
  readonly sessionId: string;
  readonly projectId: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
  readonly note?: string;
};

export type TransportSnapshotInput = {
  readonly sessionId: string;
  readonly projectId: string;
};

export type TransportProjection = {
  readonly sessionId: string;
  readonly revision: number;
  readonly value: number;
  readonly updatedAt: string;
  /** GM-only field — omitted from player projections. */
  readonly gmNotes?: string;
  readonly role: 'gm' | 'player';
};

export type TransportCommandSuccess = {
  readonly ok: true;
  readonly pipeline: readonly TransportPipelineStep[];
  readonly projection: TransportProjection;
  readonly idempotentReplay: boolean;
};

export type TransportErrorCode =
  | 'INVALID_PAYLOAD'
  | 'FORBIDDEN'
  | 'STALE_REVISION'
  | 'IDEMPOTENCY_CONFLICT'
  | 'SESSION_MISMATCH'
  | 'HOST_SHUTTING_DOWN';

export type TransportFailure = {
  readonly ok: false;
  readonly error: TransportErrorCode;
  /** Policy deny reason when applicable (no secrets). */
  readonly reason?: string;
};

export type TransportResult = TransportCommandSuccess | TransportFailure;

type SessionRecord = {
  sessionId: string;
  projectId: string;
  revision: number;
  value: number;
  gmNotes: string;
  updatedAt: string;
};

type IdempotencyRecord = {
  actorId: string;
  sessionId: string;
  key: string;
  payloadHash: string;
  result: TransportCommandSuccess;
};

export type TransportUseCase = {
  readonly applyCommand: (actor: Actor, input: unknown) => TransportResult;
  readonly getSnapshot: (actor: Actor, input: unknown) => TransportResult;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
}

function parseCommandInput(raw: unknown): TransportCommandInput | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (!isNonEmptyString(record.sessionId)) return null;
  if (!isNonEmptyString(record.projectId)) return null;
  if (!isNonEmptyString(record.idempotencyKey)) return null;
  const expectedRevision = record.expectedRevision;
  if (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 0) {
    return null;
  }
  if (record.note !== undefined && typeof record.note !== 'string') return null;
  if (typeof record.note === 'string' && record.note.length > 256) return null;
  // Client-claimed role/owner fields are never accepted as authority.
  return {
    sessionId: record.sessionId.trim(),
    projectId: record.projectId.trim(),
    expectedRevision,
    idempotencyKey: record.idempotencyKey.trim(),
    note: typeof record.note === 'string' ? record.note : undefined,
  };
}

function parseSnapshotInput(raw: unknown): TransportSnapshotInput | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (!isNonEmptyString(record.sessionId)) return null;
  if (!isNonEmptyString(record.projectId)) return null;
  return {
    sessionId: record.sessionId.trim(),
    projectId: record.projectId.trim(),
  };
}

/**
 * Canonical operation fingerprint — excludes expectedRevision (ADR-ST-08 replay metadata).
 */
function payloadHash(input: TransportCommandInput): string {
  const canonical = JSON.stringify({
    sessionId: input.sessionId,
    projectId: input.projectId,
    note: input.note ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/** Session-scoped idempotency map key (not actor-scoped). */
function idempotencyMapKey(sessionId: string, idempotencyKey: string): string {
  return `${sessionId}:${idempotencyKey}`;
}

/**
 * Serialize via unified role projections (MIG-024). Client filters are not auth —
 * gmNotes / secret keys are stripped before the HTTP response leaves the host.
 */
function projectFor(
  state: SessionRecord,
  role: 'gm' | 'player',
): TransportProjection {
  const actor: ProjectionActor = { actorId: role, role };
  const projected = projectSessionSnapshot(
    {
      revision: state.revision,
      objects: [],
      shared: {
        sessionId: state.sessionId,
        value: state.value,
        updatedAt: state.updatedAt,
        role,
        gmNotes: state.gmNotes,
      },
      events: [],
    },
    actor,
  );
  const shared = projected.shared;
  const out: TransportProjection = {
    sessionId: String(shared.sessionId ?? state.sessionId),
    revision: projected.revision,
    value: typeof shared.value === 'number' ? shared.value : state.value,
    updatedAt: String(shared.updatedAt ?? state.updatedAt),
    role,
  };
  if (typeof shared.gmNotes === 'string') {
    return { ...out, gmNotes: shared.gmNotes };
  }
  return out;
}

export function createTransportUseCase(deps: {
  readonly permissions: PermissionsPorts;
  readonly acceptMutations: () => boolean;
}): TransportUseCase {
  const sessions = new Map<string, SessionRecord>();
  const idempotency = new Map<string, IdempotencyRecord>();

  /**
   * Mutation path only: create session bound to the authorized project, or
   * return existing. Never rebinds projectId on an existing session.
   */
  function ensureSessionForCommand(
    sessionId: string,
    projectId: string,
  ): SessionRecord | { mismatch: true } {
    const existing = sessions.get(sessionId);
    if (existing) {
      if (existing.projectId !== projectId) return { mismatch: true };
      return existing;
    }
    const created: SessionRecord = {
      sessionId,
      projectId,
      revision: 0,
      value: 0,
      gmNotes: '',
      updatedAt: new Date(0).toISOString(),
    };
    sessions.set(sessionId, created);
    return created;
  }

  /** Read path: never invent session→project from client IDs. */
  function lookupSession(sessionId: string): SessionRecord | null {
    return sessions.get(sessionId) ?? null;
  }

  return {
    applyCommand(actor, raw): TransportResult {
      // 1. validate
      const input = parseCommandInput(raw);
      if (!input) return { ok: false, error: 'INVALID_PAYLOAD' };

      if (!deps.acceptMutations()) {
        return { ok: false, error: 'HOST_SHUTTING_DOWN' };
      }

      // 2. authorize (Policy Service — before any mutation)
      const decision = deps.permissions.authorize('session.gm', actor, {
        projectId: input.projectId,
      });
      if (!decision.allow) {
        return { ok: false, error: 'FORBIDDEN', reason: decision.reason };
      }

      const stateOrMismatch = ensureSessionForCommand(input.sessionId, input.projectId);
      if ('mismatch' in stateOrMismatch) {
        return { ok: false, error: 'SESSION_MISMATCH' };
      }
      const state = stateOrMismatch;

      // Session-scoped key; original actor stored for binding checks.
      const idKey = idempotencyMapKey(input.sessionId, input.idempotencyKey);
      const hash = payloadHash(input);
      const prior = idempotency.get(idKey);
      if (prior) {
        if (prior.actorId !== actor.actorId || prior.payloadHash !== hash) {
          return { ok: false, error: 'IDEMPOTENCY_CONFLICT' };
        }
        return { ...prior.result, idempotentReplay: true };
      }

      if (input.expectedRevision !== state.revision) {
        return { ok: false, error: 'STALE_REVISION' };
      }

      // 3. execute — single mutation commit
      state.revision += 1;
      state.value += 1;
      if (input.note !== undefined) state.gmNotes = input.note;
      state.updatedAt = new Date().toISOString();

      const success: TransportCommandSuccess = {
        ok: true,
        pipeline: TRANSPORT_PIPELINE,
        projection: projectFor(state, 'gm'),
        idempotentReplay: false,
      };
      idempotency.set(idKey, {
        actorId: actor.actorId,
        sessionId: input.sessionId,
        key: input.idempotencyKey,
        payloadHash: hash,
        result: success,
      });
      return success;
    },

    getSnapshot(actor, raw): TransportResult {
      const input = parseSnapshotInput(raw);
      if (!input) return { ok: false, error: 'INVALID_PAYLOAD' };

      // Authoritative association only — never create on read.
      const state = lookupSession(input.sessionId);
      if (!state) {
        return { ok: false, error: 'FORBIDDEN', reason: 'session-not-found' };
      }
      if (state.projectId !== input.projectId) {
        return { ok: false, error: 'SESSION_MISMATCH' };
      }

      const gmDecision = deps.permissions.authorize('session.gm', actor, {
        projectId: state.projectId,
      });
      const playerDecision = deps.permissions.authorize('player.project.read', actor, {
        projectId: state.projectId,
      });
      if (!gmDecision.allow && !playerDecision.allow) {
        return {
          ok: false,
          error: 'FORBIDDEN',
          reason: playerDecision.reason || gmDecision.reason,
        };
      }
      const role: 'gm' | 'player' = gmDecision.allow ? 'gm' : 'player';

      return {
        ok: true,
        pipeline: TRANSPORT_PIPELINE,
        projection: projectFor(state, role),
        idempotentReplay: false,
      };
    },
  };
}
