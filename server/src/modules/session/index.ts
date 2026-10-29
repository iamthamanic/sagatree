/**
 * session module public API — SessionRuntimeState + lifecycle (#867/#868).
 * Location: server/src/modules/session/index.ts
 */
import type { Actor } from '../identity/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import type { ProjectPorts } from '../project/index.ts';
import {
  createSessionRuntimeStore,
  type ApplyCommandInput,
  type ApplyCommandResult,
  type SessionCommittedPublisher,
  type SessionRuntimeState,
  type SessionRuntimeStore,
} from './internal/session-runtime-store.ts';
import {
  createSessionInviteStore,
  type SessionInviteStore,
} from './internal/session-invite-store.ts';
import {
  SessionLifecycleStore,
  appendSessionEventIsExported,
  type PlaySessionRow,
} from './internal/session-lifecycle-store.ts';
import {
  SessionAccessStore,
  type InviteCreateResult,
  type InviteResolveFail,
  type InviteResolveOk,
} from './internal/session-access-store.ts';
import {
  SessionRecapStore,
  type RecapOk,
  type RecapError,
} from './internal/session-recap-store.ts';
import {
  SessionOutcomeStore,
  type SessionPromoteLookup,
} from './internal/session-outcome-store.ts';

export type { SessionPromoteLookup } from './internal/session-outcome-store.ts';
export { SessionOutcomeStore } from './internal/session-outcome-store.ts';

export type {
  ApplyCommandInput,
  ApplyCommandResult,
  SessionCommandOp,
  SessionCommittedPublication,
  SessionCommittedPublisher,
  SessionRuntimeState,
  SessionRuntimeStore,
} from './internal/session-runtime-store.ts';

export type {
  InviteErrorCode,
  InviteResult,
  ProjectMemberRow,
  SessionInviteStore,
} from './internal/session-invite-store.ts';

export type { PlaySessionRow } from './internal/session-lifecycle-store.ts';
export type {
  InviteCreateResult,
  InviteResolveFail,
  InviteResolveOk,
} from './internal/session-access-store.ts';
export type {
  RecapDto,
  RecapError,
  RecapHighlightLine,
  RecapOk,
} from './internal/session-recap-store.ts';
export { appendSessionEventIsExported };
export { buildRecapHighlightLines } from './internal/session-recap-store.ts';

export type SessionCommandPort = {
  readonly apply: (actor: Actor, command: ApplyCommandInput) => ApplyCommandResult;
};

export type SessionQueryPort = {
  readonly getSnapshot: (
    actor: Actor,
    sessionId: string,
  ) =>
    | { readonly ok: true; readonly snapshot: SessionRuntimeState; readonly projectId: string }
    | { readonly ok: false; readonly error: string };
};

export type LifecycleResult =
  | { readonly ok: true; readonly value: PlaySessionRow }
  | { readonly ok: false; readonly error: string };

export type SessionLifecyclePort = {
  readonly createPlaySession: (
    actor: Actor,
    projectId: string,
    name?: string | null,
  ) => LifecycleResult;
  readonly createProjectSession: (
    actor: Actor,
    projectId: string,
    name?: string | null,
    notes?: string | null,
  ) => LifecycleResult;
  readonly setSessionStatus: (
    actor: Actor,
    sessionId: string,
    status: string,
  ) => LifecycleResult;
};

export type AccessLeaveResult =
  | { readonly ok: true; readonly value: { readonly left: boolean; readonly runtimeRevision: number } }
  | { readonly ok: false; readonly error: string };

export type SessionAccessPort = {
  readonly joinSessionByCode: (
    actor: Actor,
    code: string,
    characterId?: string | null,
  ) => LifecycleResult;
  readonly leavePlaySession: (actor: Actor, sessionId: string) => AccessLeaveResult;
  readonly createSessionInvite: (
    actor: Actor,
    sessionId: string,
  ) =>
    | { readonly ok: true; readonly value: InviteCreateResult }
    | { readonly ok: false; readonly error: string };
  readonly revokeSessionInvite: (
    actor: Actor,
    token: string,
  ) =>
    | { readonly ok: true; readonly value: { readonly ok: true; readonly id: string } }
    | { readonly ok: false; readonly error: string };
  readonly resolveSessionInvite: (
    actor: Actor,
    token: string,
  ) => InviteResolveOk | InviteResolveFail | { readonly ok: false; readonly error: string };
};

