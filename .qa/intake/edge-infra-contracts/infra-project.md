# Infrastructure contract: project

**Status: SPEC; current branch source verified.** Implementation issue: **#807**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-project.json](source-contracts/infra-project.json) (SHA-256 `467d3452459230e8efd0ca2ef4f1d4a36fd4722175d2c3a534e81816ed7c6001`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Project creation/membership, default starter, join codes, selected character, saga permissions/bindings/overview/lore timeline span11 RPCs and direct project table operations.

Project owner, projects.gm_user_id, active member and delegated capabilities are distinct; codes and public IDs do not grant capabilities beyond joining contract.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (11): `create_project_session`, `ensure_native_starter_project`, `get_my_saga_permissions`, `get_saga_lore_timeline`, `get_saga_overview`, `join_project_by_code`, `list_saga_bindings`, `list_saga_member_permission_state`, `set_my_project_character`, `set_saga_binding_reveal`, `set_saga_member_bundle`.

Tables (3): `project_members`, `projects`, `sessions`.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 4.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `create_project_session` | #814 | RPC-SESSION-LIFECYCLE |
| rpc | `ensure_native_starter_project` | #815 | RPC-SAGA-PROVISION |
| rpc | `get_my_saga_permissions` | #815 | RPC-SAGA-GOVERNANCE |
| rpc | `get_saga_lore_timeline` | #815 | RPC-SAGA-PROJECTIONS |
| rpc | `get_saga_overview` | #815 | RPC-SAGA-PROJECTIONS |
| rpc | `join_project_by_code` | #815 | RPC-PROJECT-MEMBERSHIP |
| rpc | `list_saga_bindings` | #815 | RPC-SAGA-GOVERNANCE |
| rpc | `list_saga_member_permission_state` | #815 | RPC-SAGA-GOVERNANCE |
| rpc | `set_my_project_character` | #815 | RPC-PROJECT-MEMBERSHIP |
| rpc | `set_saga_binding_reveal` | #815 | RPC-SAGA-GOVERNANCE |
| rpc | `set_saga_member_bundle` | #815 | RPC-SAGA-GOVERNANCE |
| table | `project_members` | #791 | Policy #792 |
| table | `projects` | #791 | Policy #792 |
| table | `sessions` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |

## Acceptance and negative tests (required, not executed)

- Create project/session,join by code,assign own eligible character and reload overview.
- All11 RPC dependencies must be available before facade swap, including permission bundles and reveal bindings.
- Wrong GM/member/cross-owner requests denied; reveal/permission changes alter player projection only as specified.
- Contract fixture for create_project_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for ensure_native_starter_project: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for get_my_saga_permissions: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for get_saga_lore_timeline: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for get_saga_overview: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for join_project_by_code: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for list_saga_bindings: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for list_saga_member_permission_state: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for set_my_project_character: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for set_saga_binding_reveal: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for set_saga_member_bundle: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### table: project_members

`src/infrastructure/project/project-member-service.ts:45` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('joined_at')
```

Enclosing operation: `src/infrastructure/project/project-member-service.ts:32`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: join_project_by_code

`src/infrastructure/project/project-member-service.ts:74` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('join_project_by_code', {
      p_code: dto.code.toUpperCase(),
      p_character_id: dto.character_id || null,
    })
```

Enclosing operation: `src/infrastructure/project/project-member-service.ts:59`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/project/project-member-service.ts:82` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('project_members')
      .select('*')
      .eq('project_id', joinedProjectId)
      .single()
```

Enclosing operation: `src/infrastructure/project/project-member-service.ts:59`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: set_my_project_character

`src/infrastructure/project/project-member-service.ts:111` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('set_my_project_character', {
      p_project_id: projectId,
      p_character_id: characterId,
    })
```

Enclosing operation: `src/infrastructure/project/project-member-service.ts:96`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/project/project-member-service.ts:119` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('project_members')
      .select('*')
      .eq('id', updatedMemberId)
      .single()
