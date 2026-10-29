# Infrastructure contract: saga

**Status: SPEC; current branch source verified.** Implementation issue: **#809**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-saga.json](source-contracts/infra-saga.json) (SHA-256 `16534dec6ca81e00d3bdf75428df0b09e825933ce23aabcdc73f103b9c043d8d`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Saga definition editor/draft/version/publish/copy and project-from-version/duplicate plus session outcome promotion use RPC facades.

Published version read, owner draft edit and GM outcome promotion have distinct policies; never return private draft content through version/public slug path.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (11): `copy_native_saga_definition`, `create_project_from_saga_version`, `create_user_saga_definition`, `duplicate_saga_playthrough`, `get_native_saga_definition_by_slug`, `get_saga_definition_editor`, `get_saga_definition_version`, `promote_session_outcome_to_saga`, `promote_session_outcome_to_world`, `publish_saga_definition_version`, `save_saga_definition_draft`.

Tables (0): none.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 0.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `copy_native_saga_definition` | #815 | RPC-SAGA-AUTHORING |
| rpc | `create_project_from_saga_version` | #815 | RPC-SAGA-PROVISION |
| rpc | `create_user_saga_definition` | #815 | RPC-SAGA-AUTHORING |
| rpc | `duplicate_saga_playthrough` | #815 | RPC-SAGA-PROVISION |
| rpc | `get_native_saga_definition_by_slug` | #815 | RPC-SAGA-VERSION-READ |
| rpc | `get_saga_definition_editor` | #815 | RPC-SAGA-AUTHORING |
| rpc | `get_saga_definition_version` | #815 | RPC-SAGA-VERSION-READ |
| rpc | `promote_session_outcome_to_saga` | #815 | RPC-SAGA-PROJECTIONS |
| rpc | `promote_session_outcome_to_world` | #815 | RPC-SAGA-PROJECTIONS |
| rpc | `publish_saga_definition_version` | #815 | RPC-SAGA-AUTHORING |
| rpc | `save_saga_definition_draft` | #815 | RPC-SAGA-AUTHORING |
| auth | `authenticated account/session transport` | #793 |  |

## Acceptance and negative tests (required, not executed)

- Create/edit/save/publish/read version/copy native and instantiate project with stable IDs and version snapshot.
- Duplicate saga playthrough and promote allowed session outcomes retain side effects and deny foreign owner/GM.
- All11 RPCs, including promote_session_outcome_to_saga and promote_session_outcome_to_world through the typed callPromote helper, must be mapped and available.
- Contract fixture for copy_native_saga_definition: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for create_project_from_saga_version: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for create_user_saga_definition: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for duplicate_saga_playthrough: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for get_native_saga_definition_by_slug: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for get_saga_definition_editor: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for get_saga_definition_version: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for promote_session_outcome_to_saga: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for promote_session_outcome_to_world: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for publish_saga_definition_version: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for save_saga_definition_draft: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### rpc: get_saga_definition_version

`src/infrastructure/saga/saga-definition-service.ts:23` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('get_saga_definition_version', { p_version_id: versionId })
```

Enclosing operation: `src/infrastructure/saga/saga-definition-service.ts:21`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: get_native_saga_definition_by_slug

`src/infrastructure/saga/saga-definition-service.ts:35` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('get_native_saga_definition_by_slug', { p_slug: slug })
```

Enclosing operation: `src/infrastructure/saga/saga-definition-service.ts:33`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: get_saga_definition_editor

`src/infrastructure/saga/saga-definition-service.ts:47` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('get_saga_definition_editor', { p_saga_id: sagaId })
```

Enclosing operation: `src/infrastructure/saga/saga-definition-service.ts:45`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: save_saga_definition_draft

`src/infrastructure/saga/saga-definition-service.ts:64` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('save_saga_definition_draft', {
        p_saga_id: input.sagaId,
        p_payload: payload,
        p_expected_revision: input.expectedRevision,
      })
```

Enclosing operation: `src/infrastructure/saga/saga-definition-service.ts:57`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: publish_saga_definition_version

`src/infrastructure/saga/saga-definition-service.ts:90` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('publish_saga_definition_version', {
        p_saga_id: input.sagaId,
        p_expected_revision: input.expectedRevision,
      })
```

Enclosing operation: `src/infrastructure/saga/saga-definition-service.ts:85`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: copy_native_saga_definition

`src/infrastructure/saga/saga-definition-service.ts:115` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('copy_native_saga_definition', { p_source_saga_id: sourceSagaId })
```

Enclosing operation: `src/infrastructure/saga/saga-definition-service.ts:113`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: create_user_saga_definition

`src/infrastructure/saga/saga-definition-service.ts:137` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('create_user_saga_definition', {
        p_title: input.title,
        p_blurb: input.blurb ?? '',
      })
