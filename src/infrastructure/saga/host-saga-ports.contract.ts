/**
 * Host-aligned saga ports contract (MIG-310 / #809).
 * Location: src/infrastructure/saga/host-saga-ports.contract.ts
 *
 * Transport-free DTO mirror of the 11 infra-saga RPCs composed by host
 * `createSagaInfraPorts`. Supabase facades remain live until cutover; this
 * documents the host shape for parity checks without importing the Node host.
 */

export type HostSagaResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly detail?: string };

/** Opaque host VMs — field names align with predecessor RPC contracts. */
export type HostSagaIdVm = {
  readonly sagaId: string;
  readonly versionId?: string;
  readonly revision?: number;
};

export type HostSagaProjectVm = {
  readonly id: string;
  readonly publicId: string;
};

export type HostSagaEditorVm = Readonly<Record<string, unknown>> & {
  readonly sagaId: string;
  readonly canEdit: boolean;
};

export type HostSagaVersionVm = Readonly<Record<string, unknown>>;
export type HostPromoteVm = Readonly<Record<string, unknown>>;

/**
 * Actor id is the verified host actor — never a client-claimed owner/GM.
 * Ports mirror host createSagaInfraPorts surface (no HTTP in this slice).
 */
export type HostSagaPorts = {
  readonly copyNativeSagaDefinition: (
    actorId: string,
    sourceSagaId: string,
  ) => Promise<HostSagaResult<{ readonly sagaId: string; readonly versionId: string }>>;
  readonly createProjectFromSagaVersion: (
    actorId: string,
    sagaId: string,
    versionId: string,
    name?: string | null,
  ) => Promise<HostSagaResult<HostSagaProjectVm>>;
  readonly createUserSagaDefinition: (
    actorId: string,
    title: string,
    blurb?: string,
  ) => Promise<
    HostSagaResult<{
      readonly sagaId: string;
      readonly versionId: string;
      readonly revision: number;
    }>
  >;
  readonly duplicateSagaPlaythrough: (
    actorId: string,
    projectId: string,
    mode?: string | null,
  ) => Promise<HostSagaResult<HostSagaProjectVm>>;
  readonly getNativeSagaDefinitionBySlug: (
    actorId: string,
    slug: string,
  ) => Promise<HostSagaResult<HostSagaVersionVm>>;
  readonly getSagaDefinitionEditor: (
    actorId: string,
    sagaId: string,
  ) => Promise<HostSagaResult<HostSagaEditorVm>>;
  readonly getSagaDefinitionVersion: (
    actorId: string,
    versionId: string,
  ) => Promise<HostSagaResult<HostSagaVersionVm>>;
  readonly promoteSessionOutcomeToSaga: (
    actorId: string,
    sessionId: string,
    consequenceId: string,
  ) => Promise<HostSagaResult<HostPromoteVm>>;
  readonly promoteSessionOutcomeToWorld: (
    actorId: string,
    sessionId: string,
    consequenceId: string,
  ) => Promise<HostSagaResult<HostPromoteVm>>;
  readonly publishSagaDefinitionVersion: (
    actorId: string,
    sagaId: string,
    expectedRevision: number,
  ) => Promise<
    HostSagaResult<{
      readonly sagaId: string;
      readonly versionId: string;
      readonly versionLabel: string;
      readonly revision: number;
    }>
  >;
  readonly saveSagaDefinitionDraft: (
    actorId: string,
    sagaId: string,
    payload: Record<string, unknown>,
    expectedRevision: number,
  ) => Promise<
    HostSagaResult<{
      readonly sagaId: string;
      readonly versionId: string;
      readonly revision: number;
      readonly payload: Record<string, unknown>;
    }>
  >;
};

/** Canonical RPC names from infra-saga inventory — 1:1 with host commands. */
export const HOST_SAGA_RPC_NAMES = [
  'copy_native_saga_definition',
  'create_project_from_saga_version',
  'create_user_saga_definition',
  'duplicate_saga_playthrough',
  'get_native_saga_definition_by_slug',
  'get_saga_definition_editor',
  'get_saga_definition_version',
  'promote_session_outcome_to_saga',
  'promote_session_outcome_to_world',
  'publish_saga_definition_version',
  'save_saga_definition_draft',
] as const;

export type HostSagaRpcName = (typeof HOST_SAGA_RPC_NAMES)[number];

/** Stable camelCase op names for composition / future HTTP cutover documentation. */
export const HOST_SAGA_OPS = [
  'copyNativeSagaDefinition',
  'createProjectFromSagaVersion',
  'createUserSagaDefinition',
  'duplicateSagaPlaythrough',
  'getNativeSagaDefinitionBySlug',
  'getSagaDefinitionEditor',
  'getSagaDefinitionVersion',
  'promoteSessionOutcomeToSaga',
  'promoteSessionOutcomeToWorld',
  'publishSagaDefinitionVersion',
  'saveSagaDefinitionDraft',
] as const;

export type HostSagaOp = (typeof HOST_SAGA_OPS)[number];