```

Enclosing operation: `src/infrastructure/project/project-member-service.ts:96`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/project/project-member-service.ts:133` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)
```

Enclosing operation: `src/infrastructure/project/project-member-service.ts:132`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/project/project-member-service.ts:146` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('project_members')
      .select(`
        *,
        project:projects(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('joined_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/project/project-member-service.ts:145`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/project/project-service.ts:282` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/project/project-service.ts:272`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/project/project-service.ts:296` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .insert(projectData)
      .select(PROJECT_SAFE_COLUMNS)
      .single()
```

Enclosing operation: `src/infrastructure/project/project-service.ts:272`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/project/project-service.ts:307` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(this.membersTableName).insert({
      project_id: data.id,
      user_id: userId,
      role: 'gm',
      status: 'active',
    })
```

Enclosing operation: `src/infrastructure/project/project-service.ts:272`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: ensure_native_starter_project

`src/infrastructure/project/project-service.ts:437` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('ensure_native_starter_project', {
      p_slug: slug,
    })
```

Enclosing operation: `src/infrastructure/project/project-service.ts:426`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/project/project-service.ts:446` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/project/project-service.ts:445`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/project/project-service.ts:454` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .select(projectSummarySelect)
      .eq('gm_user_id', userId)
      .order('created_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/project/project-service.ts:445`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/project/project-service.ts:464` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.membersTableName)
      .select(`projects!inner(${projectSummarySelect})`)
      .eq('user_id', userId)
      .eq('status', 'active')
```

Enclosing operation: `src/infrastructure/project/project-service.ts:445`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/project/project-service.ts:528` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(this.membersTableName).select('project_id').in('project_id', projectIds)
```

Enclosing operation: `src/infrastructure/project/project-service.ts:445`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: sessions

`src/infrastructure/project/project-service.ts:529` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(this.sessionsTableName).select('project_id').in('project_id', projectIds)
```

Enclosing operation: `src/infrastructure/project/project-service.ts:445`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/project/project-service.ts:573` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/project/project-service.ts:572`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/project/project-service.ts:575` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .select(PROJECT_SAFE_COLUMNS)
      .eq('gm_user_id', userId)
      .order('created_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/project/project-service.ts:572`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/project/project-service.ts:585` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.membersTableName)
      .select(`*, projects!inner(${PROJECT_SAFE_COLUMNS})`)
      .eq('user_id', userId)
      .eq('status', 'active')
```

Enclosing operation: `src/infrastructure/project/project-service.ts:572`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/project/project-service.ts:612` — literal-or-constant.

Exact call/query chain:
```ts
supabase
          .from(this.membersTableName)
          .select('*')
          .eq('project_id', project.id)
```

Enclosing operation: `src/infrastructure/project/project-service.ts:611`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: sessions

`src/infrastructure/project/project-service.ts:617` — literal-or-constant.

Exact call/query chain:
```ts
supabase
          .from(this.sessionsTableName)
          .select(SESSION_SAFE_COLUMNS)
          .eq('project_id', project.id)
          .order('session_number', { ascending: true })
```

Enclosing operation: `src/infrastructure/project/project-service.ts:611`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/project/project-service.ts:657` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .select(PROJECT_SAFE_COLUMNS)
      .eq('id', id)
      .single()
```

Enclosing operation: `src/infrastructure/project/project-service.ts:650`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/project/project-service.ts:667` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.membersTableName)
      .select('*')
      .eq('project_id', id)
```

Enclosing operation: `src/infrastructure/project/project-service.ts:650`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: sessions

`src/infrastructure/project/project-service.ts:672` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.sessionsTableName)
      .select(SESSION_SAFE_COLUMNS)
      .eq('project_id', id)
      .order('session_number', { ascending: true })
```

Enclosing operation: `src/infrastructure/project/project-service.ts:650`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/project/project-service.ts:723` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
```

Enclosing operation: `src/infrastructure/project/project-service.ts:694`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: sessions

`src/infrastructure/project/project-service.ts:796` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.sessionsTableName)
      .update({ look_profile_id: settings.lookProfileId })
      .eq('id', sessionId)
      .select(SESSION_SAFE_COLUMNS)
      .single()
```

Enclosing operation: `src/infrastructure/project/project-service.ts:765`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/project/project-service.ts:836` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
```

Enclosing operation: `src/infrastructure/project/project-service.ts:830`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/project/project-service.ts:850` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/project/project-service.ts:849`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/project/project-service.ts:858` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .select(PROJECT_SAFE_COLUMNS)
      .eq('public_id', publicId.trim().toUpperCase())
      .single()
```

Enclosing operation: `src/infrastructure/project/project-service.ts:857`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: sessions

`src/infrastructure/project/project-service.ts:883` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(this.sessionsTableName)
        .select(SESSION_SAFE_COLUMNS)
        .eq('project_id', project.id)
        .eq('public_id', wanted)
        .maybeSingle()
```

Enclosing operation: `src/infrastructure/project/project-service.ts:874`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: create_project_session

`src/infrastructure/project/project-service.ts:953` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('create_project_session', {
      p_project_id: payload.projectId,
      p_name: payload.name ?? null,
      p_notes: payload.notes ?? null,
    })
```

Enclosing operation: `src/infrastructure/project/project-service.ts:918`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: get_saga_overview

`src/infrastructure/project/saga-overview-service.ts:41` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('get_saga_overview', { p_public_id: publicId })
```

Enclosing operation: `src/infrastructure/project/saga-overview-service.ts:26`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: get_my_saga_permissions

`src/infrastructure/project/saga-permission-service.ts:141` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('get_my_saga_permissions', {
      p_public_id: publicId,
    })
```

Enclosing operation: `src/infrastructure/project/saga-permission-service.ts:135`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: list_saga_member_permission_state

`src/infrastructure/project/saga-permission-service.ts:164` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('list_saga_member_permission_state', {
      p_public_id: publicId,
    })
```

Enclosing operation: `src/infrastructure/project/saga-permission-service.ts:150`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: set_saga_member_bundle

`src/infrastructure/project/saga-permission-service.ts:182` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('set_saga_member_bundle', {
      p_project_id: input.projectId,
      p_member_id: input.memberId,
      p_bundle_id: input.bundleId,
    })
```

Enclosing operation: `src/infrastructure/project/saga-permission-service.ts:173`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: list_saga_bindings

`src/infrastructure/project/saga-permission-service.ts:207` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('list_saga_bindings', {
      p_public_id: publicId,
      p_asset_kind: assetKind ?? null,
    })
```

Enclosing operation: `src/infrastructure/project/saga-permission-service.ts:192`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: set_saga_binding_reveal

`src/infrastructure/project/saga-permission-service.ts:234` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('set_saga_binding_reveal', {
      p_project_id: input.projectId,
      p_binding_id: input.bindingId,
      p_reveal: input.reveal,
    })
```

Enclosing operation: `src/infrastructure/project/saga-permission-service.ts:217`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: get_saga_lore_timeline

`src/infrastructure/project/saga-permission-service.ts:255` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('get_saga_lore_timeline', {
      p_public_id: publicId,
    })
```

Enclosing operation: `src/infrastructure/project/saga-permission-service.ts:249`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/project/host-project-adapter.ts:12

```ts
export type HostProjectAdapter = HostProjectPorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_PROJECT_OPS;
  readonly rpcNames: typeof HOST_PROJECT_RPC_NAMES;
};
```

### src/infrastructure/project/host-project-adapter.ts:22

```ts
export function createHostProjectAdapter(ports: HostProjectPorts): HostProjectAdapter {
  return {
    transport: 'host',
    ops: HOST_PROJECT_OPS,
    rpcNames: HOST_PROJECT_RPC_NAMES,
    createProjectSession: (actorId, projectId, name, notes) =>
      ports.createProjectSession(actorId, projectId, name, notes),
    ensureNativeStarterProject: (actorId, slug) =>
      ports.ensureNativeStarterProject(actorId, slug),
    getMySagaPermissions: (actorId, publicId) =>
      ports.getMySagaPermissions(actorId, publicId),
    getSagaLoreTimeline: (actorId, publicId) =>
      ports.getSagaLoreTimeline(actorId, publicId),
    getSagaOverview: (actorId, publicId) => ports.getSagaOverview(actorId, publicId),
    joinProjectByCode: (actorId, code, characterId) =>
      ports.joinProjectByCode(actorId, code, characterId),
    listSagaBindings: (actorId, publicId, assetKind) =>
      ports.listSagaBindings(actorId, publicId, assetKind),
    listSagaMemberPermissionState: (actorId, publicId) =>
      ports.listSagaMemberPermissionState(actorId, publicId),
    setMyProjectCharacter: (actorId, projectId, characterId) =>
      ports.setMyProjectCharacter(actorId, projectId, characterId),
    setSagaBindingReveal: (actorId, projectId, bindingId, reveal) =>
      ports.setSagaBindingReveal(actorId, projectId, bindingId, reveal),
    setSagaMemberBundle: (actorId, projectId, memberId, bundleId) =>
      ports.setSagaMemberBundle(actorId, projectId, memberId, bundleId),
  };
}
```

### src/infrastructure/project/host-project-ports.contract.ts:10

```ts
export type HostProjectResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly detail?: string };
```

### src/infrastructure/project/host-project-ports.contract.ts:15

```ts
export type HostProjectSessionVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly projectId: string;
};
```

### src/infrastructure/project/host-project-ports.contract.ts:20

```ts
export type HostStarterProjectVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly publicId: string;
  readonly created: boolean;
};
```

### src/infrastructure/project/host-project-ports.contract.ts:26

```ts
export type HostSagaPermissionsVm = Readonly<Record<string, unknown>> & {
  readonly projectId: string;
  readonly isGm: boolean;
  readonly keys: readonly string[];
};
```

### src/infrastructure/project/host-project-ports.contract.ts:32

```ts
export type HostSagaOverviewVm = Readonly<Record<string, unknown>>;
```

### src/infrastructure/project/host-project-ports.contract.ts:33

```ts
export type HostSagaLoreTimelineVm = Readonly<Record<string, unknown>>;
```

### src/infrastructure/project/host-project-ports.contract.ts:34

```ts
export type HostSagaBindingVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
};
```

### src/infrastructure/project/host-project-ports.contract.ts:37

```ts
export type HostSagaMemberPermissionStateVm = Readonly<Record<string, unknown>> & {
  readonly memberId: string;
  readonly userId: string;
};
```

### src/infrastructure/project/host-project-ports.contract.ts:46

```ts
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
```

### src/infrastructure/project/host-project-ports.contract.ts:103

```ts
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
```

### src/infrastructure/project/host-project-ports.contract.ts:117

```ts
export type HostProjectRpcName = (typeof HOST_PROJECT_RPC_NAMES)[number];
```

### src/infrastructure/project/host-project-ports.contract.ts:120

```ts
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
```

### src/infrastructure/project/host-project-ports.contract.ts:134

```ts
export type HostProjectOp = (typeof HOST_PROJECT_OPS)[number];
```

### src/infrastructure/project/project-member-service.ts:27

```ts
export const projectMemberService = {
  /**
   * Get all members of a project.
   * Host-first: GET /api/v1/projects/:projectId/members (active roster only).
   */
  async getMembers(projectId: string): Promise<ProjectMemberDto[]> {
    if (isHostLibraryEnabled()) {
      const rows = await listHostProjectMembers(projectId);
      return rows.map((row) => ({
        id: row.id,
        project_id: row.projectId,
        user_id: row.userId,
        character_id: row.characterId,
        role: row.role,
        status: row.status === 'active' ? 'active' : 'inactive',
        joined_at: row.joinedAt ?? new Date(0).toISOString(),
      }));
    }
    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('joined_at');

    if (error) throw error;
    return data || [];
  },

  /**
   * Join a project by its secret code.
   * Membership identity/status is created by a SECURITY DEFINER RPC, never by a client row insert.
   */
  async joinByCode(dto: JoinProjectDto): Promise<ProjectMemberDto> {
    if (isHostLibraryEnabled()) {
      const joined = await joinHostProjectByCode(dto.code.toUpperCase(), dto.character_id || null);
      const projectId = requireUuid(joined.projectId, 'join_project_by_code');
      const userId = requireUuid(joined.userId, 'join_project_by_code.userId');
      return {
        id: projectId,
        project_id: projectId,
        user_id: userId,
        role: 'player',
        status: 'active',
        character_id: dto.character_id || null,
        joined_at: new Date().toISOString(),
      } as ProjectMemberDto;
    }
    const { data: projectId, error: joinError } = await supabase.rpc('join_project_by_code', {
      p_code: dto.code.toUpperCase(),
      p_character_id: dto.character_id || null,
    });

    if (joinError) throw new Error(`Beitritt fehlgeschlagen: ${joinError.message}`);
    const joinedProjectId = requireUuid(projectId, 'join_project_by_code');

    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', joinedProjectId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update only the current user's selected character for an active membership.
   * Protected membership fields (project/user/role/status) stay server/GM controlled.
   */
  async updateCharacter(projectId: string, characterId: string): Promise<ProjectMemberDto> {
    if (isHostLibraryEnabled()) {
      const updated = await setHostMyProjectCharacter(projectId, characterId);
      const memberId = requireUuid(updated.memberId, 'set_my_project_character');
      const userId = requireUuid(updated.userId, 'set_my_project_character.userId');
      return {
        id: memberId,
        project_id: projectId,
        user_id: userId,
        role: 'player',
        status: 'active',
        character_id: characterId,
        joined_at: new Date().toISOString(),
      } as ProjectMemberDto;
    }
    const { data: memberId, error: updateError } = await supabase.rpc('set_my_project_character', {
      p_project_id: projectId,
      p_character_id: characterId,
    });

    if (updateError) throw new Error(`Charakter konnte nicht aktualisiert werden: ${updateError.message}`);
    const updatedMemberId = requireUuid(memberId, 'set_my_project_character');

    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('id', updatedMemberId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Leave a project. Kicked memberships remain as denial records and cannot be self-deleted by RLS.
   */
  async leave(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /**
   * Get active projects where user is a member
   */
  async getMyProjects(userId: string): Promise<ProjectMemberDto[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        project:projects(*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('joined_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },
};
```

### src/infrastructure/project/project-service.ts:986

```ts
export const projectService = new ProjectService();
```

### src/infrastructure/project/saga-overview-service.ts:67

```ts
export const sagaOverviewService = new SagaOverviewService();
```

### src/infrastructure/project/saga-permission-service.ts:33

```ts
export type SagaMyPermissionsVm = {
  readonly projectId: string;
  readonly bundleId: SagaBundleId | null;
  readonly isGm: boolean;
  readonly keys: readonly SagaPermissionKey[];
};
```

### src/infrastructure/project/saga-permission-service.ts:40

```ts
export type SagaMemberPermissionStateVm = {
  readonly memberId: string;
  readonly userId: string;
  readonly role: string;
  readonly status: string;
  readonly bundleId: SagaBundleId | null;
  readonly canSetBundle: boolean;
};
```

### src/infrastructure/project/saga-permission-service.ts:49

```ts
export type SagaAssetBindingVm = {
  readonly id: string;
  readonly assetKind: SagaAssetKind;
  readonly assetId: string;
  readonly reveal: SagaRevealStatus;
  readonly label: string;
  /** Linked world_places.id when location is mapped to Donalu place model. */
  readonly worldPlaceId?: string | null;
};
```

### src/infrastructure/project/saga-permission-service.ts:134

```ts
export const sagaPermissionService = {
  async getMyPermissions(sagaPublicId: string): Promise<SagaMyPermissionsVm> {
    const publicId = sagaPublicId.trim().toUpperCase();
    if (isHostLibraryEnabled()) {
      const data = await fetchHostMySagaPermissions(publicId);
      return parseMyPermissions(data);
    }
    const { data, error } = await supabase.rpc('get_my_saga_permissions', {
      p_public_id: publicId,
    });
    if (error) {
      throw new Error(`Berechtigungen: ${error.message}`);
    }
    return parseMyPermissions(data);
  },

  async listMemberPermissionState(
    sagaPublicId: string,
  ): Promise<SagaMemberPermissionStateVm[]> {
    const publicId = sagaPublicId.trim().toUpperCase();
    if (isHostLibraryEnabled()) {
      const data = await listHostSagaMemberPermissionState(publicId);
      const members =
        data && typeof data === 'object' && Array.isArray((data as { members?: unknown }).members)
          ? (data as { members: unknown[] }).members
          : Array.isArray(data)
            ? data
            : [];
      return parseMemberState(members);
    }
    const { data, error } = await supabase.rpc('list_saga_member_permission_state', {
      p_public_id: publicId,
    });
    if (error) {
      throw new Error(`Mitglieder-Rechte: ${error.message}`);
    }
    return parseMemberState(data);
  },

  async setMemberBundle(input: {
    projectId: string;
    memberId: string;
    bundleId: SagaBundleId;
  }): Promise<void> {
    if (isHostLibraryEnabled()) {
      await setHostSagaMemberBundle(input.projectId, input.memberId, input.bundleId);
      return;
    }
    const { error } = await supabase.rpc('set_saga_member_bundle', {
      p_project_id: input.projectId,
      p_member_id: input.memberId,
      p_bundle_id: input.bundleId,
    });
    if (error) {
      throw new Error(`Bundle konnte nicht gesetzt werden: ${error.message}`);
    }
  },

  async listBindings(
    sagaPublicId: string,
    assetKind?: SagaAssetKind | null,
  ): Promise<SagaAssetBindingVm[]> {
    const publicId = sagaPublicId.trim().toUpperCase();
    if (isHostLibraryEnabled()) {
      const data = await listHostSagaBindings(publicId, assetKind ?? null);
      const bindings =
        data && typeof data === 'object' && Array.isArray((data as { bindings?: unknown }).bindings)
          ? (data as { bindings: unknown[] }).bindings
          : Array.isArray(data)
            ? data
            : [];
      return parseBindings(bindings);
    }
    const { data, error } = await supabase.rpc('list_saga_bindings', {
      p_public_id: publicId,
      p_asset_kind: assetKind ?? null,
    });
    if (error) {
      throw new Error(`Bindings: ${error.message}`);
    }
    return parseBindings(data);
  },

  async setBindingReveal(input: {
    projectId: string;
    bindingId: string;
    reveal: SagaRevealStatus;
  }): Promise<SagaAssetBindingVm> {
    if (isHostLibraryEnabled()) {
      const data = await setHostSagaBindingReveal(
        input.projectId,
        input.bindingId,
        input.reveal,
      );
      const parsed = parseBindings([data]);
      if (parsed.length === 0) {
        throw new Error('Sichtbarkeit konnte nicht gelesen werden');
      }
      return parsed[0]!;
    }
    const { data, error } = await supabase.rpc('set_saga_binding_reveal', {
      p_project_id: input.projectId,
      p_binding_id: input.bindingId,
      p_reveal: input.reveal,
    });
    if (error) {
      throw new Error(`Sichtbarkeit: ${error.message}`);
    }
    const parsed = parseBindings([data]);
    if (parsed.length === 0) {
      throw new Error('Sichtbarkeit konnte nicht gelesen werden');
    }
    return parsed[0]!;
  },

  async getLoreTimeline(sagaPublicId: string): Promise<SagaLoreTimelineVm> {
    const publicId = sagaPublicId.trim().toUpperCase();
    if (isHostLibraryEnabled()) {
      const data = await fetchHostSagaLoreTimeline(publicId);
      return parseSagaLoreTimeline(data);
    }
    const { data, error } = await supabase.rpc('get_saga_lore_timeline', {
      p_public_id: publicId,
    });
    if (error) {
      throw new Error(`Lore/Verlauf: ${error.message}`);
    }
    return parseSagaLoreTimeline(data);
  },
};
```


