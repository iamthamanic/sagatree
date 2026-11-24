# Infrastructure contract: saga

**Status: SPEC; current branch source verified.** Implementation issue: **#809**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-saga.json](source-contracts/infra-saga.json) (SHA-256 `b2913dcdd3d89fa80da10af3334295d81ee0a4d2ca7c1ae20165028edc4dc378`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Saga definition editor/draft/version/publish/copy and project-from-version/duplicate plus session outcome promotion use RPC facades.

Published version read, owner draft edit and GM outcome promotion have distinct policies; never return private draft content through version/public slug path.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (0): none.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 0.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|


## Acceptance and negative tests (required, not executed)

- Create/edit/save/publish/read version/copy native and instantiate project with stable IDs and version snapshot.
- Duplicate saga playthrough and promote allowed session outcomes retain side effects and deny foreign owner/GM.
- All11 RPCs, including promote_session_outcome_to_saga and promote_session_outcome_to_world through the typed callPromote helper, must be mapped and available.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

This area has no RPC, Edge, table, storage, realtime, fetch or auth calls. Its public browser processing/worker API is retained in the complete public declarations.

## Complete public declarations and facade operation contracts

### src/infrastructure/saga/host-saga-adapter.ts:12

```ts
export type HostSagaAdapter = HostSagaPorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_SAGA_OPS;
  readonly rpcNames: typeof HOST_SAGA_RPC_NAMES;
};
```

### src/infrastructure/saga/host-saga-adapter.ts:22

```ts
export function createHostSagaAdapter(ports: HostSagaPorts): HostSagaAdapter {
  return {
    transport: 'host',
    ops: HOST_SAGA_OPS,
    rpcNames: HOST_SAGA_RPC_NAMES,
    copyNativeSagaDefinition: (actorId, sourceSagaId) =>
      ports.copyNativeSagaDefinition(actorId, sourceSagaId),
    createProjectFromSagaVersion: (actorId, sagaId, versionId, name) =>
      ports.createProjectFromSagaVersion(actorId, sagaId, versionId, name),
    createUserSagaDefinition: (actorId, title, blurb) =>
      ports.createUserSagaDefinition(actorId, title, blurb),
    duplicateSagaPlaythrough: (actorId, projectId, mode) =>
      ports.duplicateSagaPlaythrough(actorId, projectId, mode),
    getNativeSagaDefinitionBySlug: (actorId, slug) =>
      ports.getNativeSagaDefinitionBySlug(actorId, slug),
    getSagaDefinitionEditor: (actorId, sagaId) =>
      ports.getSagaDefinitionEditor(actorId, sagaId),
    getSagaDefinitionVersion: (actorId, versionId) =>
      ports.getSagaDefinitionVersion(actorId, versionId),
    promoteSessionOutcomeToSaga: (actorId, sessionId, consequenceId) =>
      ports.promoteSessionOutcomeToSaga(actorId, sessionId, consequenceId),
    promoteSessionOutcomeToWorld: (actorId, sessionId, consequenceId) =>
      ports.promoteSessionOutcomeToWorld(actorId, sessionId, consequenceId),
    publishSagaDefinitionVersion: (actorId, sagaId, expectedRevision) =>
      ports.publishSagaDefinitionVersion(actorId, sagaId, expectedRevision),
    saveSagaDefinitionDraft: (actorId, sagaId, payload, expectedRevision) =>
      ports.saveSagaDefinitionDraft(actorId, sagaId, payload, expectedRevision),
  };
}
```

### src/infrastructure/saga/host-saga-ports.contract.ts:10

```ts
export type HostSagaResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly detail?: string };
```

### src/infrastructure/saga/host-saga-ports.contract.ts:15

```ts
export type HostSagaIdVm = {
  readonly sagaId: string;
  readonly versionId?: string;
  readonly revision?: number;
};
```

### src/infrastructure/saga/host-saga-ports.contract.ts:21

```ts
export type HostSagaProjectVm = {
  readonly id: string;
  readonly publicId: string;
};
```

### src/infrastructure/saga/host-saga-ports.contract.ts:26

```ts
export type HostSagaEditorVm = Readonly<Record<string, unknown>> & {
  readonly sagaId: string;
  readonly canEdit: boolean;
};
```

### src/infrastructure/saga/host-saga-ports.contract.ts:31

```ts
export type HostSagaVersionVm = Readonly<Record<string, unknown>>;
```

### src/infrastructure/saga/host-saga-ports.contract.ts:32

```ts
export type HostPromoteVm = Readonly<Record<string, unknown>>;
```

### src/infrastructure/saga/host-saga-ports.contract.ts:38

```ts
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
```

### src/infrastructure/saga/host-saga-ports.contract.ts:115

```ts
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
```

### src/infrastructure/saga/host-saga-ports.contract.ts:129

```ts
export type HostSagaRpcName = (typeof HOST_SAGA_RPC_NAMES)[number];
```

### src/infrastructure/saga/host-saga-ports.contract.ts:132

```ts
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
```

### src/infrastructure/saga/host-saga-ports.contract.ts:146

```ts
export type HostSagaOp = (typeof HOST_SAGA_OPS)[number];
```

### src/infrastructure/saga/saga-definition-service.ts:101

```ts
export const sagaDefinitionService = new SagaDefinitionService();
```

### src/infrastructure/saga/session-outcome-promotion-service.ts:53

```ts
export const sessionOutcomePromotionService = {
  promoteToSaga(sessionId: string, consequenceId: string): Promise<PromoteRpcResult> {
    return callPromote('saga', sessionId, consequenceId);
  },
  promoteToWorld(sessionId: string, consequenceId: string): Promise<PromoteRpcResult> {
    return callPromote('world', sessionId, consequenceId);
  },
};
```


## Remaining backend helper operations

All backend operations are included in the public declarations above.

## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/saga/contracts/saga-definition.ts` | `2c1509cf4f9026dff9f39cd4548e10a4fba1132f4ed53ff4f58fe71babe692b5` |
| `src/domains/session/contracts/session-outcome-promotion.ts` | `6354ee19535827055e5d4464d4698a498c7cb3d4c2511044d7948889fc56990a` |
| `src/infrastructure/host/host-library-http.ts` | `7f909cafd35ac7fab15a90f37dd6164390fbac5b85d915618a1f46138b7d852a` |
| `src/infrastructure/host/host-saga-definition-http.ts` | `3bf857114def303681691297c71f09a9b6278658e51cad659f0d7e51e0a819f1` |
| `src/infrastructure/host/host-session-http.ts` | `f0e603ecf93151669c7b809cb63aea3d0a98ed2ca17ae8f2768a5444bb9cab56` |
| `src/infrastructure/saga/host-saga-adapter.ts` | `e28c482990d2b48ef1d68e56555251ab33f1a247aa2b60b45bd690cc10c71ca4` |
| `src/infrastructure/saga/host-saga-ports.contract.ts` | `4fe987e282d94e22a2fd33d688bbbff7b4e4327c600c8a34bc9d376d3139e47f` |
| `src/infrastructure/saga/saga-definition-service.ts` | `758929f1748a796774d5cf957bd92f780a836562c7a27c3d6b3757a764ddc8dc` |
| `src/infrastructure/saga/session-outcome-promotion-service.ts` | `b998cb8c4294c8933e3aaf2622f747a9461f18815af77a5cdd58314a94bd107f` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |

