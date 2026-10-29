/**
 * session-recap Edge generate use-cases (MIG-421 / #837).
 * Location: server/src/application/session-recap/index.ts
 *
 * Isolated-contract host surface. Edge allowlisted worker remains live; no cutover.
 * RPC get/save live under get_session_recap/ and save_session_recap_summary/.
 */
import type { Actor } from '../../modules/identity/index.ts';
import {
  SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED,
  createSessionRecapGenerateStore,
  generateSessionRecap,
  type SessionRecapGenerateDeps,
  type SessionRecapGenerateResult,
  type SessionRecapGenerateStore,
} from '../../modules/session/session-recap-generate.ts';

function actorUserId(actor: Actor): string | null {
  const id = typeof actor?.actorId === 'string' ? actor.actorId.trim() : '';
  return id || null;
}

export type SessionRecapGenerateUseCaseDeps = Omit<SessionRecapGenerateDeps, 'store'> & {
  readonly store?: SessionRecapGenerateStore;
};

export function createSessionRecapGenerateUseCases(
  deps: SessionRecapGenerateUseCaseDeps,
) {
  const store = deps.store ?? createSessionRecapGenerateStore();
  const generateDeps: SessionRecapGenerateDeps = { ...deps, store };

  return {
    publicActivationAuthorized: SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED,
    store,
    generate: async (
      actor: Actor,
      input: {
        readonly method?: string;
        readonly contentLengthHeader: string | null;
        readonly rawBodyUtf8Bytes?: number;
        readonly body: unknown;
      },
    ): Promise<SessionRecapGenerateResult> => {
      return generateSessionRecap(generateDeps, {
        userId: actorUserId(actor),
        method: input.method,
        contentLengthHeader: input.contentLengthHeader,
        rawBodyUtf8Bytes: input.rawBodyUtf8Bytes,
        body: input.body,
      });
    },
  };
}

export type SessionRecapGenerateUseCases = ReturnType<
  typeof createSessionRecapGenerateUseCases
>;
