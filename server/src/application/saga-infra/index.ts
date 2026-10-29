/**
 * saga-infra ports — composed host surface for all 11 infra-saga RPCs (MIG-310 / #809).
 * Location: server/src/application/saga-infra/index.ts
 *
 * Application-layer binder over predecessor use-cases. No HTTP mount in this slice.
 * FE dual-path seam mirrors these ops via host-saga-ports.contract.ts.
 */
import type { Actor } from '../../modules/identity/index.ts';
import type { ProjectPorts } from '../../modules/project/index.ts';
import type { SagaPorts } from '../../modules/saga/index.ts';
import type { WorldPorts } from '../../modules/world/index.ts';
import { copy_native_saga_definition } from '../commands/copy_native_saga_definition.ts';
import { create_project_from_saga_version } from '../commands/create_project_from_saga_version.ts';
import { create_user_saga_definition } from '../commands/create_user_saga_definition.ts';
import { duplicate_saga_playthrough } from '../commands/duplicate_saga_playthrough.ts';
import { get_native_saga_definition_by_slug } from '../commands/get_native_saga_definition_by_slug.ts';
import { get_saga_definition_editor } from '../commands/get_saga_definition_editor.ts';
import { get_saga_definition_version } from '../commands/get_saga_definition_version.ts';
import { promote_session_outcome_to_saga } from '../commands/promote_session_outcome_to_saga.ts';
import { promote_session_outcome_to_world } from '../commands/promote_session_outcome_to_world.ts';
import { publish_saga_definition_version } from '../commands/publish_saga_definition_version.ts';
import { save_saga_definition_draft } from '../commands/save_saga_definition_draft.ts';

export type SagaInfraResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly detail?: string };

export type SagaInfraPorts = {
  readonly moduleId: 'saga-infra';
  readonly copyNativeSagaDefinition: (
    actor: Actor,
    sourceSagaId: string,
  ) => SagaInfraResult<{ readonly sagaId: string; readonly versionId: string }>;
  readonly createProjectFromSagaVersion: (
    actor: Actor,
    sagaId: string,
    versionId: string,
    name?: string | null,
  ) => SagaInfraResult<{ readonly id: string; readonly publicId: string }>;
  readonly createUserSagaDefinition: (
    actor: Actor,
    title: string,
    blurb?: string,
  ) => SagaInfraResult<{
    readonly sagaId: string;
    readonly versionId: string;
    readonly revision: number;
  }>;
  readonly duplicateSagaPlaythrough: (
    actor: Actor,
    projectId: string,
    mode?: string | null,
  ) => SagaInfraResult<{ readonly id: string; readonly publicId: string }>;
  readonly getNativeSagaDefinitionBySlug: (
    actor: Actor,
    slug: string,
  ) => SagaInfraResult<Readonly<Record<string, unknown>>>;
  readonly getSagaDefinitionEditor: (
    actor: Actor,
    sagaId: string,
  ) => SagaInfraResult<Readonly<Record<string, unknown>>>;
  readonly getSagaDefinitionVersion: (
    actor: Actor,
    versionId: string,
  ) => SagaInfraResult<Readonly<Record<string, unknown>>>;
  readonly promoteSessionOutcomeToSaga: (
    actor: Actor,
    sessionId: string,
    consequenceId: string,
  ) => SagaInfraResult<Readonly<Record<string, unknown>>>;
  readonly promoteSessionOutcomeToWorld: (
    actor: Actor,
    sessionId: string,
    consequenceId: string,
  ) => SagaInfraResult<Readonly<Record<string, unknown>>>;
  readonly publishSagaDefinitionVersion: (
    actor: Actor,
    sagaId: string,
    expectedRevision: number,
  ) => SagaInfraResult<{
    readonly sagaId: string;
    readonly versionId: string;
    readonly versionLabel: string;
    readonly revision: number;
  }>;
  readonly saveSagaDefinitionDraft: (
    actor: Actor,
    sagaId: string,
    payload: Record<string, unknown>,
    expectedRevision: number,
  ) => SagaInfraResult<{
    readonly sagaId: string;
    readonly versionId: string;
    readonly revision: number;
    readonly payload: Record<string, unknown>;
  }>;
};

