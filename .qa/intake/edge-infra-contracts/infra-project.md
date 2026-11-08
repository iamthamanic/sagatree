# Infrastructure contract: project

**Status: SPEC; current branch source verified.** Implementation issue: **#807**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-project.json](source-contracts/infra-project.json) (SHA-256 `73e8cb53c17509bb51f308177e111747d967a4846042f132261ae02b2d62e872`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Project creation/membership, default starter, join codes, selected character, saga permissions/bindings/overview/lore timeline span11 RPCs and direct project table operations.

Project owner, projects.gm_user_id, active member and delegated capabilities are distinct; codes and public IDs do not grant capabilities beyond joining contract.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (0): none.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 1.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| auth | `authenticated account/session transport` | #793 |  |

## Acceptance and negative tests (required, not executed)

- Create project/session,join by code,assign own eligible character and reload overview.
- All11 RPC dependencies must be available before facade swap, including permission bundles and reveal bindings.
- Wrong GM/member/cross-owner requests denied; reveal/permission changes alter player projection only as specified.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### auth-helper: session identity

`src/infrastructure/project/project-service.ts:366` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/project/project-service.ts:364`; complete request/default/result/error logic is in the declarations below and the snapshot.

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
    leaveProjectMembership: (actorId, projectId) =>
      ports.leaveProjectMembership(actorId, projectId),
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
  readonly leaveProjectMembership: (
    actorId: string,
    projectId: string,
  ) => Promise<HostProjectResult<{ readonly ok: true }>>;
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

### src/infrastructure/project/host-project-ports.contract.ts:107

```ts
export const HOST_PROJECT_RPC_NAMES = [
  'create_project_session',
  'ensure_native_starter_project',
  'get_my_saga_permissions',
  'get_saga_lore_timeline',
  'get_saga_overview',
  'join_project_by_code',
  'leave_project_membership',
  'list_saga_bindings',
  'list_saga_member_permission_state',
  'set_my_project_character',
  'set_saga_binding_reveal',
  'set_saga_member_bundle',
] as const;
```

### src/infrastructure/project/host-project-ports.contract.ts:122

```ts
export type HostProjectRpcName = (typeof HOST_PROJECT_RPC_NAMES)[number];
```

### src/infrastructure/project/host-project-ports.contract.ts:125

```ts
export const HOST_PROJECT_OPS = [
  'createProjectSession',
  'ensureNativeStarterProject',
  'getMySagaPermissions',
  'getSagaLoreTimeline',
  'getSagaOverview',
  'joinProjectByCode',
  'leaveProjectMembership',
  'listSagaBindings',
  'listSagaMemberPermissionState',
  'setMyProjectCharacter',
  'setSagaBindingReveal',
  'setSagaMemberBundle',
] as const;
```

### src/infrastructure/project/host-project-ports.contract.ts:140

```ts
export type HostProjectOp = (typeof HOST_PROJECT_OPS)[number];
```

### src/infrastructure/project/project-member-service.ts:29

```ts
export const projectMemberService = {
  async getMembers(projectId: string): Promise<ProjectMemberDto[]> {
    assertHost();
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
  },

  async joinByCode(dto: JoinProjectDto): Promise<ProjectMemberDto> {
    assertHost();
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
  },

  async updateCharacter(projectId: string, characterId: string): Promise<ProjectMemberDto> {
    assertHost();
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
  },

  /** Leave saga membership — host POST /api/v1/projects/:id/leave (CUT-23). */
  async leave(projectId: string, _userId: string): Promise<void> {
    void _userId;
    assertHost();
    await leaveHostProject(projectId);
  },

  /** Unused in product after CUT-20 — retained for contract stability. */
  async getMyProjects(_userId: string): Promise<ProjectMemberDto[]> {
    void _userId;
    return [];
  },
};
```

### src/infrastructure/project/project-service.ts:452

```ts
export const projectService = new ProjectService();
```

### src/infrastructure/project/saga-overview-service.ts:35

```ts
export const sagaOverviewService = new SagaOverviewService();
```

### src/infrastructure/project/saga-permission-service.ts:28

```ts
export type SagaMyPermissionsVm = {
  readonly projectId: string;
  readonly bundleId: SagaBundleId | null;
  readonly isGm: boolean;
  readonly keys: readonly SagaPermissionKey[];
};
```

### src/infrastructure/project/saga-permission-service.ts:35

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

### src/infrastructure/project/saga-permission-service.ts:44

```ts
export type SagaAssetBindingVm = {
  readonly id: string;
  readonly assetKind: SagaAssetKind;
  readonly assetId: string;
  readonly reveal: SagaRevealStatus;
  readonly label: string;
  readonly worldPlaceId?: string | null;
};
```

### src/infrastructure/project/saga-permission-service.ts:134

```ts
export const sagaPermissionService = {
  async getMyPermissions(sagaPublicId: string): Promise<SagaMyPermissionsVm> {
    assertHost();
    const publicId = sagaPublicId.trim().toUpperCase();
    const data = await fetchHostMySagaPermissions(publicId);
    return parseMyPermissions(data);
  },

  async listMemberPermissionState(
    sagaPublicId: string,
  ): Promise<SagaMemberPermissionStateVm[]> {
    assertHost();
    const publicId = sagaPublicId.trim().toUpperCase();
    const data = await listHostSagaMemberPermissionState(publicId);
    const members =
      data && typeof data === 'object' && Array.isArray((data as { members?: unknown }).members)
        ? (data as { members: unknown[] }).members
        : Array.isArray(data)
          ? data
          : [];
    return parseMemberState(members);
  },

  async setMemberBundle(input: {
    projectId: string;
    memberId: string;
    bundleId: SagaBundleId;
  }): Promise<void> {
    assertHost();
    await setHostSagaMemberBundle(input.projectId, input.memberId, input.bundleId);
  },

  async listBindings(
    sagaPublicId: string,
    assetKind?: SagaAssetKind | null,
  ): Promise<SagaAssetBindingVm[]> {
    assertHost();
    const publicId = sagaPublicId.trim().toUpperCase();
    const data = await listHostSagaBindings(publicId, assetKind ?? null);
    const bindings =
      data && typeof data === 'object' && Array.isArray((data as { bindings?: unknown }).bindings)
        ? (data as { bindings: unknown[] }).bindings
        : Array.isArray(data)
          ? data
          : [];
    return parseBindings(bindings);
  },

  async setBindingReveal(input: {
    projectId: string;
    bindingId: string;
    reveal: SagaRevealStatus;
  }): Promise<SagaAssetBindingVm> {
    assertHost();
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
  },

  async getLoreTimeline(sagaPublicId: string): Promise<SagaLoreTimelineVm> {
    assertHost();
    const publicId = sagaPublicId.trim().toUpperCase();
    const data = await fetchHostSagaLoreTimeline(publicId);
    return parseSagaLoreTimeline(data);
  },
};
```


## Remaining backend helper operations

### src/infrastructure/project/project-service.ts:364

```ts
async leaveProject(projectId: string): Promise<void> {
    assertHost();
    const userId = await getAuthenticatedUserId();
    await projectMemberService.leave(projectId, userId);
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
| `src/domains/session/contracts/session-lifecycle.ts` | `c70eb365aa31906dc8cd8f7a3cc2c5ed1141b5bab8489a1d56ced8a41c1ce5be` |
| `src/infrastructure/host/host-library-http.ts` | `c56b88c60d6c9491fc7b6e6e1143ac4985ffdab5dff16afef8a54bce79629a07` |
| `src/infrastructure/host/host-project-http.ts` | `287a426fb8645638e263a7b2d612d071eec4bf054cc778193b82f6b8252a0f92` |
| `src/infrastructure/host/host-session-http.ts` | `f0e603ecf93151669c7b809cb63aea3d0a98ed2ca17ae8f2768a5444bb9cab56` |
| `src/infrastructure/project/host-project-adapter.ts` | `f8137115741c452c865883275c6d95529faf29ca28620c5adc92eedc30002e90` |
| `src/infrastructure/project/host-project-ports.contract.ts` | `96d05101ba2cbe8364ae30bbcde48235a1058a65a43f733d03433d7f26a8236f` |
| `src/infrastructure/project/project-member-service.ts` | `40fc648e091c11dcdcf4535747d9db0cd6dc5da9e475663c3ff60dff9a53e594` |
| `src/infrastructure/project/project-service.ts` | `29846df2ae25287b68cba443a9c85f2f9952fa9cc1afd3faf762a78eb57a6fa6` |
| `src/infrastructure/project/saga-overview-service.ts` | `29f68ebd797d4fc19e5aaede3860e9bd2984bc7123fb37e4557f4a5ea5407a28` |
| `src/infrastructure/project/saga-permission-service.ts` | `e177bbfaa085cc5ab6a03f9ba437ba003766443da87b02cfaa2ae2348f9ec6e1` |
| `src/lib/authenticatedUser.ts` | `5d9deef60efd85a3ecd56e9b55f67ecb2d03c2964c4f9217e6de6842d8e0b403` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `src/lib/localAdmin.ts` | `103feaea892b0582022557ff81cef61105f3d9ed4eb421a20d8b0b415c2de498` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |

