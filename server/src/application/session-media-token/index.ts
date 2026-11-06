/**
 * session-media-token use-cases (MIG-420 / #836 → CUT-19 / #1154).
 * Location: server/src/application/session-media-token/index.ts
 *
 * Host HTTP activation via POST `/api/v1/sessions/:sessionId/media-token`.
 * Edge remains allowlisted until dual-path removal.
 */
import type { Actor } from '../../modules/identity/index.ts';
import {
  SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED,
  createSessionMediaTokenStore,
  hydrateSessionMediaTokenFromDb,
  issueSessionMediaToken,
  seedSessionMediaTokenMember,
  seedSessionMediaTokenSession,
  type SessionMediaTokenHydrateResult,
  type SessionMediaTokenIssueInput,
  type SessionMediaTokenResult,
  type SessionMediaTokenStore,
} from '../../modules/session/session-media-token.ts';

export { hydrateSessionMediaTokenFromDb };
export type { SessionMediaTokenHydrateResult };

function actorUserId(actor: Actor): string | null {
  const id = typeof actor?.actorId === 'string' ? actor.actorId.trim() : '';
  return id || null;
}

/** Primary + linked solo ids — same expansion as session module ports. */
function actorMembershipIds(actor: Actor): readonly string[] {
  const primary = actorUserId(actor);
  if (!primary) return [];
  if (
    actor.kind === 'remote-account' &&
    Array.isArray(actor.linkedSoloActorIds)
  ) {
    return [
      primary,
      ...actor.linkedSoloActorIds.filter(
        (id) => typeof id === 'string' && id.trim().length > 0,
      ),
    ];
  }
  return [primary];
}

export type SessionMediaTokenUseCaseDeps = {
  readonly store?: SessionMediaTokenStore;
  /**
   * Load session + active project members into the in-memory store before issue.
   * Host composition wires SQLite; isolated tests seed the store directly.
   */
  readonly hydrateSession?: (
    sessionId: string,
  ) => SessionMediaTokenHydrateResult | null | Promise<SessionMediaTokenHydrateResult | null>;
};

export function createSessionMediaTokenUseCases(
  deps: SessionMediaTokenUseCaseDeps = {},
) {
  const store = deps.store ?? createSessionMediaTokenStore();
  const hydrateSession = deps.hydrateSession;

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
        readonly pathSessionId?: string;
      },
    ): Promise<SessionMediaTokenResult> => {
      const userId = actorUserId(actor);
      let body: unknown = input.body;
      // Path param wins over body.sessionId (Edge parity + REST mount).
      if (
        typeof input.pathSessionId === 'string' &&
        input.pathSessionId.trim() &&
        body &&
        typeof body === 'object' &&
        !Array.isArray(body)
      ) {
        body = { ...(body as Record<string, unknown>), sessionId: input.pathSessionId.trim() };
      } else if (
        typeof input.pathSessionId === 'string' &&
        input.pathSessionId.trim() &&
        (body === null || body === undefined || typeof body !== 'object')
      ) {
        body = { sessionId: input.pathSessionId.trim() };
      }

      const sessionId =
        body && typeof body === 'object' && !Array.isArray(body)
          ? typeof (body as Record<string, unknown>).sessionId === 'string'
            ? String((body as Record<string, unknown>).sessionId).trim()
            : ''
          : '';
      if (sessionId && hydrateSession) {
        const hydrated = await hydrateSession(sessionId);
        if (hydrated) {
          seedSessionMediaTokenSession(store, hydrated.session);
          for (const row of hydrated.members) {
            seedSessionMediaTokenMember(store, row.projectId, row.member);
          }
        }
      }

      const issueInput: SessionMediaTokenIssueInput = {
        userId,
        membershipUserIds: actorMembershipIds(actor),
        method: input.method ?? 'POST',
        body,
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
