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
export { appendSessionEventIsExported };

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

export type SessionPorts = {
  readonly moduleId: 'session';
  readonly commands: SessionCommandPort;
  readonly queries: SessionQueryPort;
  readonly store: SessionRuntimeStore;
  readonly invites: SessionInviteStore;
  readonly lifecycle: SessionLifecyclePort;
};

function unavailableLifecycle(): SessionLifecyclePort {
  const fail = (): LifecycleResult => ({ ok: false, error: 'store-unavailable' });
  return {
    createPlaySession: fail,
    createProjectSession: fail,
    setSessionStatus: fail,
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