function mapOkValue<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string },
): SagaInfraResult<T> {
  if (result.ok) return { ok: true, value: result.value };
  return { ok: false, error: result.error };
}

function mapProject(
  result:
    | { readonly ok: true; readonly value: { readonly id: string; readonly publicId: string } }
    | { readonly ok: false; readonly error: string },
): SagaInfraResult<{ readonly id: string; readonly publicId: string }> {
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    value: { id: result.value.id, publicId: result.value.publicId },
  };
}

export function createSagaInfraPorts(deps: {
  readonly saga: SagaPorts;
  readonly project: ProjectPorts;
  readonly world: WorldPorts;
}): SagaInfraPorts {
  const copyNative = copy_native_saga_definition(deps.saga);
  const createProject = create_project_from_saga_version({
    saga: deps.saga,
    project: deps.project,
    world: deps.world,
  });
  const createUser = create_user_saga_definition(deps.saga);
  const duplicate = duplicate_saga_playthrough({
    saga: deps.saga,
    project: deps.project,
    world: deps.world,
  });
  const getNativeBySlug = get_native_saga_definition_by_slug(deps.saga);
  const getEditor = get_saga_definition_editor(deps.saga);
  const getVersion = get_saga_definition_version(deps.saga);
  const promoteSaga = promote_session_outcome_to_saga(deps.saga);
  const promoteWorld = promote_session_outcome_to_world(deps.saga);
  const publish = publish_saga_definition_version(deps.saga);
  const saveDraft = save_saga_definition_draft(deps.saga);

  return {
    moduleId: 'saga-infra',
    copyNativeSagaDefinition: (actor, sourceSagaId) =>
      mapOkValue(copyNative(actor, sourceSagaId)),
    createProjectFromSagaVersion: (actor, sagaId, versionId, name) =>
      mapProject(createProject(actor, sagaId, versionId, name)),
    createUserSagaDefinition: (actor, title, blurb) =>
      mapOkValue(createUser(actor, title, blurb)),
    duplicateSagaPlaythrough: (actor, projectId, mode) =>
      mapProject(duplicate(actor, projectId, mode)),
    getNativeSagaDefinitionBySlug: (actor, slug) => mapOkValue(getNativeBySlug(actor, slug)),
    getSagaDefinitionEditor: (actor, sagaId) => mapOkValue(getEditor(actor, sagaId)),
    getSagaDefinitionVersion: (actor, versionId) => mapOkValue(getVersion(actor, versionId)),
    promoteSessionOutcomeToSaga: (actor, sessionId, consequenceId) =>
      mapOkValue(promoteSaga(actor, sessionId, consequenceId)),
    promoteSessionOutcomeToWorld: (actor, sessionId, consequenceId) =>
      mapOkValue(promoteWorld(actor, sessionId, consequenceId)),
    publishSagaDefinitionVersion: (actor, sagaId, expectedRevision) =>
      mapOkValue(publish(actor, sagaId, expectedRevision)),
    saveSagaDefinitionDraft: (actor, sagaId, payload, expectedRevision) =>
      mapOkValue(saveDraft(actor, sagaId, payload, expectedRevision)),
  };
}

export function createSagaInfraPortsStub(): SagaInfraPorts {
  const fail = (): SagaInfraResult<never> => ({
    ok: false,
    error: 'store-unavailable',
  });
  return {
    moduleId: 'saga-infra',
    copyNativeSagaDefinition: fail,
    createProjectFromSagaVersion: fail,
    createUserSagaDefinition: fail,
    duplicateSagaPlaythrough: fail,
    getNativeSagaDefinitionBySlug: fail,
    getSagaDefinitionEditor: fail,
    getSagaDefinitionVersion: fail,
    promoteSessionOutcomeToSaga: fail,
    promoteSessionOutcomeToWorld: fail,
    publishSagaDefinitionVersion: fail,
    saveSagaDefinitionDraft: fail,
  };
}
