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
  type SessionRuntimeState,
  type SessionRuntimeStore,
} from './internal/session-runtime-store.ts';

export type {
  ApplyCommandInput,
  ApplyCommandResult,
  SessionCommandOp,
  SessionRuntimeState,
  SessionRuntimeStore,
} from './internal/session-runtime-store.ts';

export type SessionCommandPort = {
  readonly apply: (actor: Actor, command: ApplyCommandInput) => ApplyCommandResult;
};

export type SessionQueryPort = {
  readonly getSnapshot: (
    actor: Actor,
    sessionId: string,
  ) =>
    | {
        readonly ok: true;
        readonly sessionId: string;
        readonly projectId: string;
        readonly revision: number;
        readonly state: SessionRuntimeState;
        readonly updatedAt: string;
      }
    | { readonly ok: false; readonly error: string };
};

export type SessionPorts = {
  readonly moduleId: 'session';
  readonly commands: SessionCommandPort;
  readonly queries: SessionQueryPort;
  /** Composition-root seed helper for tests/bootstrap — not an HTTP surface. */
  readonly store: SessionRuntimeStore;
};

/**
 * Session runtime ports. Membership (and write privilege) is enforced inside
 * the SQLite transaction, including before idempotent replay (ADR-ST-08).
 */
export function createSessionPorts(deps: { readonly db: HostDatabase }): SessionPorts {
  const store = createSessionRuntimeStore(deps.db);

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
  };
}