## Remaining backend helper operations

### src/infrastructure/project/project-service.ts:272

```ts
async createProject(payload: CreateProjectDto): Promise<ProjectVm> {
    if (isHostLibraryEnabled()) {
      const created = await createHostProject({
        name: payload.name,
        description: payload.description ?? null,
        worldProfileId: payload.world_profile_id ?? payload.world_id ?? null,
      });
      return this.mapHostProjectWriteToVm(created);
    }
    assertHostProductSurfaceAvailable('Saga anlegen');
    const userId = await getAuthenticatedUserId();

    const code = this.generateProjectCode();

    const projectData: Partial<ProjectDto> = {
      code,
      name: payload.name,
      description: payload.description || null,
      world_id: payload.world_id || null,
      world_profile_id: payload.world_profile_id || null,
      gm_user_id: userId,
      status: 'active',
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .insert(projectData)
      .select(PROJECT_SAFE_COLUMNS)
      .single();

    if (error) {
      throw new Error(`Failed to create project: ${error.message}`);
    }

    // The GM-controlled membership policy permits this bootstrap row.
    await supabase.from(this.membersTableName).insert({
      project_id: data.id,
      user_id: userId,
      role: 'gm',
      status: 'active',
    });

    return this.mapToViewModel(data, [], []);
  }
```

### src/infrastructure/project/project-service.ts:426

```ts
async ensureNativeStarterProject(slug = 'dornhain.whisper'): Promise<void> {
    if (isHostLibraryEnabled()) {
      try {
        const { ensureHostNativeStarterProject } = await import('../host/host-project-http');
        await ensureHostNativeStarterProject(slug);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[project-service] ensure_native_starter_project (host):', message);
      }
      return;
    }
    const { error } = await supabase.rpc('ensure_native_starter_project', {
      p_slug: slug,
    });
    if (error) {
      console.warn('[project-service] ensure_native_starter_project:', error.message);
    }
  }
```

### src/infrastructure/project/project-service.ts:445

```ts
private async fetchUserProjectSummaries(): Promise<ProjectSummaryVm[]> {
    const userId = await getAuthenticatedUserId();

    // Bridge native saga_definitions → selectable GM project (SessionJoin / Library).
    await this.ensureNativeStarterProject();

    const projectSummarySelect =
      'id, public_id, code, name, description, world_id, world_profile_id, gm_user_id, status, saga_id, saga_version_id, saga_definitions(title, origin, slug)';

    const { data: gmProjects, error: gmError } = await supabase
      .from(this.tableName)
      .select(projectSummarySelect)
      .eq('gm_user_id', userId)
      .order('created_at', { ascending: false });

    if (gmError) {
      throw new Error(`Failed to fetch GM projects: ${gmError.message}`);
    }

    const { data: memberRecords, error: memberError } = await supabase
      .from(this.membersTableName)
      .select(`projects!inner(${projectSummarySelect})`)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (memberError) {
      console.error('Failed to fetch player projects:', memberError);
    }

    type ProjectSummaryRow = Pick<
      ProjectDto,
      'id' | 'code' | 'name' | 'description' | 'gm_user_id' | 'status'
    > & {
      public_id?: string | null;
      world_id?: string | null;
      world_profile_id?: string | null;
      saga_id?: string | null;
      saga_version_id?: string | null;
      saga_definitions?: { title?: string | null; origin?: string | null; slug?: string | null } | null;
    };
    const combined = new Map<string, ProjectSummaryRow>();

    const normalizeSummaryRow = (raw: unknown): ProjectSummaryRow | null => {
      if (!isProjectSummaryRow(raw)) return null;
      const row = raw as ProjectSummaryRow & { saga_definitions?: unknown };
      let def: ProjectSummaryRow['saga_definitions'] = null;
      if (Array.isArray(row.saga_definitions)) {
        const first = row.saga_definitions[0];
        if (isRecord(first)) {
          def = {
            title: typeof first.title === 'string' ? first.title : null,
            origin: typeof first.origin === 'string' ? first.origin : null,
            slug: typeof first.slug === 'string' ? first.slug : null,
          };
        }
      } else if (isRecord(row.saga_definitions)) {
        def = {
          title: typeof row.saga_definitions.title === 'string' ? row.saga_definitions.title : null,
          origin: typeof row.saga_definitions.origin === 'string' ? row.saga_definitions.origin : null,
          slug: typeof row.saga_definitions.slug === 'string' ? row.saga_definitions.slug : null,
        };
      }
      return { ...row, saga_definitions: def };
    };

    for (const project of gmProjects ?? []) {
      const normalized = normalizeSummaryRow(project);
      if (!normalized) continue;
      combined.set(normalized.id, normalized);
    }

    for (const record of memberRecords ?? []) {
      if (!isRecord(record)) continue;
      const normalized = normalizeSummaryRow(record.projects);
      if (!normalized) continue;
      combined.set(normalized.id, normalized);
    }

    const projectIds = [...combined.keys()];
    if (projectIds.length === 0) return [];

    const [{ data: memberRows, error: membersBatchError }, { data: sessionRows, error: sessionsBatchError }] =
      await Promise.all([
        supabase.from(this.membersTableName).select('project_id').in('project_id', projectIds),
        supabase.from(this.sessionsTableName).select('project_id').in('project_id', projectIds),
      ]);

    if (membersBatchError) {
      throw new Error(`Failed to fetch project members: ${membersBatchError.message}`);
    }
    if (sessionsBatchError) {
      throw new Error(`Failed to fetch project sessions: ${sessionsBatchError.message}`);
    }

    const memberCounts = this.countByProjectId((memberRows ?? []) as Array<{ project_id: string }>);
    const sessionCounts = this.countByProjectId((sessionRows ?? []) as Array<{ project_id: string }>);

    return projectIds.map((id) => {
      const project = combined.get(id)!;
      const def = project.saga_definitions;
      const originRaw = def && typeof def.origin === 'string' ? def.origin : null;
      const sagaOrigin =
        originRaw === 'native' || originRaw === 'user' || originRaw === 'private_backfill'
          ? originRaw
          : null;
      return {
        id: project.id,
        publicId: typeof project.public_id === 'string' ? project.public_id : '',
        code: project.code,
        name: project.name,
        description: project.description,
        worldId: typeof project.world_id === 'string' ? project.world_id : null,
        worldProfileId:
          typeof project.world_profile_id === 'string' ? project.world_profile_id : null,
        sagaId: typeof project.saga_id === 'string' ? project.saga_id : null,
        sagaVersionId: typeof project.saga_version_id === 'string' ? project.saga_version_id : null,
        sagaTitle: def && typeof def.title === 'string' ? def.title : null,
        sagaSlug: def && typeof def.slug === 'string' ? def.slug : null,
        sagaOrigin,
        gmUserId: project.gm_user_id,
        status: project.status,
        memberCount: memberCounts.get(id) ?? 0,
        sessionCount: sessionCounts.get(id) ?? 0,
      };
    });
  }
```

