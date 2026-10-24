/**
 * Saga module public API — definition authoring ports (RPC-SAGA-AUTHORING / #871).
 * Location: server/src/modules/saga/index.ts
 *
 * Owner-scoped drafts/publishes; native definitions are immutable. Client roles
 * never elevate. Revision conflicts return SQLSTATE-shaped `40001`.
 */
import type { Actor } from '../identity/index.ts';
import type { PolicyDecision, PolicyOp, PolicyResource } from '../permissions/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import { SagaDefinitionStore } from './internal/saga-definition-store.ts';

export type SagaResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

type AuthorizeFn = (op: PolicyOp, actor: Actor, resource?: PolicyResource) => PolicyDecision;

export type SagaPorts = {
  readonly moduleId: 'saga';
  readonly createUserSagaDefinition: (
    actor: Actor,
    title: string,
    blurb?: string,
  ) => SagaResult<{ sagaId: string; versionId: string; revision: number }>;
  readonly copyNativeSagaDefinition: (
    actor: Actor,
    sourceSagaId: string,
  ) => SagaResult<{ sagaId: string; versionId: string }>;
  readonly getSagaDefinitionEditor: (
    actor: Actor,
    sagaId: string,
  ) => SagaResult<{
    sagaId: string;
    sagaSlug: string;
    title: string;
    synopsis: string;
    origin: string;
    versionId: string;
    versionLabel: string;
    status: string;
    payload: Record<string, unknown>;
    revision: number;
    canEdit: boolean;
    isGmProjection: true;
  }>;
  readonly saveSagaDefinitionDraft: (
    actor: Actor,
    sagaId: string,
    payload: Record<string, unknown>,
    expectedRevision: number,
  ) => SagaResult<{
    sagaId: string;
    versionId: string;
    revision: number;
    payload: Record<string, unknown>;
  }>;
  readonly publishSagaDefinitionVersion: (
    actor: Actor,
    sagaId: string,
    expectedRevision: number,
  ) => SagaResult<{
    sagaId: string;
    versionId: string;
    versionLabel: string;
    revision: number;
  }>;
  /** Test helper — seed immutable native saga with published version. */
  readonly seedNativeForTests: (input: {
    readonly id?: string;
    readonly title: string;
    readonly synopsis?: string;
  }) => { sagaId: string; versionId: string };
  readonly countDraftsForTests: (sagaId: string) => number;
  readonly countPublishedForTests: (sagaId: string) => number;
};

function requireActor(actor: Actor | null | undefined): actor is Actor {
  return Boolean(actor?.actorId);
}

export function createSagaPorts(deps: {
  readonly db: HostDatabase;
  readonly authorize: AuthorizeFn;
}): SagaPorts {
  const store = new SagaDefinitionStore(deps.db);
  const { authorize } = deps;

  return {
    moduleId: 'saga',

    createUserSagaDefinition(actor, title, blurb = '') {
      if (!requireActor(actor)) return { ok: false, error: '42501' };
      const decision = authorize('saga.write', actor, {});
      if (!decision.allow) return { ok: false, error: '42501' };
      return store.createUserSaga(actor.actorId, title, blurb);
    },

    copyNativeSagaDefinition(actor, sourceSagaId) {
      if (!requireActor(actor)) return { ok: false, error: '42501' };
      const decision = authorize('saga.write', actor, {});
      if (!decision.allow) return { ok: false, error: '42501' };
      return store.copyNative(actor.actorId, sourceSagaId);
    },

    getSagaDefinitionEditor(actor, sagaId) {
      if (!requireActor(actor)) return { ok: false, error: '42501' };
      const decision = authorize('saga.read', actor, { sagaId });
      if (!decision.allow) {
        return { ok: false, error: decision.reason === 'saga-not-found' ? 'P0002' : '42501' };
      }
      return store.getEditor(actor.actorId, sagaId);
    },

    saveSagaDefinitionDraft(actor, sagaId, payload, expectedRevision) {
      if (!requireActor(actor)) return { ok: false, error: '42501' };
      const decision = authorize('saga.write', actor, { sagaId });
      if (!decision.allow) return { ok: false, error: '42501' };
      return store.saveDraft(actor.actorId, sagaId, payload, expectedRevision);
    },

    publishSagaDefinitionVersion(actor, sagaId, expectedRevision) {
      if (!requireActor(actor)) return { ok: false, error: '42501' };
      const decision = authorize('saga.write', actor, { sagaId });
      if (!decision.allow) return { ok: false, error: '42501' };
      return store.publish(actor.actorId, sagaId, expectedRevision);
    },

    seedNativeForTests(input) {
      return store.seedNative(input);
    },

    countDraftsForTests(sagaId) {
      return store.countDrafts(sagaId);
    },

    countPublishedForTests(sagaId) {
      return store.countPublished(sagaId);
    },
  };
}

export function createSagaPortsStub(): SagaPorts {
  const deny = (): SagaResult<never> => ({ ok: false, error: 'store-unavailable' });
  return {
    moduleId: 'saga',
    createUserSagaDefinition: () => deny(),
    copyNativeSagaDefinition: () => deny(),
    getSagaDefinitionEditor: () => deny(),
    saveSagaDefinitionDraft: () => deny(),
    publishSagaDefinitionVersion: () => deny(),
    seedNativeForTests: () => ({ sagaId: '', versionId: '' }),
    countDraftsForTests: () => 0,
    countPublishedForTests: () => 0,
  };
}