```

Enclosing operation: `src/infrastructure/saga/saga-definition-service.ts:132`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: create_project_from_saga_version

`src/infrastructure/saga/saga-definition-service.ts:163` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('create_project_from_saga_version', {
        p_saga_id: input.sagaId,
        p_version_id: input.versionId,
        p_name: input.name ?? null,
      })
```

Enclosing operation: `src/infrastructure/saga/saga-definition-service.ts:157`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: duplicate_saga_playthrough

`src/infrastructure/saga/saga-definition-service.ts:195` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('duplicate_saga_playthrough', {
        p_project_id: input.projectId,
        p_mode: input.mode,
      })
```

Enclosing operation: `src/infrastructure/saga/saga-definition-service.ts:190`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: promote_session_outcome_to_saga

`src/infrastructure/saga/session-outcome-promotion-service.ts:20` — finite-literal-union.

Exact call/query chain:
```ts
supabase.rpc(rpc, {
    p_session_id: sessionId,
    p_consequence_id: consequenceId,
  })
```

Enclosing operation: `src/infrastructure/saga/session-outcome-promotion-service.ts:15`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: promote_session_outcome_to_world

`src/infrastructure/saga/session-outcome-promotion-service.ts:20` — finite-literal-union.

Exact call/query chain:
```ts
supabase.rpc(rpc, {
    p_session_id: sessionId,
    p_consequence_id: consequenceId,
  })
```

Enclosing operation: `src/infrastructure/saga/session-outcome-promotion-service.ts:15`; complete request/default/result/error logic is in the declarations below and the snapshot.

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

### src/infrastructure/saga/saga-definition-service.ts:220

```ts
export const sagaDefinitionService = new SagaDefinitionService();
```

### src/infrastructure/saga/session-outcome-promotion-service.ts:34

```ts
export const sessionOutcomePromotionService = {
  promoteToSaga(sessionId: string, consequenceId: string): Promise<PromoteRpcResult> {
    return callPromote('promote_session_outcome_to_saga', sessionId, consequenceId);
  },
  promoteToWorld(sessionId: string, consequenceId: string): Promise<PromoteRpcResult> {
    return callPromote('promote_session_outcome_to_world', sessionId, consequenceId);
  },
};
```


## Remaining backend helper operations

### src/infrastructure/saga/saga-definition-service.ts:21

```ts
async getVersionById(versionId: string): Promise<SagaDefinitionVersionVm> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_saga_definition_version', { p_version_id: versionId }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Saga-Definition Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Saga-Definition konnte nicht geladen werden');
    }
    return parseSagaDefinitionVersion(data);
  }
```

### src/infrastructure/saga/saga-definition-service.ts:33

```ts
async getNativeBySlug(slug: string): Promise<SagaDefinitionVersionVm> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_native_saga_definition_by_slug', { p_slug: slug }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Native Saga Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Native Saga konnte nicht geladen werden');
    }
    return parseSagaDefinitionVersion(data);
  }
```

### src/infrastructure/saga/saga-definition-service.ts:45

```ts
async getEditor(sagaId: string): Promise<SagaDefinitionEditorVm> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_saga_definition_editor', { p_saga_id: sagaId }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Saga-Editor Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Saga-Editor konnte nicht geladen werden');
    }
    return parseSagaDefinitionEditor(data);
  }