### src/infrastructure/project/project-service.ts:572

```ts
private async fetchUserProjects(): Promise<ProjectVm[]> {
    const userId = await getAuthenticatedUserId();

    const { data: gmProjects, error: gmError } = await supabase
      .from(this.tableName)
      .select(PROJECT_SAFE_COLUMNS)
      .eq('gm_user_id', userId)
      .order('created_at', { ascending: false });

    if (gmError) {
      throw new Error(`Failed to fetch GM projects: ${gmError.message}`);
    }

    const { data: memberRecords, error: memberError } = await supabase
      .from(this.membersTableName)
      .select(`*, projects!inner(${PROJECT_SAFE_COLUMNS})`)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (memberError) {
      console.error('Failed to fetch player projects:', memberError);
    }

    const playerProjects: ProjectDto[] = [];
    for (const record of memberRecords || []) {
      if (!isRecord(record)) continue;
      const project = record.projects;
      if (isProjectDto(project)) playerProjects.push(project);
    }

    const allProjectIds = new Set<string>();
    const combinedProjects: ProjectDto[] = [];
    for (const project of [...(gmProjects || []), ...playerProjects]) {
      if (!isProjectDto(project) || allProjectIds.has(project.id)) continue;
      allProjectIds.add(project.id);
      combinedProjects.push(project);
    }

    return Promise.all(
      combinedProjects.map(async (project) => {
        const { data: members } = await supabase
          .from(this.membersTableName)
          .select('*')
          .eq('project_id', project.id);

        const { data: sessions } = await supabase
          .from(this.sessionsTableName)
          .select(SESSION_SAFE_COLUMNS)
          .eq('project_id', project.id)
          .order('session_number', { ascending: true });

        const sessionRows: SessionDto[] = [];
        for (const row of sessions || []) {
          if (!isSessionDto(row)) continue;
          sessionRows.push(
            normalizeSessionDto({
              ...row,
              notes: row.notes ?? null,
            }),
          );
        }
        return this.mapToViewModel(project, members || [], sessionRows);
      })
    );
  }
```

### src/infrastructure/project/project-service.ts:611

```ts
async (project) => {
        const { data: members } = await supabase
          .from(this.membersTableName)
          .select('*')
          .eq('project_id', project.id);

        const { data: sessions } = await supabase
          .from(this.sessionsTableName)
          .select(SESSION_SAFE_COLUMNS)
          .eq('project_id', project.id)
          .order('session_number', { ascending: true });

        const sessionRows: SessionDto[] = [];
        for (const row of sessions || []) {
          if (!isSessionDto(row)) continue;
          sessionRows.push(
            normalizeSessionDto({
              ...row,
              notes: row.notes ?? null,
            }),
          );
        }
        return this.mapToViewModel(project, members || [], sessionRows);
      }
```

### src/infrastructure/project/project-service.ts:650

```ts
async getProjectById(id: string): Promise<ProjectVm> {
    if (isHostLibraryEnabled()) {
      const rows = await fetchHostLibraryProjects();
      const row = rows.find((item) => item.id === id);
      if (!row) throw new Error('Project not found');
      return this.mapHostProjectWriteToVm(row);
    }
    const { data: project, error: projectError } = await supabase
      .from(this.tableName)
      .select(PROJECT_SAFE_COLUMNS)
      .eq('id', id)
      .single();

    if (projectError || !project || !isProjectDto(project)) {
      throw new Error('Project not found');
    }

    const { data: members } = await supabase
      .from(this.membersTableName)
      .select('*')
      .eq('project_id', id);

    const { data: sessions } = await supabase
      .from(this.sessionsTableName)
      .select(SESSION_SAFE_COLUMNS)
      .eq('project_id', id)
      .order('session_number', { ascending: true });

    const sessionRows: SessionDto[] = [];
    for (const row of sessions || []) {
      if (!isSessionDto(row)) continue;
      sessionRows.push(
        normalizeSessionDto({
          ...row,
          notes: row.notes ?? null,
        }),
      );
    }
    return this.mapToViewModel(project, members || [], sessionRows);
  }
```

### src/infrastructure/project/project-service.ts:694

