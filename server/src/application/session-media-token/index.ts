/**
 * session-media-token use-cases (MIG-420 / #836).
 * Location: server/src/application/session-media-token/index.ts
 *
 * Isolated-contract host surface. Edge allowlisted worker remains live; no cutover.
 */
// Public identity contract is `modules/identity/index.ts` (no separate actor.ts);
 // matches established application/* use-case ports (item-thumbnail, character-lore, …).
import type { Actor } from '../../modules/identity/index.ts';
import {
  SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED,
  createSessionMediaTokenStore,
  issueSessionMediaToken,
  type SessionMediaTokenIssueInput,
  type SessionMediaTokenResult,
  type SessionMediaTokenStore,
} from '../../modules/session/session-media-token.ts';

function actorUserId(actor: Actor): string | null {
  const id = typeof actor?.actorId === 'string' ? actor.actorId.trim() : '';
  return id || null;
}

export type SessionMediaTokenUseCaseDeps = {
  readonly store?: SessionMediaTokenStore;
};

export function createSessionMediaTokenUseCases(
  deps: SessionMediaTokenUseCaseDeps = {},
) {
  const store = deps.store ?? createSessionMediaTokenStore();

  return {
    publicActivationAuthorized: SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED,
    store,
    issue: async (
      actor: Actor,
      input: {
        readonly method?: string;
        readonly body: unknown;
        readonly clientRole?: unknown;
        readonly clientCapabilities?: unknown;
        readonly clientRoom?: unknown;
      },
    ): Promise<SessionMediaTokenResult> => {
      const issueInput: SessionMediaTokenIssueInput = {
        userId: actorUserId(actor),
        method: input.method ?? 'POST',
        body: input.body,
        clientRole: input.clientRole,
        clientCapabilities: input.clientCapabilities,
        clientRoom: input.clientRoom,
      };
      return issueSessionMediaToken(store, issueInput);
    },
  };
}

export type SessionMediaTokenUseCases = ReturnType<
  typeof createSessionMediaTokenUseCases
>;
