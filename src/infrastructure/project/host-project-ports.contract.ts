/**
 * Host-aligned project ports contract (MIG-308 / #807).
 * Location: src/infrastructure/project/host-project-ports.contract.ts
 *
 * Transport-free DTO mirror of the 11 infra-project RPCs composed by host
 * `createProjectInfraPorts`. Supabase facades remain live until cutover; this
 * documents the host shape for parity checks without importing the Node host.
 */

export type HostProjectResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly detail?: string };

/** Opaque host VMs — field names align with predecessor RPC contracts. */
export type HostProjectSessionVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly projectId: string;
};

export type HostStarterProjectVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly publicId: string;
  readonly created: boolean;
};

export type HostSagaPermissionsVm = Readonly<Record<string, unknown>> & {
  readonly projectId: string;
  readonly isGm: boolean;
  readonly keys: readonly string[];
};

export type HostSagaOverviewVm = Readonly<Record<string, unknown>>;
export type HostSagaLoreTimelineVm = Readonly<Record<string, unknown>>;
export type HostSagaBindingVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
};
export type HostSagaMemberPermissionStateVm = Readonly<Record<string, unknown>> & {
  readonly memberId: string;
  readonly userId: string;
};

/**
 * Actor id is the verified host actor — never a client-claimed owner/GM.
 * Ports mirror host createProjectInfraPorts surface (no HTTP in this slice).
 */
export type HostProjectPorts = {
  readonly createProjectSession: (
    actorId: string,
    projectId: string,
    name?: string | null,
    notes?: string | null,
  ) => Promise<HostProjectResult<HostProjectSessionVm>>;
  readonly ensureNativeStarterProject: (
    actorId: string,
    slug?: string | null,
  ) => Promise<HostProjectResult<HostStarterProjectVm>>;
  readonly getMySagaPermissions: (
    actorId: string,
    publicId: string,
  ) => Promise<HostProjectResult<HostSagaPermissionsVm>>;
  readonly getSagaLoreTimeline: (
    actorId: string,
    publicId: string,
  ) => Promise<HostProjectResult<HostSagaLoreTimelineVm>>;
  readonly getSagaOverview: (
    actorId: string,
    publicId: string,
  ) => Promise<HostProjectResult<HostSagaOverviewVm>>;
  readonly joinProjectByCode: (
    actorId: string,
    code: string,
    characterId?: string | null,
  ) => Promise<HostProjectResult<{ readonly projectId: string }>>;
  readonly listSagaBindings: (
    actorId: string,
    publicId: string,
    assetKind?: string | null,
  ) => Promise<HostProjectResult<readonly HostSagaBindingVm[]>>;
  readonly listSagaMemberPermissionState: (
    actorId: string,
    publicId: string,
  ) => Promise<HostProjectResult<readonly HostSagaMemberPermissionStateVm[]>>;
  readonly setMyProjectCharacter: (
    actorId: string,
    projectId: string,
    characterId?: string | null,
  ) => Promise<HostProjectResult<{ readonly memberId: string }>>;
  readonly setSagaBindingReveal: (
    actorId: string,
    projectId: string,
    bindingId: string,
    reveal: string,
  ) => Promise<HostProjectResult<HostSagaBindingVm>>;
  readonly setSagaMemberBundle: (
    actorId: string,
    projectId: string,
    memberId: string,
    bundleId: string,
  ) => Promise<HostProjectResult<Readonly<Record<string, unknown>>>>;
};

/** Canonical RPC names from infra-project inventory — 1:1 with host commands. */
export const HOST_PROJECT_RPC_NAMES = [
  'create_project_session',
  'ensure_native_starter_project',
  'get_my_saga_permissions',
  'get_saga_lore_timeline',
  'get_saga_overview',
  'join_project_by_code',
  'list_saga_bindings',
  'list_saga_member_permission_state',
  'set_my_project_character',
  'set_saga_binding_reveal',
  'set_saga_member_bundle',
] as const;

export type HostProjectRpcName = (typeof HOST_PROJECT_RPC_NAMES)[number];

/** Stable camelCase op names for composition / future HTTP cutover documentation. */
export const HOST_PROJECT_OPS = [
  'createProjectSession',
  'ensureNativeStarterProject',
  'getMySagaPermissions',
  'getSagaLoreTimeline',
  'getSagaOverview',
  'joinProjectByCode',
  'listSagaBindings',
  'listSagaMemberPermissionState',
  'setMyProjectCharacter',
  'setSagaBindingReveal',
  'setSagaMemberBundle',
] as const;

export type HostProjectOp = (typeof HOST_PROJECT_OPS)[number];