```ts
async updateProject(id: string, updates: Partial<ProjectDto>): Promise<ProjectVm> {
    if (isHostLibraryEnabled()) {
      const updated = await updateHostProject(id, {
        name: typeof updates.name === 'string' ? updates.name : undefined,
        description:
          updates.description === undefined
            ? undefined
            : updates.description === null
              ? null
              : String(updates.description),
        status: typeof updates.status === 'string' ? updates.status : undefined,
        worldProfileId:
          updates.world_profile_id !== undefined
            ? updates.world_profile_id
            : updates.world_id !== undefined
              ? updates.world_id
              : undefined,
        defaultLookProfileId:
          updates.default_look_profile_id === undefined
            ? undefined
            : updates.default_look_profile_id,
        allowPlayerCharacterLookOverride:
          typeof updates.allow_player_character_look_override === 'boolean'
            ? updates.allow_player_character_look_override
            : undefined,
      });
      return this.mapHostProjectWriteToVm(updated);
    }
    assertHostProductSurfaceAvailable('Saga bearbeiten');
    const { error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update project: ${error.message}`);
    }

    return this.getProjectById(id);
  }
```

### src/infrastructure/project/project-service.ts:765

```ts
async updateSessionLookSettings(
    sessionId: string,
    settings: { lookProfileId: string | null },
  ): Promise<SessionVm> {
    if (isHostLibraryEnabled()) {
      const updated = await updateHostSessionLook(sessionId, settings.lookProfileId);
      return {
        id: updated.id,
        publicId: typeof updated.publicId === 'string' ? updated.publicId : '',
        projectId: updated.projectId,
        sessionNumber:
          typeof updated.sessionNumber === 'number' ? updated.sessionNumber : 0,
        name: updated.name ?? null,
        notes: null,
        status:
          updated.status === 'scheduled' ||
          updated.status === 'waiting' ||
          updated.status === 'active' ||
          updated.status === 'paused' ||
          updated.status === 'completed' ||
          updated.status === 'cancelled'
            ? updated.status
            : 'scheduled',
        startedAt: null,
        endedAt: null,
        durationMinutes: null,
        lookProfileId: updated.lookProfileId,
        createdAt: new Date().toISOString(),
      };
    }
    assertHostProductSurfaceAvailable('Session-Look');
    const { data, error } = await supabase
      .from(this.sessionsTableName)
      .update({ look_profile_id: settings.lookProfileId })
      .eq('id', sessionId)
      .select(SESSION_SAFE_COLUMNS)
      .single();

    if (error) {
      throw new Error(`Failed to update session look: ${error.message}`);
    }
    if (!isSessionDto(data)) {
      throw new Error('Failed to update session look: invalid response');
    }
    const normalized = normalizeSessionDto(data);
    return {
      id: normalized.id,
      publicId: typeof normalized.public_id === 'string' ? normalized.public_id : '',
      projectId: normalized.project_id,
      sessionNumber: normalized.session_number,
      name: normalized.name,
      notes: normalized.notes,
      status: normalized.status,
      startedAt: normalized.started_at,
      endedAt: normalized.ended_at,
      durationMinutes: normalized.duration_minutes,
      lookProfileId:
        typeof normalized.look_profile_id === 'string' ? normalized.look_profile_id : null,
      createdAt: normalized.created_at,
    };
  }
```

### src/infrastructure/project/project-service.ts:830

```ts
async deleteProject(id: string): Promise<void> {
    if (isHostLibraryEnabled()) {
      await deleteHostProject(id);
      return;
    }
    assertHostProductSurfaceAvailable('Saga löschen');
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }
```

### src/infrastructure/project/project-service.ts:849

```ts
async leaveProject(projectId: string): Promise<void> {
    const userId = await getAuthenticatedUserId();
    await projectMemberService.leave(projectId, userId);
  }
```

### src/infrastructure/project/project-service.ts:857

```ts
async getProjectByPublicId(publicId: string): Promise<ProjectVm> {
    const { data: project, error } = await supabase
      .from(this.tableName)
      .select(PROJECT_SAFE_COLUMNS)
      .eq('public_id', publicId.trim().toUpperCase())
      .single();

    if (error || !project || !isProjectDto(project)) {
      throw new Error('Project not found');
    }

    return this.getProjectById(project.id);
  }
```

### src/infrastructure/project/project-service.ts:874

```ts
async getSessionByPublicIds(
    sagaPublicId: string,
    sessionPublicId: string,
  ): Promise<{ project: ProjectVm; session: SessionVm }> {
    const project = await this.getProjectByPublicId(sagaPublicId);
    const wanted = sessionPublicId.trim().toUpperCase();
    let session = project.sessions.find((row) => row.publicId === wanted);
    if (!session) {
      // Direct lookup — avoids dropping rows when status filters/mapping lag behind create.
      const { data: row, error } = await supabase
        .from(this.sessionsTableName)
        .select(SESSION_SAFE_COLUMNS)
        .eq('project_id', project.id)
        .eq('public_id', wanted)
        .maybeSingle();
      if (error || !row || !isSessionDto(row)) {
        throw new Error('Session not found in saga');
      }
      const normalized = normalizeSessionDto({
        ...row,
        notes: row.notes ?? null,
      });
      session = {
        id: normalized.id,
        publicId: typeof normalized.public_id === 'string' ? normalized.public_id : '',
        projectId: normalized.project_id,
        sessionNumber: normalized.session_number,
        name: normalized.name,
        notes: normalized.notes,
        status: normalized.status,
        startedAt: normalized.started_at,
        endedAt: normalized.ended_at,
        durationMinutes: normalized.duration_minutes ?? null,
        lookProfileId:
          typeof normalized.look_profile_id === 'string' ? normalized.look_profile_id : null,
        createdAt: normalized.created_at,
      };
    }
    return { project, session };
  }
