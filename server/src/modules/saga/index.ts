/**
 * Saga module public API — definition authoring + version/native catalog reads.
 * Location: server/src/modules/saga/index.ts
 *
 * Owner-scoped drafts/publishes; native definitions are immutable. Client roles
 * never elevate. Revision conflicts return SQLSTATE-shaped `40001`.
 * Version reads (#872) project GM vs player payloads via host helper.
 */
import type { Actor } from '../identity/index.ts';
import type { PolicyDecision, PolicyOp, PolicyResource } from '../permissions/index.ts';
import type { ProjectPorts } from '../project/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import {
  SagaDefinitionStore,
  actorOwnsSaga,
  type SagaVersionReadVm,
} from './internal/saga-definition-store.ts';
import {
  SagaProjectionsStore,
  type CharacterNameLookup,
  type SagaLorePermissionLookup,
  type WorldPromoteLookup,
} from './internal/saga-projections-store.ts';
import type { SessionPromoteLookup } from '../session/index.ts';
import { SessionOutcomeStore } from '../session/index.ts';

export type SagaResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type { SagaVersionReadVm };

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
  readonly getSagaDefinitionVersion: (
    actor: Actor,
    versionId: string,
  ) => SagaResult<SagaVersionReadVm>;
  readonly getNativeSagaDefinitionBySlug: (
    actor: Actor,
    slug: string,
  ) => SagaResult<SagaVersionReadVm>;
  /**
   * Existence + published lookup for provision ACL (not version-read scope).
   * Caller applies create_project_from_saga_version origin rules.
   */
  readonly lookupPublishedVersionForProvision: (
    sagaId: string,
    versionId: string,
  ) => SagaResult<{
    readonly sagaId: string;
    readonly versionId: string;
    readonly origin: string;
    readonly ownerUserId: string | null;
    readonly title: string;
    readonly synopsis: string;
    readonly adventureRuntime: Record<string, unknown>;
  }>;
  readonly findLatestPublishedNativeBySlug: (
    slug: string,
  ) => SagaResult<{ sagaId: string; versionId: string; title: string }>;
  /** Test helper — seed immutable native saga with published version. */
  readonly seedNativeForTests: (input: {
    readonly id?: string;
    readonly slug?: string;
    readonly title: string;
    readonly synopsis?: string;
    readonly payload?: Record<string, unknown>;
  }) => { sagaId: string; versionId: string; slug: string };
  readonly seedPublishedDefinitionForTests: (input: {
    readonly id?: string;
    readonly slug?: string;
    readonly title: string;
    readonly synopsis?: string;
    readonly payload?: Record<string, unknown>;
    readonly origin: 'native' | 'user' | 'private_backfill';
    readonly ownerUserId: string | null;
  }) => { sagaId: string; versionId: string; slug: string };
  readonly seedPublishedVersionForTests: (input: {
    readonly sagaId: string;
    readonly versionLabel: string;
    readonly payload?: Record<string, unknown>;
    readonly publishedAt?: string;
  }) => string;
  readonly countDraftsForTests: (sagaId: string) => number;
  readonly countPublishedForTests: (sagaId: string) => number;
  /** RPC-SAGA-PROJECTIONS (#876) */
  readonly getSagaOverview: (
    actor: Actor,
    publicId: string,
  ) => SagaResult<Record<string, unknown>>;
  readonly getSagaLoreTimeline: (
    actor: Actor,
    publicId: string,
  ) => SagaResult<Record<string, unknown>>;
  readonly promoteSessionOutcomeToSaga: (
    actor: Actor,
    sessionId: string,
    consequenceId: string,
  ) => SagaResult<Record<string, unknown>>;
  readonly promoteSessionOutcomeToWorld: (
    actor: Actor,
    sessionId: string,
    consequenceId: string,
  ) => SagaResult<Record<string, unknown>>;
};

function actorIdsOf(actor: Actor): readonly string[] {
  if (actor.kind === 'remote-account' && Array.isArray(actor.linkedSoloActorIds)) {
    return [
      actor.actorId,
      ...actor.linkedSoloActorIds.filter((id) => typeof id === 'string' && id.length > 0),
    ];
  }
  return [actor.actorId];
}

function requireActor(actor: Actor | null | undefined): actor is Actor {
  return Boolean(actor?.actorId);
}

function resolveVersionAccess(
  actor: Actor,
  store: SagaDefinitionStore,
  project: ProjectPorts,
  versionId: string,
): { allow: boolean; isGm: boolean; error?: string } {
  const ver = store.getVersion(versionId);
  if (!ver) return { allow: false, isGm: false, error: 'P0002' };
  const def = store.getDefinition(ver.saga_id);
  if (!def) return { allow: false, isGm: false, error: 'P0002' };

  const linked =
    actor.kind === 'remote-account' ? actor.linkedSoloActorIds : undefined;
  const ownerRef = { actorId: actor.actorId, linkedSoloActorIds: linked };

  if (def.origin === 'native' && ver.status === 'published') {
    return { allow: true, isGm: project.actorIsGmOnSaga(actor.actorId, def.id) };
  }
  if (actorOwnsSaga(ownerRef, def.owner_user_id)) {
    return { allow: true, isGm: true };
  }
  if (project.actorHasAccessToSaga(actor.actorId, def.id)) {
    return { allow: true, isGm: project.actorIsGmOnSaga(actor.actorId, def.id) };
  }
  return { allow: false, isGm: false, error: '42501' };
}

export function createSagaPorts(deps: {
  readonly db: HostDatabase;
  readonly authorize: AuthorizeFn;
  readonly project: ProjectPorts;
  readonly loreAcl?: SagaLorePermissionLookup | null;
  readonly world?: WorldPromoteLookup | null;
  readonly sessionPromote?: SessionPromoteLookup | null;
  readonly characterNames?: CharacterNameLookup | null;
}): SagaPorts {
  const store = new SagaDefinitionStore(deps.db);
  const { authorize, project } = deps;
  const worldLookup: WorldPromoteLookup = deps.world ?? {
    canEditWorld: () => false,
    appendPromotedLoreFact: () => ({ ok: false, error: 'store-unavailable' }),
  };
  const sessionPromote = deps.sessionPromote ?? new SessionOutcomeStore(deps.db);
  const projections = new SagaProjectionsStore(
    deps.db,
    project,
    store,
    deps.loreAcl ?? null,
    worldLookup,
    sessionPromote,
    deps.characterNames ?? null,
  );

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
      return store.getEditor(actor, sagaId);
    },

    saveSagaDefinitionDraft(actor, sagaId, payload, expectedRevision) {
      if (!requireActor(actor)) return { ok: false, error: '42501' };
      const decision = authorize('saga.write', actor, { sagaId });
      if (!decision.allow) return { ok: false, error: '42501' };
      return store.saveDraft(actor, sagaId, payload, expectedRevision);
    },

    publishSagaDefinitionVersion(actor, sagaId, expectedRevision) {
      if (!requireActor(actor)) return { ok: false, error: '42501' };
      const decision = authorize('saga.write', actor, { sagaId });
      if (!decision.allow) return { ok: false, error: '42501' };
      return store.publish(actor, sagaId, expectedRevision);
    },

    getSagaDefinitionVersion(actor, versionId) {
      if (!requireActor(actor)) return { ok: false, error: '42501' };
      const ver = store.getVersion(versionId);
      if (!ver) return { ok: false, error: 'P0002' };
      const decision = authorize('saga.read', actor, { sagaId: ver.saga_id });
      if (!decision.allow) {
        return { ok: false, error: decision.reason === 'saga-not-found' ? 'P0002' : '42501' };
      }
      const access = resolveVersionAccess(actor, store, project, versionId);
      if (access.error === 'P0002') return { ok: false, error: 'P0002' };
      return store.getVersionRead(versionId, { allow: access.allow, isGm: access.isGm });
    },

    getNativeSagaDefinitionBySlug(actor, slug) {
      if (!requireActor(actor)) return { ok: false, error: '42501' };
      const versionId = store.findLatestPublishedNativeVersionIdBySlug(slug);
      if (!versionId) return { ok: false, error: 'P0002' };
      const ver = store.getVersion(versionId);
      if (!ver) return { ok: false, error: 'P0002' };
      const decision = authorize('saga.read', actor, { sagaId: ver.saga_id });
      if (!decision.allow) {
        return { ok: false, error: decision.reason === 'saga-not-found' ? 'P0002' : '42501' };
      }
      const access = resolveVersionAccess(actor, store, project, versionId);
      if (access.error === 'P0002') return { ok: false, error: 'P0002' };
      return store.getVersionRead(versionId, { allow: access.allow, isGm: access.isGm });
    },

    lookupPublishedVersionForProvision(sagaId, versionId) {
      return store.lookupPublishedVersionForProvision(sagaId, versionId);
    },

    findLatestPublishedNativeBySlug(slug) {
      const versionId = store.findLatestPublishedNativeVersionIdBySlug(slug);
      if (!versionId) return { ok: false, error: 'P0002' };
      const ver = store.getVersion(versionId);
      const def = ver ? store.getDefinition(ver.saga_id) : null;
      if (!ver || !def) return { ok: false, error: 'P0002' };
      return { ok: true, value: { sagaId: def.id, versionId: ver.id, title: def.title } };
    },

    seedNativeForTests(input) {
      return store.seedNative(input);
    },

    seedPublishedDefinitionForTests(input) {
      return store.seedPublishedDefinition(input);
    },

    seedPublishedVersionForTests(input) {
      return store.seedPublishedVersion(input);
    },

    countDraftsForTests(sagaId) {
      return store.countDrafts(sagaId);
    },

    countPublishedForTests(sagaId) {
      return store.countPublished(sagaId);
    },

    getSagaOverview(actor, publicId) {
      if (!requireActor(actor)) return { ok: false, error: '42501:not authenticated' };
      return projections.getSagaOverview(actorIdsOf(actor), publicId);
    },
    getSagaLoreTimeline(actor, publicId) {
      if (!requireActor(actor)) return { ok: false, error: '42501:not authenticated' };
      return projections.getSagaLoreTimeline(actorIdsOf(actor), publicId);
    },
    promoteSessionOutcomeToSaga(actor, sessionId, consequenceId) {
      if (!requireActor(actor)) return { ok: false, error: '42501:not authenticated' };
      return projections.promoteSessionOutcomeToSaga(
        actorIdsOf(actor),
        sessionId,
        consequenceId,
      );
    },
    promoteSessionOutcomeToWorld(actor, sessionId, consequenceId) {
      if (!requireActor(actor)) return { ok: false, error: '42501:not authenticated' };
      return projections.promoteSessionOutcomeToWorld(
        actorIdsOf(actor),
        sessionId,
        consequenceId,
      );
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
    getSagaDefinitionVersion: () => deny(),
    getNativeSagaDefinitionBySlug: () => deny(),
    lookupPublishedVersionForProvision: () => deny(),
    findLatestPublishedNativeBySlug: () => deny(),
    seedNativeForTests: () => ({ sagaId: '', versionId: '', slug: '' }),
    seedPublishedDefinitionForTests: () => ({ sagaId: '', versionId: '', slug: '' }),
    seedPublishedVersionForTests: () => '',
    countDraftsForTests: () => 0,
    countPublishedForTests: () => 0,
    getSagaOverview: () => deny(),
    getSagaLoreTimeline: () => deny(),
    promoteSessionOutcomeToSaga: () => deny(),
    promoteSessionOutcomeToWorld: () => deny(),
  };
}