```

### src/infrastructure/saga/saga-definition-service.ts:57

```ts
async saveDraft(input: {
    readonly sagaId: string;
    readonly draft: SagaDefinitionDraft;
    readonly expectedRevision: number;
  }): Promise<{ readonly revision: number; readonly versionId: string }> {
    const payload = draftToPayload(input.draft);
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('save_saga_definition_draft', {
        p_saga_id: input.sagaId,
        p_payload: payload,
        p_expected_revision: input.expectedRevision,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Speichern Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Entwurf konnte nicht gespeichert werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Speicher-Antwort');
    }
    const row = data as { revision?: number; versionId?: string };
    if (typeof row.revision !== 'number' || typeof row.versionId !== 'string') {
      throw new Error('Speicher-Antwort unvollständig');
    }
    return { revision: row.revision, versionId: row.versionId };
  }
```

### src/infrastructure/saga/saga-definition-service.ts:85

```ts
async publishVersion(input: {
    readonly sagaId: string;
    readonly expectedRevision: number;
  }): Promise<{ readonly versionId: string; readonly versionLabel: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('publish_saga_definition_version', {
        p_saga_id: input.sagaId,
        p_expected_revision: input.expectedRevision,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Veröffentlichen Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Fassung konnte nicht veröffentlicht werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Publish-Antwort');
    }
    const row = data as { versionId?: string; versionLabel?: string };
    if (typeof row.versionId !== 'string') {
      throw new Error('Publish ohne versionId');
    }
    return {
      versionId: row.versionId,
      versionLabel: typeof row.versionLabel === 'string' ? row.versionLabel : 'v?',
    };
  }
```

### src/infrastructure/saga/saga-definition-service.ts:113

```ts
async createCopyFromNative(sourceSagaId: string): Promise<{ readonly sagaId: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('copy_native_saga_definition', { p_source_saga_id: sourceSagaId }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Kopie Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Kopie konnte nicht erstellt werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Kopie-Antwort');
    }
    const row = data as { sagaId?: string };
    if (typeof row.sagaId !== 'string') {
      throw new Error('Kopie ohne sagaId');
    }
    return { sagaId: row.sagaId };
  }
```

### src/infrastructure/saga/saga-definition-service.ts:132

```ts
async createUserSaga(input: {
    readonly title: string;
    readonly blurb?: string;
  }): Promise<{ readonly sagaId: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('create_user_saga_definition', {
        p_title: input.title,
        p_blurb: input.blurb ?? '',
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Saga anlegen Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Saga konnte nicht angelegt werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Create-Antwort');
    }
    const row = data as { sagaId?: string };
    if (typeof row.sagaId !== 'string') {
      throw new Error('Create ohne sagaId');
    }
    return { sagaId: row.sagaId };
  }
```

### src/infrastructure/saga/saga-definition-service.ts:157

```ts
async createProjectFromVersion(input: {
    readonly sagaId: string;
    readonly versionId: string;
    readonly name?: string;
  }): Promise<{ readonly id: string; readonly publicId: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('create_project_from_saga_version', {
        p_saga_id: input.sagaId,
        p_version_id: input.versionId,
        p_name: input.name ?? null,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Neue Gruppe Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Gruppe konnte nicht erstellt werden');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültige Projekt-Antwort');
    }
    const row = data as { id?: string; public_id?: string };
    if (typeof row.id !== 'string') {
      throw new Error('Projekt ohne ID');
    }
    return {
      id: row.id,
      publicId: typeof row.public_id === 'string' ? row.public_id : '',
    };
  }
```

### src/infrastructure/saga/saga-definition-service.ts:190

```ts
async duplicatePlaythrough(input: {
    readonly projectId: string;
    readonly mode: 'fresh' | 'with_progress';
  }): Promise<{ readonly id: string; readonly publicId: string }> {
    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('duplicate_saga_playthrough', {
        p_project_id: input.projectId,
        p_mode: input.mode,
      }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Duplizieren Zeitüberschreitung',
    );
    if (error) {
      throw new Error(error.message || 'Saga konnte nicht dupliziert werden');
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') {
      throw new Error('Ungültige Duplikat-Antwort');
    }
    const parsed = row as { id?: string; public_id?: string };
    if (typeof parsed.id !== 'string') {
      throw new Error('Duplikat ohne ID');
    }
    return {
      id: parsed.id,
      publicId: typeof parsed.public_id === 'string' ? parsed.public_id : '',
    };
  }
```

### src/infrastructure/saga/session-outcome-promotion-service.ts:15

```ts
async function callPromote(
  rpc: 'promote_session_outcome_to_saga' | 'promote_session_outcome_to_world',
  sessionId: string,
  consequenceId: string,
): Promise<PromoteRpcResult> {
  const { data, error } = await supabase.rpc(rpc, {
    p_session_id: sessionId,
    p_consequence_id: consequenceId,
  });
  if (error) {
    console.error(`[session-outcome-promotion] ${rpc} failed`, error);
    return {
      ok: false,
      messageDe: error.message || 'Übernehmen fehlgeschlagen',
    };
  }
  return parsePromoteRpcResult(data);
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/saga/contracts/saga-definition.ts` | `69b8fab72a158942d4f807e8b9fabcdae815506fb18e4e82434a71d0cdb9ee05` |
| `src/domains/session/contracts/session-outcome-promotion.ts` | `d3c26e886f5f1da3b617723feaad5510218d486413ea7953bbc382593578bedd` |
| `src/infrastructure/saga/host-saga-adapter.ts` | `7f0c52eaafcd6ee4f0deec9e5e4a5a282dc1d2ded67bd3a0e00a65636097aa62` |
| `src/infrastructure/saga/host-saga-ports.contract.ts` | `c3734bbd18e4a04460915e128bbc2c46626934cf7bde76305918355f0ba85649` |
| `src/infrastructure/saga/saga-definition-service.ts` | `4d361fe8dff964fdd8fc2a15a7a7c8a8254dd936f7536ad543637b52280fd611` |
| `src/infrastructure/saga/session-outcome-promotion-service.ts` | `068813032aab3e73e4a304a55eb62b2fd9c45c92cc627eba698ad7875feab399` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