export type SessionRecapPort = {
  readonly getSessionRecap: (
    actor: Actor,
    sessionId: string,
  ) => RecapOk | RecapError;
  readonly saveSessionRecapSummary: (
    actor: Actor,
    sessionId: string,
    summaryText: string | null,
    status: string,
  ) => RecapOk | RecapError;
};

export type SessionPorts = {
  readonly moduleId: 'session';
  readonly commands: SessionCommandPort;
  readonly queries: SessionQueryPort;
  readonly store: SessionRuntimeStore;
  readonly invites: SessionInviteStore;
  readonly lifecycle: SessionLifecyclePort;
  readonly access: SessionAccessPort;
  readonly recap: SessionRecapPort;
};

function unavailableLifecycle(): SessionLifecyclePort {
  const fail = (): LifecycleResult => ({ ok: false, error: 'store-unavailable' });
  return {
    createPlaySession: fail,
    createProjectSession: fail,
    setSessionStatus: fail,
  };
}

function unavailableAccess(): SessionAccessPort {
  const fail = (): LifecycleResult => ({ ok: false, error: 'store-unavailable' });
  return {
    joinSessionByCode: fail,
    leavePlaySession: () => ({ ok: false, error: 'store-unavailable' }),
    createSessionInvite: fail,
    revokeSessionInvite: fail,
    resolveSessionInvite: fail,
  };
}

function unavailableRecap(): SessionRecapPort {
  const fail = (): RecapError => ({ ok: false, error: 'store-unavailable' });
  return {
    getSessionRecap: fail,
    saveSessionRecapSummary: fail,
  };
}

function actorIds(actor: Actor | null | undefined): readonly string[] {
  if (!actor?.actorId) return [];
  if (actor.kind === 'remote-account' && Array.isArray(actor.linkedSoloActorIds)) {
    return [
      actor.actorId,
      ...actor.linkedSoloActorIds.filter((id) => typeof id === 'string' && id.length > 0),
    ];
  }
  return [actor.actorId];
}

/**
 * Session runtime + invite/join + lifecycle ports.
 * Membership (and write privilege) is enforced inside SQLite transactions.
 * Invite tokens / join codes are never GM proofs.
 * Lifecycle requires project ports for GM/member checks.
 */
export function createSessionPorts(deps: {
  readonly db: HostDatabase;
  readonly onCommitted?: SessionCommittedPublisher;
  readonly project?: ProjectPorts;
}): SessionPorts {
  const store = createSessionRuntimeStore(deps.db, { onCommitted: deps.onCommitted });
  const invites = createSessionInviteStore(deps.db);
  const lifecycleStore = deps.project
    ? new SessionLifecycleStore(deps.db, deps.project)
    : null;
  const accessStore = deps.project
    ? new SessionAccessStore(deps.db, deps.project)
    : null;
  const recapStore = deps.project
    ? new SessionRecapStore(deps.db, deps.project)
    : null;

  const lifecycle: SessionLifecyclePort = lifecycleStore
    ? {
        createPlaySession(actor, projectId, name = null) {
          const ids = actorIds(actor);
          if (!ids[0]) return { ok: false, error: '42501' };
          return lifecycleStore.createPlaySession(ids, projectId, name ?? null);
        },
        createProjectSession(actor, projectId, name = null, notes = null) {
          const ids = actorIds(actor);
          if (!ids[0]) return { ok: false, error: '42501' };
          return lifecycleStore.createProjectSession(
            ids,
            projectId,
            name ?? null,
            notes ?? null,
          );
        },
        setSessionStatus(actor, sessionId, status) {
          const ids = actorIds(actor);
          if (!ids[0]) return { ok: false, error: '42501' };
          return lifecycleStore.setSessionStatus(ids, sessionId, status);
        },
      }
    : unavailableLifecycle();

  const access: SessionAccessPort = accessStore
    ? {
        joinSessionByCode(actor, code, characterId = null) {
          const ids = actorIds(actor);
          if (!ids[0]) return { ok: false, error: '42501' };
          return accessStore.joinSessionByCode(ids, code, characterId ?? null);
        },
        leavePlaySession(actor, sessionId) {
          const ids = actorIds(actor);
          if (!ids[0]) return { ok: false, error: '42501' };
          return accessStore.leavePlaySession(ids, sessionId);
        },
        createSessionInvite(actor, sessionId) {
          const ids = actorIds(actor);
          if (!ids[0]) return { ok: false, error: '42501' };
          return accessStore.createSessionInvite(ids, sessionId);
        },
        revokeSessionInvite(actor, token) {
          const ids = actorIds(actor);
          if (!ids[0]) return { ok: false, error: '42501' };
          return accessStore.revokeSessionInvite(ids, token);
        },
        resolveSessionInvite(actor, token) {
          const ids = actorIds(actor);
          if (!ids[0]) return { ok: false, error: '42501' };
          return accessStore.resolveSessionInvite(ids, token);
        },
      }
    : unavailableAccess();

  const recap: SessionRecapPort = recapStore
    ? {
        getSessionRecap(actor, sessionId) {
          const ids = actorIds(actor);
          if (!ids[0]) return { ok: false, error: '42501:not authenticated' };
          return recapStore.getSessionRecap(ids, sessionId);
        },
        saveSessionRecapSummary(actor, sessionId, summaryText, status) {
          const ids = actorIds(actor);
          if (!ids[0]) return { ok: false, error: '42501:not authenticated' };
          return recapStore.saveSessionRecapSummary(
            ids,
            sessionId,
            summaryText,
            status,
          );
        },
      }
    : unavailableRecap();

  return {
    moduleId: 'session',
    commands: {
      apply(actor, command): ApplyCommandResult {
        if (!actor?.actorId) return { ok: false, error: 'UNAUTHENTICATED' };
        return store.applyCommand(actor.actorId, command);
      },
    },
    queries: {
      getSnapshot(actor, sessionId) {
        if (!actor?.actorId) return { ok: false, error: 'UNAUTHENTICATED' };
        return store.readSnapshot(actor.actorId, sessionId);
      },
    },
    store,
    invites,
    lifecycle,
    access,
    recap,
  };
}

/**
 * Read-only play_sessions → project_id lookup for cross-module composition
 * (e.g. npc-creature). Keeps play_sessions SQL inside the session module.
 */
export function createSessionProjectLookup(db: HostDatabase): {
  readonly projectIdForSession: (sessionId: string) => string | null;
} {
  return {
    projectIdForSession(sessionId: string): string | null {
      const trimmed = typeof sessionId === 'string' ? sessionId.trim() : '';
      if (!trimmed) return null;
      const row = db
        .prepare(
          `SELECT project_id AS projectId FROM play_sessions WHERE session_id = ?`,
        )
        .get(trimmed) as { projectId: string } | undefined;
      return row?.projectId ?? null;
    },
  };
}

/** MIG-407 quarantine surface — not a public host route. */
export {
  DM_TOOLS_PUBLIC_ACTIVATION_AUTHORIZED,
  DM_TOOLS_REDIS_PROVIDES_PERSISTENCE,
  acceptUnauthenticatedCombatAuthority,
  applyDamage,
  createSeededRng,
  endCombat,
  initCombat,
  nextTurn,
  parseDiceNotation,
  rollDice,
  type CombatState,
  type DiceResult,
} from './internal/dm-tools-quarantine.ts';

/** MIG-420 session-media-token isolated-contract surface — Edge remains live mount. */
export {
  SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED,
  createSessionMediaTokenStore,
  issueSessionMediaToken,
  type SessionMediaTokenResult,
  type SessionMediaTokenStore,
} from './session-media-token.ts';

/** MIG-421 session-recap generate isolated-contract surface — Edge remains live mount. */
export {
  SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED,
  createSessionRecapGenerateStore,
  generateSessionRecap,
  type SessionRecapGenerateResult,
  type SessionRecapGenerateStore,
} from './session-recap-generate.ts';

/** MIG-422 Edge sessions Map quarantine — not a public host route. */
export {
  SESSIONS_EDGE_MAP_IS_DURABLE,
  SESSIONS_EDGE_PUBLIC_ACTIVATION_AUTHORIZED,
  bodyFieldsAreNotAuthority,
  createQuarantineSavePoint,
  createQuarantineSession,
  createSessionsEdgeQuarantineStore,
  defaultWorldState,
  describeSessionsEdgeLegacyDefects,
  endQuarantineSession,
  getQuarantineChatHistory,
  getQuarantineSessionLogs,
  loadQuarantineSavePoint,
  pauseQuarantineSession,
  sendQuarantineChat,
  startQuarantineSession,
  type QuarantineSession,
  type QuarantineSessionLog,
  type SessionsEdgeQuarantineStore,
} from './internal/sessions-edge-quarantine.ts';
