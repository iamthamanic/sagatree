/**
 * project-infra ports — composed host surface for all 11 infra-project RPCs (MIG-308 / #807).
 * Location: server/src/application/project-infra/index.ts
 *
 * Application-layer binder over predecessor use-cases. No HTTP mount in this slice.
 * FE dual-path seam mirrors these ops via host-project-ports.contract.ts.
 */
import type { Actor } from '../../modules/identity/index.ts';
import type { CharacterPorts } from '../../modules/character/index.ts';
import type { PermissionsPorts } from '../../modules/permissions/index.ts';
import type { ProjectPorts } from '../../modules/project/index.ts';
import type { SagaPorts } from '../../modules/saga/index.ts';
import type { SessionPorts } from '../../modules/session/index.ts';
import type { WorldPorts } from '../../modules/world/index.ts';
import { create_project_session } from '../commands/create_project_session.ts';
import { ensure_native_starter_project } from '../commands/ensure_native_starter_project.ts';
import { get_my_saga_permissions } from '../commands/get_my_saga_permissions.ts';
import { get_saga_lore_timeline } from '../commands/get_saga_lore_timeline.ts';
import { get_saga_overview } from '../commands/get_saga_overview.ts';
import { join_project_by_code } from '../commands/join_project_by_code.ts';
import { list_saga_bindings } from '../commands/list_saga_bindings.ts';
import { list_saga_member_permission_state } from '../commands/list_saga_member_permission_state.ts';
import { set_my_project_character } from '../commands/set_my_project_character.ts';
import { set_saga_binding_reveal } from '../commands/set_saga_binding_reveal.ts';
import { set_saga_member_bundle } from '../commands/set_saga_member_bundle.ts';

export type ProjectInfraResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly detail?: string };

export type ProjectInfraPorts = {
  readonly moduleId: 'project-infra';
  readonly createProjectSession: (
    actor: Actor,
    projectId: string,
    name?: string | null,
    notes?: string | null,
  ) => ProjectInfraResult<Readonly<Record<string, unknown>> & { id: string; projectId: string }>;
  readonly ensureNativeStarterProject: (
    actor: Actor,
    slug?: string | null,
  ) => ProjectInfraResult<
    Readonly<Record<string, unknown>> & { id: string; publicId: string; created: boolean }
  >;
  readonly getMySagaPermissions: (
    actor: Actor,
    publicId: string,
  ) => ProjectInfraResult<
    Readonly<Record<string, unknown>> & {
      projectId: string;
      isGm: boolean;
      keys: readonly string[];
    }
  >;
  readonly getSagaLoreTimeline: (
    actor: Actor,
    publicId: string,
  ) => ProjectInfraResult<Readonly<Record<string, unknown>>>;
  readonly getSagaOverview: (
    actor: Actor,
    publicId: string,
  ) => ProjectInfraResult<Readonly<Record<string, unknown>>>;
  readonly joinProjectByCode: (
    actor: Actor,
    code: string,
    characterId?: string | null,
  ) => ProjectInfraResult<{ readonly projectId: string }>;
  readonly listSagaBindings: (
    actor: Actor,
    publicId: string,
    assetKind?: string | null,
  ) => ProjectInfraResult<readonly (Readonly<Record<string, unknown>> & { id: string })[]>;
  readonly listSagaMemberPermissionState: (
    actor: Actor,
    publicId: string,
  ) => ProjectInfraResult<
    readonly (Readonly<Record<string, unknown>> & { memberId: string; userId: string })[]
  >;
  readonly setMyProjectCharacter: (
    actor: Actor,
    projectId: string,
    characterId?: string | null,
  ) => ProjectInfraResult<{ readonly memberId: string }>;
  readonly setSagaBindingReveal: (
    actor: Actor,
    projectId: string,
    bindingId: string,
    reveal: string,
  ) => ProjectInfraResult<Readonly<Record<string, unknown>> & { id: string }>;
  readonly setSagaMemberBundle: (
    actor: Actor,
    projectId: string,
    memberId: string,
    bundleId: string,
  ) => ProjectInfraResult<Readonly<Record<string, unknown>>>;
};

function mapJoin(
  result:
    | { readonly ok: true; readonly projectId: string }
    | { readonly ok: false; readonly error: string; readonly detail?: string },
): ProjectInfraResult<{ readonly projectId: string }> {
  if (result.ok) return { ok: true, value: { projectId: result.projectId } };
  return { ok: false, error: result.error, detail: result.detail };
}

