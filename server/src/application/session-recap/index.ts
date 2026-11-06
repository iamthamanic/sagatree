/**
 * session-recap generate use-cases (MIG-421 / #837 → CUT-14 / #1149).
 * Location: server/src/application/session-recap/index.ts
 *
 * Host HTTP activation via POST `/api/v1/sessions/:sessionId/recap/generate`.
 * Manual get/save remain under get_session_recap/ / save_session_recap_summary/.
 */
import type { Actor } from '../../modules/identity/index.ts';
import {
  SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED,
  createSessionRecapGenerateStore,
  generateSessionRecap,
  isSessionRecapUuid,
  type SessionRecapGenerateDeps,
  type SessionRecapGenerateResult,
  type SessionRecapGenerateStore,
  type SessionRecapRow,
} from '../../modules/session/session-recap-generate.ts';

export {
  SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED,
  resolveSessionRecapProviderConfig,
  SESSION_RECAP_MAX_REQUEST_BYTES,
  checkSessionRecapBodySize,
  generateSessionRecapStory,
  createSqliteSessionRecapGenerateStore,
  hydrateSessionRecapGenerateStoreFromDb,
  persistSessionRecapGenerateDraft,
  resolveSessionRecapRateLimit,
} from '../../modules/session/session-recap-generate.ts';

function actorUserId(actor: Actor): string | null {
  const id = typeof actor?.actorId === 'string' ? actor.actorId.trim() : '';
  return id || null;
}

function actorIdsForAuthz(actor: Actor): readonly string[] {
  const primary = actorUserId(actor);
  if (!primary) return [];
  const linked =
    actor.kind === 'remote-account' && Array.isArray(actor.linkedSoloActorIds)
      ? actor.linkedSoloActorIds.filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        )
      : [];
  return [...new Set([primary, ...linked])];
}

function sessionIdFromBody(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const raw = (body as Record<string, unknown>).sessionId;
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  return isSessionRecapUuid(id) ? id : null;
}

export type SessionRecapGenerateUseCaseDeps = Omit<SessionRecapGenerateDeps, 'store'> & {
  readonly store?: SessionRecapGenerateStore;
  /** Load session/project/recap rows before generate (host SQLite). */
  readonly hydrateSession?: (
    sessionId: string,
    store: SessionRecapGenerateStore,
  ) => void;
  /** Persist draft row after successful generate (host SQLite). */
  readonly afterDraftPersist?: (
    row: SessionRecapRow,
  ) =>
    | void
    | { ok: true }
    | { ok: false; reason: 'approved-locked' | 'store-unavailable' };
};

export function createSessionRecapGenerateUseCases(
  deps: SessionRecapGenerateUseCaseDeps,
) {
  const store = deps.store ?? createSessionRecapGenerateStore();
  const generateDeps: SessionRecapGenerateDeps = {
    store,
    resolveProvider: deps.resolveProvider,
    generateSummary: deps.generateSummary,
    rateLimitPerMinute: deps.rateLimitPerMinute,
    nowMs: deps.nowMs,
  };

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
      const sessionId = sessionIdFromBody(input.body);
      if (sessionId && deps.hydrateSession) {
        deps.hydrateSession(sessionId, store);
      }
      const result = await generateSessionRecap(generateDeps, {
        userId: actorUserId(actor),
        actorIds: actorIdsForAuthz(actor),
        method: input.method,
        contentLengthHeader: input.contentLengthHeader,
        rawBodyUtf8Bytes: input.rawBodyUtf8Bytes,
        body: input.body,
      });
      if (result.status === 'ok' && sessionId && deps.afterDraftPersist) {
        const row = store.recaps.get(sessionId);
        if (row) {
          const persisted = deps.afterDraftPersist(row);
          if (persisted && persisted.ok === false) {
            if (persisted.reason === 'approved-locked') {
              return {
                status: 'error',
                message:
                  'Die Zusammenfassung ist bereits freigegeben. Setze sie manuell zurück, bevor du neu generierst.',
                httpStatus: 409,
                reason: 'approved-locked',
              };
            }
            return {
              status: 'error',
              message:
                'Zusammenfassung konnte nicht gespeichert werden. Du kannst den Text manuell schreiben.',
              httpStatus: 503,
              reason: 'store-unavailable',
            };
          }
        }
      }
      return result;
    },
  };
}

export type SessionRecapGenerateUseCases = ReturnType<
  typeof createSessionRecapGenerateUseCases
>;
