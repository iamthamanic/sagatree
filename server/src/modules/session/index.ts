/**
 * session module public API — SessionRuntimeState command/query ports (MIG-022).
 * Location: server/src/modules/session/index.ts
 */
import type { Actor } from '../identity/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
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

export type SessionPorts = {
  readonly moduleId: 'session';
  readonly commands: SessionCommandPort;
  readonly queries: SessionQueryPort;
  readonly store: SessionRuntimeStore;
  readonly invites: SessionInviteStore;
};

/**
 * Session runtime + invite/join ports. Membership (and write privilege) is enforced
 * inside SQLite transactions. Invite tokens / join codes are never GM proofs.
 */
export function createSessionPorts(deps: {
  readonly db: HostDatabase;
  readonly onCommitted?: SessionCommittedPublisher;
}): SessionPorts {
  const store = createSessionRuntimeStore(deps.db, { onCommitted: deps.onCommitted });
  const invites = createSessionInviteStore(deps.db);

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
