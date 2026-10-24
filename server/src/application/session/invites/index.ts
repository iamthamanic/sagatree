/**
 * Session invites use-case — create/resolve/revoke/join without privilege escalation (MIG-023).
 * Location: server/src/application/session/invites/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

export type SessionInvitesUseCase = {
  readonly createInvite: (
    actor: Actor,
    sessionId: string,
    options?: { readonly maxRedemptions?: number; readonly ttlMs?: number },
  ) => ReturnType<SessionPorts['invites']['createInvite']>;
  readonly revokeInvite: (
    actor: Actor,
    token: string,
  ) => ReturnType<SessionPorts['invites']['revokeInvite']>;
  readonly resolveInvite: (
    actor: Actor,
    token: string,
  ) => ReturnType<SessionPorts['invites']['resolveInvite']>;
  readonly joinByInviteOrCode: (
    actor: Actor,
    input: {
      readonly token?: string;
      readonly joinCode?: string;
      /** Ignored — never grants gm/owner. */
      readonly claimedRole?: string;
      readonly characterId?: string | null;
    },
  ) => ReturnType<SessionPorts['invites']['joinByInviteOrCode']>;
};

export function createSessionInvitesUseCase(ports: SessionPorts): SessionInvitesUseCase {
  return {
    createInvite(actor, sessionId, options) {
      if (!actor?.actorId) return { ok: false, error: 'UNAUTHENTICATED' };
      return ports.invites.createInvite(actor.actorId, sessionId, options);
    },
    revokeInvite(actor, token) {
      if (!actor?.actorId) return { ok: false, error: 'UNAUTHENTICATED' };
      return ports.invites.revokeInvite(actor.actorId, token);
    },
    resolveInvite(actor, token) {
      if (!actor?.actorId) return { ok: false, error: 'UNAUTHENTICATED' };
      return ports.invites.resolveInvite(actor.actorId, token);
    },
    joinByInviteOrCode(actor, input) {
      if (!actor?.actorId) return { ok: false, error: 'UNAUTHENTICATED' };
      return ports.invites.joinByInviteOrCode(actor.actorId, input);
    },
  };
}