```

### src/infrastructure/project/project-service.ts:918

```ts
async createProjectSession(payload: {
    projectId: string;
    name?: string;
    notes?: string;
  }): Promise<SessionVm> {
    if (isHostLibraryEnabled()) {
      const row = await createHostProjectSession(
        payload.projectId,
        payload.name ?? null,
        payload.notes ?? null,
      );
      const status =
        row.status === 'scheduled' ||
        row.status === 'waiting' ||
        row.status === 'active' ||
        row.status === 'paused' ||
        row.status === 'completed'
          ? row.status
          : 'scheduled';
      return {
        id: row.id,
        publicId: typeof row.publicId === 'string' ? row.publicId : '',
        projectId: row.projectId,
        sessionNumber: typeof row.sessionNumber === 'number' ? row.sessionNumber : 0,
        name: row.name ?? null,
        notes: null,
        status,
        startedAt: null,
        endedAt: null,
        durationMinutes: null,
        lookProfileId: null,
        createdAt: new Date().toISOString(),
      };
    }

    const { data, error } = await supabase.rpc('create_project_session', {
      p_project_id: payload.projectId,
      p_name: payload.name ?? null,
      p_notes: payload.notes ?? null,
    });

    if (error) {
      throw new Error(`Failed to create session: ${error.message}`);
    }

    if (!isSessionDto(data)) {
      throw new Error('Failed to create session: invalid response');
    }

    const normalized = normalizeSessionDto(data);
    return {
      id: normalized.id,
      publicId: typeof normalized.public_id === 'string' ? normalized.public_id : '',
      projectId: normalized.project_id,
      sessionNumber: normalized.session_number,
      name: normalized.name,
      notes: normalized.notes,
      status: normalized.status,
      startedAt: normalized.started_at,
      endedAt: normalized.ended_at,
      durationMinutes: normalized.duration_minutes,
      lookProfileId:
        typeof normalized.look_profile_id === 'string' ? normalized.look_profile_id : null,
      createdAt: normalized.created_at,
    };
  }
```

### src/infrastructure/project/saga-overview-service.ts:26

```ts
async getOverviewByPublicId(sagaPublicId: string): Promise<SagaOverviewVm> {
    const publicId = sagaPublicId.trim().toUpperCase();
    if (!publicId) {
      throw new Error('Saga-ID fehlt');
    }

    if (isHostLibraryEnabled()) {
      const data = await fetchHostSagaOverview(publicId);
      if (data == null) throw new Error('Saga-Übersicht leer');
      const vm = parseSagaOverview(data);
      assertSagaOverviewAudienceSafe(vm);
      return vm;
    }

    const { data, error } = await raceWithTimeoutReject(
      supabase.rpc('get_saga_overview', { p_public_id: publicId }),
      SAGA_OVERVIEW_TIMEOUT_MS,
      'Saga-Übersicht Zeitüberschreitung',
    );

    if (error) {
      const message = error.message || 'Saga-Übersicht fehlgeschlagen';
      if (/not authenticated|forbidden|42501/i.test(message)) {
        throw new Error('Kein Zugriff auf diese Saga');
      }
      if (/not found|P0002/i.test(message)) {
        throw new Error('Saga nicht gefunden');
      }
      throw new Error(message);
    }

    if (data == null) {
      throw new Error('Saga-Übersicht leer');
    }

    const vm = parseSagaOverview(data);
    assertSagaOverviewAudienceSafe(vm);
    return vm;
  }
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/project/contracts/project.types.ts` | `1777f75b3bd865b09e3fba61324b7331439f5846c98dea1230e27b6f976a0ca8` |
| `src/domains/project/contracts/saga-overview.ts` | `d4ddafbea6f3d8a8678c44d6fd9096ebe1f6985e4c335f5050dac2915918dc94` |
| `src/domains/saga/permissions/catalog.ts` | `fa18a08f5e4fd9db4886aa51e89858769d2fa84853d3109df36a1db8913ee3c7` |
| `src/domains/saga/permissions/index.ts` | `27ab6076d9afb89c5dc6d0bf11b9a0e3502efade690cd7dba2973e2acad24bba` |
| `src/domains/saga/permissions/lore-timeline.ts` | `f245a4b02ce971d772808ddcdb70944992ba7f8cb0fbc1d012e5f6c93e11b48b` |
| `src/infrastructure/host/host-library-http.ts` | `45d3c37d4a5ce1c328c42c50fd5482590b9811150d71a55e3029071916fd281e` |
| `src/infrastructure/host/host-product-deny.ts` | `69b148debc95006bb31daa7a94caf4e1507ac3089fdf399952102c4effa3759c` |
| `src/infrastructure/host/host-project-http.ts` | `b5a68f6452217b08d2217a983113a9a356ce70890693319227f35c82fbdcd818` |
| `src/infrastructure/project/host-project-adapter.ts` | `41d162d05407e6f54f118a60a6aaf5f29bb1a61d28758c7d1c0698cdc3c35a70` |
| `src/infrastructure/project/host-project-ports.contract.ts` | `4e9023655c95ed3e3ade8837af0c14c53c5541571a1591526aae760ffbbd9902` |
| `src/infrastructure/project/project-member-service.ts` | `bc15c872ef4979b1f6c67c9dc01838e8a7ee45083f225121d688d60b442bbb26` |
| `src/infrastructure/project/project-service.ts` | `07549fce108bd735bdd7d48b07bccbf39947e3547d0f26ab60fdd013ca94aeff` |
| `src/infrastructure/project/saga-overview-service.ts` | `fdcfe378e727d5409e430eda4c37b1f8aae6d08dd2636aace8d66a96e19d02aa` |
| `src/infrastructure/project/saga-permission-service.ts` | `cb3d8329b86626f710e3f5da8e3f7679fe0d37333a4e9112ad61e9b4975aa919` |
| `src/lib/authenticatedUser.ts` | `d4cbf3a004f8375982ca03d474fb7b61559fc2ec58ad6fe7b1f8834d26abf10c` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `src/lib/localAdmin.ts` | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `src/lib/supabase.ts` | `267e73d6f3f4e24da8b048adbc620ee10e182ed5b6e6ab2afc1a352c7a58987c` |