function mapMemberId(
  result: { readonly ok: true; readonly memberId: string } | { readonly ok: false; readonly error: string },
): ProjectInfraResult<{ readonly memberId: string }> {
  if (result.ok) return { ok: true, value: { memberId: result.memberId } };
  return { ok: false, error: result.error };
}

function mapOkValue<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string },
): ProjectInfraResult<T> {
  if (result.ok) return { ok: true, value: result.value };
  return { ok: false, error: result.error };
}

function mapSession(
  result:
    | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
    | { readonly ok: false; readonly error: string },
): ProjectInfraResult<Readonly<Record<string, unknown>> & { id: string; projectId: string }> {
  if (!result.ok) return { ok: false, error: result.error };
  const value = result.value;
  const id =
    typeof value.sessionId === 'string'
      ? value.sessionId
      : typeof value.id === 'string'
        ? value.id
        : '';
  const projectId =
    typeof value.projectId === 'string'
      ? value.projectId
      : typeof value.project_id === 'string'
        ? value.project_id
        : '';
  if (!id || !projectId) return { ok: false, error: 'P0002' };
  return { ok: true, value: { ...value, id, projectId } };
}

export function createProjectInfraPorts(deps: {
  readonly project: ProjectPorts;
  readonly character: CharacterPorts;
  readonly saga: SagaPorts;
  readonly world: WorldPorts;
  readonly permissions: PermissionsPorts;
  readonly session: SessionPorts;
}): ProjectInfraPorts {
  const createSession = create_project_session(deps.session);
  const ensureStarter = ensure_native_starter_project({
    saga: deps.saga,
    project: deps.project,
    world: deps.world,
  });
  const getPerms = get_my_saga_permissions({ permissions: deps.permissions });
  const getLore = get_saga_lore_timeline(deps.saga);
  const getOverview = get_saga_overview(deps.saga);
  const joinByCode = join_project_by_code({
    project: deps.project,
    character: deps.character,
  });
  const listBindings = list_saga_bindings({ permissions: deps.permissions });
  const listMembers = list_saga_member_permission_state({ permissions: deps.permissions });
  const setCharacter = set_my_project_character({
    project: deps.project,
    character: deps.character,
  });
  const setReveal = set_saga_binding_reveal({ permissions: deps.permissions });
  const setBundle = set_saga_member_bundle({ permissions: deps.permissions });

  return {
    moduleId: 'project-infra',
    createProjectSession: (actor, projectId, name, notes) =>
      mapSession(createSession(actor, projectId, name, notes)),
    ensureNativeStarterProject: (actor, slug) => mapOkValue(ensureStarter(actor, slug)),
    getMySagaPermissions: (actor, publicId) => mapOkValue(getPerms(actor, publicId)),
    getSagaLoreTimeline: (actor, publicId) => mapOkValue(getLore(actor, publicId)),
    getSagaOverview: (actor, publicId) => mapOkValue(getOverview(actor, publicId)),
    joinProjectByCode: (actor, code, characterId) =>
      mapJoin(joinByCode(actor, code, characterId)),
    listSagaBindings: (actor, publicId, assetKind) =>
      mapOkValue(listBindings(actor, publicId, assetKind)),
    listSagaMemberPermissionState: (actor, publicId) =>
      mapOkValue(listMembers(actor, publicId)),
    setMyProjectCharacter: (actor, projectId, characterId) =>
      mapMemberId(setCharacter(actor, projectId, characterId)),
    setSagaBindingReveal: (actor, projectId, bindingId, reveal) =>
      mapOkValue(setReveal(actor, projectId, bindingId, reveal)),
    setSagaMemberBundle: (actor, projectId, memberId, bundleId) =>
      mapOkValue(setBundle(actor, projectId, memberId, bundleId)),
  };
}

export function createProjectInfraPortsStub(): ProjectInfraPorts {
  const fail = (): ProjectInfraResult<never> => ({
    ok: false,
    error: 'store-unavailable',
  });
  return {
    moduleId: 'project-infra',
    createProjectSession: fail,
    ensureNativeStarterProject: fail,
    getMySagaPermissions: fail,
    getSagaLoreTimeline: fail,
    getSagaOverview: fail,
    joinProjectByCode: fail,
    listSagaBindings: fail,
    listSagaMemberPermissionState: fail,
    setMyProjectCharacter: fail,
    setSagaBindingReveal: fail,
    setSagaMemberBundle: fail,
  };
}
