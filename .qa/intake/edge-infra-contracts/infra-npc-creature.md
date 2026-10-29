# Infrastructure contract: npc-creature

**Status: SPEC; current branch source verified.** Implementation issue: **#806**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-npc-creature.json](source-contracts/infra-npc-creature.json) (SHA-256 `59d1477df9dabd87fccedc30a2dab1aee810a72ce5c060f14f2f7eecfbab6ffe`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Catalog definitions, controller assignments and session instances use repositories and five RPC operations; preserve promotion/demotion and temp-controller lifecycle.

Definition owner and project GM/controller are distinct. Instance runtime update RPC is GM-only, replaces runtime object and leaves snapshot unchanged; permanent or temporary controller assignment does not itself authorize mutation. Exact effective RPC guards and adapter casts are linked.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (5): `assign_npc_creature_controller`, `clear_npc_creature_instance_temp_controllers_for_session`, `remove_npc_creature_instance`, `spawn_npc_creature_instance`, `update_npc_creature_instance_runtime`.

Tables (4): `npc_creature_controller_assignments`, `npc_creature_definitions`, `npc_creature_instances`, `world_profiles`.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 12.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `assign_npc_creature_controller` | #816 | RPC-NPC-INSTANCES |
| rpc | `clear_npc_creature_instance_temp_controllers_for_session` | #816 | RPC-NPC-INSTANCES |
| rpc | `remove_npc_creature_instance` | #816 | RPC-NPC-INSTANCES |
| rpc | `spawn_npc_creature_instance` | #816 | RPC-NPC-INSTANCES |
| rpc | `update_npc_creature_instance_runtime` | #816 | RPC-NPC-INSTANCES |
| table | `npc_creature_controller_assignments` | #791 | Policy #792 |
| table | `npc_creature_definitions` | #791 | Policy #792 |
| table | `npc_creature_instances` | #791 | Policy #792 |
| table | `world_profiles` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |

## Acceptance and negative tests (required, not executed)

- Create/read/update allowed definitions; spawn/update/remove session instance through documented RPC and reload.
- Assign/revoke controller and clear only session-scoped temporary controllers; wrong owner/player mutation denied.
- Contract fixture for assign_npc_creature_controller: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for clear_npc_creature_instance_temp_controllers_for_session: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for remove_npc_creature_instance: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for spawn_npc_creature_instance: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for update_npc_creature_instance_runtime: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### auth-helper: session identity

`src/infrastructure/npc-creature/npc-creature-service.ts:236` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:232`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: npc_creature_controller_assignments

`src/infrastructure/npc-creature/npc-creature-service.ts:238` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(CONTROLLER_TABLE)
      .select('project_id, definition_id, controller_user_id, assigned_by, updated_at')
      .eq('project_id', projectId)
      .eq('definition_id', definitionId)
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:232`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/npc-creature/npc-creature-service.ts:264` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:258`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: assign_npc_creature_controller

`src/infrastructure/npc-creature/npc-creature-service.ts:288` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('assign_npc_creature_controller', {
      p_project_id: planned.assignment.projectId,
      p_definition_id: planned.assignment.definitionId,
      p_controller_user_id: planned.assignment.controllerUserId,
    })
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:258`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/npc-creature/npc-creature-service.ts:325` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:322`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: npc_creature_instances

`src/infrastructure/npc-creature/npc-creature-service.ts:327` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(INSTANCES_TABLE)
      .select(
        'id, project_id, session_id, definition_id, display_name, instance_kind, sequence_number, snapshot, runtime, created_by, created_at, updated_at',
      )
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:322`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/npc-creature/npc-creature-service.ts:356` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:348`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: spawn_npc_creature_instance

`src/infrastructure/npc-creature/npc-creature-service.ts:389` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('spawn_npc_creature_instance', {
      p_project_id: planned.instance.projectId,
      p_definition_id: planned.instance.definitionId,
      p_instance_kind: planned.instance.instanceKind,
      p_snapshot: toInstanceSnapshotPayload(planned.instance.snapshot),
      p_runtime: toInstanceRuntimePayload(planned.instance.runtime),
      p_display_name: planned.instance.displayName,
      p_sequence_number: planned.instance.sequenceNumber,
      p_session_id: planned.instance.sessionId,
    })
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:348`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/npc-creature/npc-creature-service.ts:417` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:412`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: update_npc_creature_instance_runtime

`src/infrastructure/npc-creature/npc-creature-service.ts:432` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('update_npc_creature_instance_runtime', {
      p_instance_id: planned.instance.id,
      p_runtime: toInstanceRuntimePayload(planned.instance.runtime),
    })
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:412`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/npc-creature/npc-creature-service.ts:450` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:449`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: remove_npc_creature_instance

`src/infrastructure/npc-creature/npc-creature-service.ts:452` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('remove_npc_creature_instance', {
      p_instance_id: instanceId,
    })
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:449`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/npc-creature/npc-creature-service.ts:470` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:467`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: clear_npc_creature_instance_temp_controllers_for_session

`src/infrastructure/npc-creature/npc-creature-service.ts:472` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('clear_npc_creature_instance_temp_controllers_for_session', {
      p_session_id: sessionId,
    })
```

Enclosing operation: `src/infrastructure/npc-creature/npc-creature-service.ts:467`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:40` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:35`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: npc_creature_definitions

`src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:42` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(TABLE).select(NPC_CREATURE_DEFINITION_COLUMNS)
```

Enclosing operation: `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:35`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:68` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:67`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:75` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:72`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:99` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:94`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: npc_creature_definitions

`src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:116` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .update({
        payload: write.payload,
        payload_version: write.payload_version,
      })
      .eq('id', definitionId)
      .eq('scope', scope)
```

Enclosing operation: `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:94`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:158` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:153`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: npc_creature_definitions

`src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:173` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(TABLE)
      .update({ status })
      .eq('id', definitionId)
      .eq('scope', scope)
```

Enclosing operation: `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:153`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: npc_creature_definitions

`src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:206` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(TABLE)
        .select(NPC_CREATURE_DEFINITION_COLUMNS)
        .eq('id', definitionId)
        .maybeSingle()
```

Enclosing operation: `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:202`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: npc_creature_definitions

`src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:231` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(TABLE)
        .insert({
          id,
          scope,
          world_profile_id: worldProfileId,
          // Derived from the authenticated session, never from client input.
          owner_user_id: ownerUserId,
          payload: write.payload,
          payload_version: write.payload_version,
          status: 'active',
        })
        .select(NPC_CREATURE_DEFINITION_COLUMNS)
        .maybeSingle()
```

Enclosing operation: `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:221`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: world_profiles

`src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:266` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from('world_profiles')
        .select('modules')
        .eq('id', id)
        .maybeSingle()
```

Enclosing operation: `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:261`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/npc-creature/host-npc-creature-adapter.ts:12

```ts
export type HostNpcCreatureAdapter = HostNpcCreaturePorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_NPC_CREATURE_OPS;
};
```

### src/infrastructure/npc-creature/host-npc-creature-adapter.ts:21

```ts
export function createHostNpcCreatureAdapter(
  ports: HostNpcCreaturePorts,
): HostNpcCreatureAdapter {
  return {
    transport: 'host',
    ops: HOST_NPC_CREATURE_OPS,
    listDefinitions: (actorId, options) => ports.listDefinitions(actorId, options),
    getDefinition: (actorId, definitionId) => ports.getDefinition(actorId, definitionId),
    createDefinition: (actorId, input) => ports.createDefinition(actorId, input),
    updateDefinition: (actorId, definitionId, draft) =>
      ports.updateDefinition(actorId, definitionId, draft),
    archiveDefinition: (actorId, definitionId) =>
      ports.archiveDefinition(actorId, definitionId),
    restoreDefinition: (actorId, definitionId) =>
      ports.restoreDefinition(actorId, definitionId),
    duplicateDefinition: (actorId, sourceDefinitionId) =>
      ports.duplicateDefinition(actorId, sourceDefinitionId),
    assignController: (actorId, projectId, definitionId, controllerUserId) =>
      ports.assignController(actorId, projectId, definitionId, controllerUserId),
    spawnInstance: (actorId, input) => ports.spawnInstance(actorId, input),
    updateRuntime: (actorId, instanceId, runtime) =>
      ports.updateRuntime(actorId, instanceId, runtime),
    removeInstance: (actorId, instanceId) => ports.removeInstance(actorId, instanceId),
    clearTempControllersForSession: (actorId, sessionId) =>
      ports.clearTempControllersForSession(actorId, sessionId),
  };
}
```

### src/infrastructure/npc-creature/host-npc-creature-ports.contract.ts:10

```ts
export type HostNpcCreatureResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };
```

### src/infrastructure/npc-creature/host-npc-creature-ports.contract.ts:14

```ts
export type HostNpcDefinitionRecord = {
  readonly id: string;
  readonly publicId: string;
  readonly scope: 'personal' | 'world' | 'core' | 'builtin';
  readonly worldProfileId: string | null;
  readonly ownerUserId: string | null;
  readonly status: 'active' | 'archived';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly payloadVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};
```

### src/infrastructure/npc-creature/host-npc-creature-ports.contract.ts:27

```ts
export type HostNpcInstanceRow = {
  readonly id: string;
  readonly projectId: string;
  readonly sessionId: string | null;
  readonly definitionId: string;
  readonly displayName: string;
  readonly instanceKind: string;
  readonly sequenceNumber: number;
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly runtime: Readonly<Record<string, unknown>>;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};
```

### src/infrastructure/npc-creature/host-npc-creature-ports.contract.ts:42

```ts
export type HostNpcControllerAssignmentRow = {
  readonly projectId: string;
  readonly definitionId: string;
  readonly controllerUserId: string | null;
  readonly assignedBy: string;
  readonly updatedAt: string;
};
```

### src/infrastructure/npc-creature/host-npc-creature-ports.contract.ts:54

```ts
export type HostNpcCreaturePorts = {
  readonly listDefinitions: (
    actorId: string,
    options?: {
      readonly scope?: 'personal' | 'world' | 'core' | 'builtin';
      readonly worldProfileId?: string | null;
      readonly includeArchived?: boolean;
    },
  ) => Promise<HostNpcCreatureResult<readonly HostNpcDefinitionRecord[]>>;
  readonly getDefinition: (
    actorId: string,
    definitionId: string,
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord | null>>;
  readonly createDefinition: (
    actorId: string,
    input: {
      readonly scope: 'personal' | 'world';
      readonly worldProfileId?: string | null;
      readonly draft: unknown;
    },
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord>>;
  readonly updateDefinition: (
    actorId: string,
    definitionId: string,
    draft: unknown,
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord>>;
  readonly archiveDefinition: (
    actorId: string,
    definitionId: string,
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord>>;
  readonly restoreDefinition: (
    actorId: string,
    definitionId: string,
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord>>;
  readonly duplicateDefinition: (
    actorId: string,
    sourceDefinitionId: string,
  ) => Promise<HostNpcCreatureResult<HostNpcDefinitionRecord>>;
  readonly assignController: (
    actorId: string,
    projectId: string,
    definitionId: string,
    controllerUserId: string | null,
  ) => Promise<HostNpcCreatureResult<HostNpcControllerAssignmentRow>>;
  readonly spawnInstance: (
    actorId: string,
    input: {
      readonly projectId: string;
      readonly definitionId: string;
      readonly instanceKind: string;
      readonly snapshot: unknown;
      readonly runtime: unknown;
      readonly displayName: string;
      readonly sequenceNumber: number;
      readonly sessionId?: string | null;
    },
  ) => Promise<HostNpcCreatureResult<HostNpcInstanceRow>>;
  readonly updateRuntime: (
    actorId: string,
    instanceId: string,
    runtime: unknown,
  ) => Promise<HostNpcCreatureResult<HostNpcInstanceRow>>;
  readonly removeInstance: (
    actorId: string,
    instanceId: string,
  ) => Promise<HostNpcCreatureResult<{ readonly id: string }>>;
  readonly clearTempControllersForSession: (
    actorId: string,
    sessionId: string,
  ) => Promise<HostNpcCreatureResult<{ readonly cleared: number }>>;
};
```

### src/infrastructure/npc-creature/host-npc-creature-ports.contract.ts:127

```ts
export const HOST_NPC_CREATURE_OPS = [
  'listDefinitions',
  'getDefinition',
  'createDefinition',
  'updateDefinition',
  'archiveDefinition',
  'restoreDefinition',
  'duplicateDefinition',
  'assignController',
  'spawnInstance',
  'updateRuntime',
  'removeInstance',
  'clearTempControllersForSession',
] as const;
```

### src/infrastructure/npc-creature/host-npc-creature-ports.contract.ts:142

```ts
export type HostNpcCreatureOp = (typeof HOST_NPC_CREATURE_OPS)[number];
```

### src/infrastructure/npc-creature/npc-creature-controller.persistence.ts:7

```ts
export interface NpcControllerAssignmentRow {
  project_id: string;
  definition_id: string;
  controller_user_id: string | null;
  assigned_by: string;
  updated_at: string;
}
```

### src/infrastructure/npc-creature/npc-creature-controller.persistence.ts:15

```ts
export function toNpcControllerAssignment(
  row: NpcControllerAssignmentRow,
): NpcControllerAssignment {
  return {
    projectId: row.project_id,
    definitionId: row.definition_id,
    controllerUserId: row.controller_user_id,
  };
}
```

### src/infrastructure/npc-creature/npc-creature-instance.persistence.ts:13

```ts
export interface NpcCreatureInstanceRow {
  id: string;
  project_id: string;
  session_id: string | null;
  definition_id: string;
  display_name: string;
  instance_kind: string;
  sequence_number: number;
  snapshot: unknown;
  runtime: unknown;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}
```

### src/infrastructure/npc-creature/npc-creature-instance.persistence.ts:75

```ts
export function toNpcCreatureInstance(row: NpcCreatureInstanceRow): NpcCreatureInstance {
  const kind: NpcCreatureInstanceKind =
    row.instance_kind === 'persistent' ? 'persistent' : 'generic';
  return {
    id: row.id,
    projectId: row.project_id,
    sessionId: row.session_id,
    definitionId: row.definition_id,
    displayName: row.display_name,
    instanceKind: kind,
    sequenceNumber: row.sequence_number,
    snapshot: parseSnapshot(row.snapshot),
    runtime: parseRuntime(row.runtime),
  };
}
```

### src/infrastructure/npc-creature/npc-creature-instance.persistence.ts:91

```ts
export function toInstanceRuntimePayload(
  runtime: NpcCreatureInstanceRuntime,
): Record<string, unknown> {
  return {
    currentHp: runtime.currentHp,
    conditions: [...runtime.conditions],
    temporaryControllerUserId: runtime.temporaryControllerUserId,
    encounterNotes: runtime.encounterNotes,
  };
}
```

### src/infrastructure/npc-creature/npc-creature-instance.persistence.ts:102

```ts
export function toInstanceSnapshotPayload(
  snapshot: NpcCreatureDefinitionSnapshot,
): Record<string, unknown> {
  return {
    name: snapshot.name,
    kind: snapshot.kind,
    category: snapshot.category,
    sheetMode: snapshot.sheetMode,
    level: snapshot.level,
    combatProfile: snapshot.combatProfile,
    combatRole: snapshot.combatRole,
    tags: [...snapshot.tags],
    portraitAssetKey: snapshot.portraitAssetKey ?? null,
    notes: snapshot.notes ?? null,
    maxHealth: snapshot.maxHealth,
    capturedAt: snapshot.capturedAt,
  };
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:56

```ts
export async function listNpcCreatureDefinitions(options?: {
  scope?: NpcCreatureScope;
  worldProfileId?: string | null;
  includeArchived?: boolean;
}): Promise<NpcCreatureCatalogRecord[]> {
  return supabaseNpcCreatureRepository.listDefinitions(options);
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:64

```ts
export async function getNpcCreatureDefinition(
  definitionId: string,
): Promise<NpcCreatureCatalogRecord | null> {
  return supabaseNpcCreatureRepository.getDefinitionById(definitionId);
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:70

```ts
export async function createNpcCreatureDefinition(
  input: CreateNpcCreatureDefinitionInput,
): Promise<NpcCreatureCatalogRecord> {
  return supabaseNpcCreatureRepository.createDefinition(input);
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:76

```ts
export async function updateNpcCreatureDefinition(
  input: UpdateNpcCreatureDefinitionInput,
): Promise<NpcCreatureCatalogRecord> {
  return supabaseNpcCreatureRepository.updateDefinition(input);
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:82

```ts
export async function archiveNpcCreatureDefinition(
  definitionId: string,
): Promise<NpcCreatureCatalogRecord> {
  return supabaseNpcCreatureRepository.archiveDefinition(definitionId);
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:98

```ts
export async function duplicateNpcCreatureDefinition(
  definitionId: string,
  sourceDefinition?: NpcCreatureDefinition,
): Promise<NpcCreatureCatalogRecord> {
  let definition = sourceDefinition ?? null;
  if (!definition) {
    const existing = await supabaseNpcCreatureRepository.getDefinitionById(definitionId);
    if (!existing) {
      throw new Error('Definition nicht gefunden.');
    }
    definition = existing.definition;
  }
  const { id: _id, scope: _scope, ...rest } = definition;
  return supabaseNpcCreatureRepository.createDefinition({
    target: { scope: 'personal' },
    draft: { ...rest, name: personalCopyName(rest.name) },
  });
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:117

```ts
export async function restoreNpcCreatureDefinition(
  definitionId: string,
): Promise<NpcCreatureCatalogRecord> {
  return supabaseNpcCreatureRepository.restoreDefinition(definitionId);
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:124

```ts
export function toNpcCreatureDefinitionSummaries(
  records: readonly NpcCreatureCatalogRecord[],
): NpcCreatureDefinitionSummary[] {
  return records.map((record) => {
    const derived = deriveNpcCreaturePower(record.definition);
    return {
      definition: record.definition,
      machtgradLabel: derived.machtgradLabel,
      status: record.status,
      scope: record.definition.scope,
      worldProfileId: record.worldProfileId,
    };
  });
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:143

```ts
export async function loadWorldProfileNpcCreatureCatalog(
  worldProfileId: string,
): Promise<NpcCreatureCatalogRecord[]> {
  return supabaseNpcCreatureRepository.listDefinitions({
    scope: 'world',
    worldProfileId,
    includeArchived: true,
  });
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:153

```ts
export interface WorldNpcCreatureAvailability {
  config: NpcCreatureCatalogModuleConfig;
  resolved: ResolvedWorldNpcCreatureCatalog;
  worldRecords: NpcCreatureCatalogRecord[];
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:163

```ts
export async function loadWorldNpcCreatureAvailability(
  worldProfileId: string,
): Promise<WorldNpcCreatureAvailability> {
  const [modules, worldRecords, personalRecords] = await Promise.all([
    supabaseNpcCreatureRepository.loadWorldProfileModules(worldProfileId),
    loadWorldProfileNpcCreatureCatalog(worldProfileId),
    supabaseNpcCreatureRepository.listDefinitions({
      scope: 'personal',
      includeArchived: false,
    }),
  ]);
  const { config } = getNpcCreatureCatalogModuleConfig(modules);
  const worldDefinitions = worldRecords
    .filter((record) => record.status === 'active')
    .map((record) => record.definition);
  const personalDefinitions = personalRecords.map((record) => record.definition);

  const resolveDefinition = (
    definitionId: string,
  ): NpcCreatureDefinition | undefined => {
    const builtin = getBuiltinNpcCreatureDefinition(definitionId);
    if (builtin) return builtin;
    const core = getCoreNpcCreatureDefinition(definitionId);
    if (core) return core;
    const world = worldDefinitions.find((entry) => entry.id === definitionId);
    if (world) return world;
    return personalDefinitions.find((entry) => entry.id === definitionId);
  };

  const resolved = resolveWorldNpcCreatureCatalog({
    config,
    coreDefinitions: listCoreNpcCreatureDefinitions(),
    resolveDefinition,
    worldDefinitions,
    personalDefinitions,
  });

  return { config, resolved, worldRecords };
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:206

```ts
export async function promoteNpcCreatureCompactToFull(input: {
  definitionId: string;
  fullSheet: Readonly<Record<string, unknown>>;
}): Promise<NpcCreatureCatalogRecord> {
  const attrsCheck = assertFullSheetHasNoSilentIllegalAttributes(input.fullSheet);
  if (attrsCheck.ok === false) {
    throw new Error(attrsCheck.message);
  }

  const existing = await supabaseNpcCreatureRepository.getDefinitionById(input.definitionId);
  if (!existing) {
    throw new Error('Figur wurde nicht gefunden.');
  }

  const draft = buildCompactToFullWriteDraft(existing.definition, input.fullSheet);
  if (!draft) {
    throw new Error('Compact→Full-Entwurf ungültig — Full Sheet fehlt oder ist leer.');
  }

  return supabaseNpcCreatureRepository.updateDefinition({
    definitionId: input.definitionId,
    draft,
  });
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:232

```ts
export async function getNpcCreatureControllerAssignment(
  projectId: string,
  definitionId: string,
): Promise<NpcControllerAssignment | null> {
  await getAuthenticatedUserId();
  const { data, error } = await raceWithTimeoutReject(
    supabase
      .from(CONTROLLER_TABLE)
      .select('project_id, definition_id, controller_user_id, assigned_by, updated_at')
      .eq('project_id', projectId)
      .eq('definition_id', definitionId)
      .maybeSingle(),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Controller-Zuweisung konnte nicht geladen werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Controller-Zuweisung konnte nicht geladen werden: ${error.message}`);
  }
  if (!data) return null;
  return toNpcControllerAssignment(data as NpcControllerAssignmentRow);
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:258

```ts
export async function assignNpcCreatureController(input: {
  projectId: string;
  definitionId: string;
  controllerUserId: string | null;
  activeMemberUserIds: readonly string[];
}): Promise<NpcControllerAssignment> {
  const actorUserId = await getAuthenticatedUserId();
  const record = await supabaseNpcCreatureRepository.getDefinitionById(input.definitionId);
  if (!record) {
    throw new Error('Figur wurde nicht gefunden.');
  }

  const planned = planNpcControllerAssignment(
    record.definition,
    {
      projectId: input.projectId,
      definitionId: input.definitionId,
      controllerUserId: input.controllerUserId,
    },
    {
      actorUserId,
      actorRole: 'gm',
      activeMemberUserIds: input.activeMemberUserIds,
    },
  );
  if (planned.ok === false) {
    throw new Error(planned.message);
  }

  const { data, error } = await raceWithTimeoutReject(
    supabase.rpc('assign_npc_creature_controller', {
      p_project_id: planned.assignment.projectId,
      p_definition_id: planned.assignment.definitionId,
      p_controller_user_id: planned.assignment.controllerUserId,
    }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Controller konnte nicht zugewiesen werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Controller konnte nicht zugewiesen werden: ${error.message}`);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Controller konnte nicht zugewiesen werden.');
  }
  return toNpcControllerAssignment(data as NpcControllerAssignmentRow);
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:322

```ts
export async function listNpcCreatureInstances(
  projectId: string,
): Promise<NpcCreatureInstance[]> {
  await getAuthenticatedUserId();
  const { data, error } = await raceWithTimeoutReject(
    supabase
      .from(INSTANCES_TABLE)
      .select(
        'id, project_id, session_id, definition_id, display_name, instance_kind, sequence_number, snapshot, runtime, created_by, created_at, updated_at',
      )
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Instanzen konnten nicht geladen werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Instanzen konnten nicht geladen werden: ${error.message}`);
  }
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => toNpcCreatureInstance(row as NpcCreatureInstanceRow));
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:348

```ts
export async function spawnNpcCreatureInstance(input: {
  projectId: string;
  sessionId?: string | null;
  definitionId: string;
  instanceKind: NpcCreatureInstanceKind;
  displayName?: string | null;
  activeMemberUserIds: readonly string[];
}): Promise<NpcCreatureInstance> {
  const actorUserId = await getAuthenticatedUserId();
  const definition = await resolveDefinitionForInstance(input.definitionId);
  if (!definition) {
    throw new Error('Figuren-Vorlage wurde nicht gefunden.');
  }

  const existing = await listNpcCreatureInstances(input.projectId);
  const definitionReadable =
    isBuiltinOrCoreDefinitionId(definition.id)
    || Boolean(await supabaseNpcCreatureRepository.getDefinitionById(definition.id));

  const planned = planNpcCreatureInstanceSpawn(
    definition,
    {
      projectId: input.projectId,
      sessionId: input.sessionId ?? null,
      definitionId: input.definitionId,
      instanceKind: input.instanceKind,
      displayName: input.displayName ?? null,
    },
    {
      actorUserId,
      actorRole: 'gm',
      activeMemberUserIds: input.activeMemberUserIds,
      existingInstances: existing,
      definitionReadable,
    },
  );
  if (planned.ok === false) {
    throw new Error(planned.message);
  }

  const { data, error } = await raceWithTimeoutReject(
    supabase.rpc('spawn_npc_creature_instance', {
      p_project_id: planned.instance.projectId,
      p_definition_id: planned.instance.definitionId,
      p_instance_kind: planned.instance.instanceKind,
      p_snapshot: toInstanceSnapshotPayload(planned.instance.snapshot),
      p_runtime: toInstanceRuntimePayload(planned.instance.runtime),
      p_display_name: planned.instance.displayName,
      p_sequence_number: planned.instance.sequenceNumber,
      p_session_id: planned.instance.sessionId,
    }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Instanz konnte nicht erzeugt werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Instanz konnte nicht erzeugt werden: ${error.message}`);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Instanz konnte nicht erzeugt werden.');
  }
  return toNpcCreatureInstance(data as NpcCreatureInstanceRow);
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:412

```ts
export async function updateNpcCreatureInstanceRuntime(input: {
  instance: NpcCreatureInstance;
  patch: NpcCreatureInstanceRuntimeUpdate;
  activeMemberUserIds: readonly string[];
}): Promise<NpcCreatureInstance> {
  const actorUserId = await getAuthenticatedUserId();
  const planned = planNpcCreatureInstanceRuntimeUpdate(
    input.instance,
    input.patch,
    {
      actorUserId,
      actorRole: 'gm',
      activeMemberUserIds: input.activeMemberUserIds,
    },
  );
  if (planned.ok === false) {
    throw new Error(planned.message);
  }

  const { data, error } = await raceWithTimeoutReject(
    supabase.rpc('update_npc_creature_instance_runtime', {
      p_instance_id: planned.instance.id,
      p_runtime: toInstanceRuntimePayload(planned.instance.runtime),
    }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Instanz-Status konnte nicht gespeichert werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Instanz-Status konnte nicht gespeichert werden: ${error.message}`);
  }
  if (!data || typeof data !== 'object') {
    throw new Error('Instanz-Status konnte nicht gespeichert werden.');
  }
  return toNpcCreatureInstance(data as NpcCreatureInstanceRow);
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:449

```ts
export async function removeNpcCreatureInstance(instanceId: string): Promise<void> {
  await getAuthenticatedUserId();
  const { error } = await raceWithTimeoutReject(
    supabase.rpc('remove_npc_creature_instance', {
      p_instance_id: instanceId,
    }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Instanz konnte nicht entfernt werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(`Instanz konnte nicht entfernt werden: ${error.message}`);
  }
}
```

### src/infrastructure/npc-creature/npc-creature-service.ts:467

```ts
export async function clearNpcCreatureInstanceTempControllersForSession(
  sessionId: string,
): Promise<number> {
  await getAuthenticatedUserId();
  const { data, error } = await raceWithTimeoutReject(
    supabase.rpc('clear_npc_creature_instance_temp_controllers_for_session', {
      p_session_id: sessionId,
    }),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Temporäre Controller konnten nicht zurückgesetzt werden (Zeitüberschreitung).',
  );
  if (error) {
    throw new Error(
      `Temporäre Controller konnten nicht zurückgesetzt werden: ${error.message}`,
    );
  }
  return typeof data === 'number' ? data : 0;
}
```

### src/infrastructure/npc-creature/npc-creature.persistence.ts:18

```ts
export type PersistedNpcCreatureScope = Extract<NpcCreatureScope, 'world' | 'personal'>;
```

### src/infrastructure/npc-creature/npc-creature.persistence.ts:21

```ts
export interface NpcCreatureDefinitionDto {
  id: string;
  public_id?: string | null;
  scope: PersistedNpcCreatureScope;
  world_profile_id: string | null;
  owner_user_id: string;
  payload: unknown;
  status: NpcCreatureStatus;
  payload_version: number;
  created_at: string;
  updated_at: string;
}
```

### src/infrastructure/npc-creature/npc-creature.persistence.ts:34

```ts
export const NPC_CREATURE_DEFINITION_COLUMNS =
  'id, public_id, scope, world_profile_id, owner_user_id, payload, status, payload_version, created_at, updated_at';
```

### src/infrastructure/npc-creature/npc-creature.persistence.ts:41

```ts
export function mapNpcCreatureDefinitionRow(
  dto: NpcCreatureDefinitionDto,
): NpcCreatureCatalogRecord | null {
  const definition = parseNpcCreatureDefinition(dto.id, dto.scope, dto.payload);
  if (!definition) return null;
  const publicId =
    typeof dto.public_id === 'string' && dto.public_id.trim()
      ? dto.public_id.trim().toUpperCase()
      : null;
  return {
    definition,
    status: dto.status === 'archived' ? 'archived' : 'active',
    worldProfileId: dto.world_profile_id,
    ownerUserId: dto.owner_user_id,
    publicId,
  };
}
```

### src/infrastructure/npc-creature/npc-creature.persistence.ts:60

```ts
export function toPersistedNpcCreatureWrite(
  definition: NpcCreatureDefinition,
): { payload: Record<string, unknown>; payload_version: number } {
  return {
    payload: toNpcCreatureDefinitionPayload(definition),
    payload_version: NPC_CREATURE_DEFINITION_PAYLOAD_VERSION,
  };
}
```

### src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:34

```ts
export class SupabaseNpcCreatureRepository implements NpcCreatureDefinitionRepository {
  async listDefinitions(options?: {
    scope?: NpcCreatureScope;
    worldProfileId?: string | null;
    includeArchived?: boolean;
  }): Promise<NpcCreatureCatalogRecord[]> {
    await getAuthenticatedUserId();

    let query = supabase.from(TABLE).select(NPC_CREATURE_DEFINITION_COLUMNS);
    if (options?.scope) {
      query = query.eq('scope', options.scope);
    }
    if (options?.worldProfileId) {
      query = query.eq('world_profile_id', assertUuid(options.worldProfileId, 'Weltprofil'));
    }
    if (!options?.includeArchived) {
      query = query.eq('status', 'active');
    }

    const { data, error } = await raceWithTimeoutReject(
      query.order('updated_at', { ascending: false }),
      SUPABASE_QUERY_TIMEOUT_MS,
      'NPC-/Kreaturen-Definitionen konnten nicht geladen werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`NPC-/Kreaturen-Definitionen konnten nicht geladen werden: ${error.message}`);
    }

    return ((data ?? []) as NpcCreatureDefinitionDto[])
      .map(mapNpcCreatureDefinitionRow)
      .filter((record): record is NpcCreatureCatalogRecord => record !== null);
  }

  async getDefinitionById(definitionId: string): Promise<NpcCreatureCatalogRecord | null> {
    await getAuthenticatedUserId();
    return this.loadPersistedRecord(definitionId);
  }

  async createDefinition(
    input: CreateNpcCreatureDefinitionInput,
  ): Promise<NpcCreatureCatalogRecord> {
    const userId = await getAuthenticatedUserId();
    const { target, draft } = input;

    if (target.scope === 'personal') {
      const context = { userId, editableWorldProfileIds: [] as const };
      if (!canCreateNpcCreatureDefinition('personal', context)) {
        throw new Error('Persönliche Definition nicht erlaubt.');
      }
      return this.insertDefinition('personal', draft, userId, null);
    }

    const worldProfileId = assertUuid(target.worldProfileId, 'Weltprofil');
    const context = { userId, editableWorldProfileIds: [worldProfileId] };
    if (!canCreateNpcCreatureDefinition('world', context, worldProfileId)) {
      throw new Error('Welt-Definition nicht erlaubt.');
    }
    return this.insertDefinition('world', draft, userId, worldProfileId);
  }

  async updateDefinition(
    input: UpdateNpcCreatureDefinitionInput,
  ): Promise<NpcCreatureCatalogRecord> {
    const definitionId = input.definitionId;
    assertPersistedId(definitionId);
    const userId = await getAuthenticatedUserId();
    const existing = await this.loadPersistedRecord(definitionId);
    if (!existing) {
      throw new Error('Definition konnte nicht gespeichert werden.');
    }

    if (existing.definition.scope === 'personal') {
      if (!canMutateNpcCreatureDefinition(existing, { userId, editableWorldProfileIds: [] })) {
        throw new Error('Definition konnte nicht gespeichert werden.');
      }
    } else if (existing.definition.scope !== 'world' || !existing.worldProfileId) {
      throw new Error('Definition konnte nicht gespeichert werden.');
    }

    const scope = scopeOfId(definitionId);
    const write = assertWritable(definitionId, scope, input.draft);

    let query = supabase
      .from(TABLE)
      .update({
        payload: write.payload,
        payload_version: write.payload_version,
      })
      .eq('id', definitionId)
      .eq('scope', scope);

    if (scope === 'personal') {
      query = query.eq('owner_user_id', userId);
    } else {
      query = query.eq(
        'world_profile_id',
        assertUuid(existing.worldProfileId as string, 'Weltprofil'),
      );
    }

    const { data, error } = await raceWithTimeoutReject(
      query.select(NPC_CREATURE_DEFINITION_COLUMNS).maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Definition konnte nicht gespeichert werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Definition konnte nicht gespeichert werden: ${error.message}`);
    }
    return requireRecord(data as NpcCreatureDefinitionDto | null, 'Definition konnte nicht gespeichert werden.');
  }

  async archiveDefinition(definitionId: string): Promise<NpcCreatureCatalogRecord> {
    return this.setStatus(definitionId, 'archived');
  }

  async restoreDefinition(definitionId: string): Promise<NpcCreatureCatalogRecord> {
    return this.setStatus(definitionId, 'active');
  }

  private async setStatus(
    definitionId: string,
    status: 'active' | 'archived',
  ): Promise<NpcCreatureCatalogRecord> {
    assertPersistedId(definitionId);
    const userId = await getAuthenticatedUserId();
    const existing = await this.loadPersistedRecord(definitionId);
    if (!existing) {
      throw new Error('Definition konnte nicht aktualisiert werden.');
    }

    if (existing.definition.scope === 'personal') {
      if (!canMutateNpcCreatureDefinition(existing, { userId, editableWorldProfileIds: [] })) {
        throw new Error('Definition konnte nicht aktualisiert werden.');
      }
    } else if (existing.definition.scope !== 'world' || !existing.worldProfileId) {
      throw new Error('Definition konnte nicht aktualisiert werden.');
    }

    const scope = scopeOfId(definitionId);
    let query = supabase
      .from(TABLE)
      .update({ status })
      .eq('id', definitionId)
      .eq('scope', scope);

    if (scope === 'personal') {
      query = query.eq('owner_user_id', userId);
    } else {
      query = query.eq(
        'world_profile_id',
        assertUuid(existing.worldProfileId as string, 'Weltprofil'),
      );
    }

    const { data, error } = await raceWithTimeoutReject(
      query.select(NPC_CREATURE_DEFINITION_COLUMNS).maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Definition konnte nicht aktualisiert werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Definition konnte nicht aktualisiert werden: ${error.message}`);
    }
    return requireRecord(
      data as NpcCreatureDefinitionDto | null,
      'Definition konnte nicht aktualisiert werden.',
    );
  }

  private async loadPersistedRecord(
    definitionId: string,
  ): Promise<NpcCreatureCatalogRecord | null> {
    const { data, error } = await raceWithTimeoutReject(
      supabase
        .from(TABLE)
        .select(NPC_CREATURE_DEFINITION_COLUMNS)
        .eq('id', definitionId)
        .maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Definition konnte nicht geladen werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Definition konnte nicht geladen werden: ${error.message}`);
    }
    if (!data) return null;
    return mapNpcCreatureDefinitionRow(data as NpcCreatureDefinitionDto);
  }

  private async insertDefinition(
    scope: PersistedNpcCreatureScope,
    draft: NpcCreatureDefinitionWriteDraft,
    ownerUserId: string,
    worldProfileId: string | null,
  ): Promise<NpcCreatureCatalogRecord> {
    const id = `${scope}:${crypto.randomUUID()}`;
    const write = assertWritable(id, scope, draft);

    const { data, error } = await raceWithTimeoutReject(
      supabase
        .from(TABLE)
        .insert({
          id,
          scope,
          world_profile_id: worldProfileId,
          // Derived from the authenticated session, never from client input.
          owner_user_id: ownerUserId,
          payload: write.payload,
          payload_version: write.payload_version,
          status: 'active',
        })
        .select(NPC_CREATURE_DEFINITION_COLUMNS)
        .maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Definition konnte nicht angelegt werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Definition konnte nicht angelegt werden: ${error.message}`);
    }
    return requireRecord(
      data as NpcCreatureDefinitionDto | null,
      'Definition konnte nicht angelegt werden.',
    );
  }

  /**
   * Read world_profiles.modules for catalog compose (#199).
   * Same shape as item-catalog repository — modules JSONB only.
   */
  async loadWorldProfileModules(
    worldProfileId: string,
  ): Promise<Record<string, unknown> | null> {
    const id = assertUuid(worldProfileId, 'Weltprofil');
    const { data, error } = await raceWithTimeoutReject(
      supabase
        .from('world_profiles')
        .select('modules')
        .eq('id', id)
        .maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Weltmodule konnten nicht geladen werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Failed to load world profile modules: ${error.message}`);
    }
    if (
      !data ||
      typeof data.modules !== 'object' ||
      data.modules === null ||
      Array.isArray(data.modules)
    ) {
      return null;
    }
    return data.modules as Record<string, unknown>;
  }
}
```

### src/infrastructure/npc-creature/supabase-npc-creature.repository.ts:335

```ts
export const supabaseNpcCreatureRepository = new SupabaseNpcCreatureRepository();
```


## Remaining backend helper operations

All backend operations are included in the public declarations above.

## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/character/avatar/face-anchor-contract.ts` | `e302f0b6ab5827217a8bd30aa0a77fa8b0147c429b32a48b15c312f4cd778b5a` |
| `src/domains/character/avatar/morph-contract.ts` | `7540a9aaaba59981033500ac67329060e39c2f259c35460c964c39c1e461d96f` |
| `src/domains/character/domain/character.entity.ts` | `56e76a478531eb46ae523b1b1c3d8fd4d076af742baf2ef1edea5dac70768120` |
| `src/domains/npc-creature/contracts.ts` | `0939d59a22bc21b04d1de19429f8d3541f4f3df22a2fb14b7b7db8bb8ff9738f` |
| `src/domains/npc-creature/controller-assignment.ts` | `0c572faa9709ff00fbb5c1a183271b4c4f53a664ad0f2db2d87bd69c7694c37a` |
| `src/domains/npc-creature/core-catalog.ts` | `ab597ca223259ec07cdb0c954dc647d296d255bd744e0033737028b0546df6ba` |
| `src/domains/npc-creature/definition.ts` | `c5cfbd3e9b937142fd04b2d9d8ef1470382062ae1565d4cf3622eb6053c05a45` |
| `src/domains/npc-creature/derived.ts` | `13a0113281e9def92d1ac9658b181a890bfcd05dd3cbfe3049ef670e9b0c500c` |
| `src/domains/npc-creature/icon-assets.ts` | `d786c058900713946c0578b46c1f444418b2a19db04ce77b4b1bec87eea82035` |
| `src/domains/npc-creature/index.ts` | `f2a5a026df813bb828e68e0c672eebd95e3a9627f1b1cf25d6cb7c6a2db5cc9e` |
| `src/domains/npc-creature/instance.ts` | `4a4371ccf0efab85cd867355c387331ab815b58c2ef40c57179300d2639552c0` |
| `src/domains/npc-creature/library-query.ts` | `f33a123fd69281685c654e4fcd322d697cbad5544ada723c021ba2335b62f273` |
| `src/domains/npc-creature/pack.ts` | `401d1450f6060c6984ec3a937ad4a5127602ce34f0e169fe008b860392892e25` |
| `src/domains/npc-creature/packs/animals.ts` | `728cbea35f072058db6974ce5dd3c80686012a9bd00e4de85c80e0d9f969b021` |
| `src/domains/npc-creature/packs/build-builtin.ts` | `ce343c3558c918920fd328fa1891d5085d00cf4c7fd3360709f749a3fe0c20c7` |
| `src/domains/npc-creature/packs/context-packs.ts` | `a95d23684c4c3687a02b4c98c3437155ef3a1eb01b02e39e8db50d8cf4b36ec6` |
| `src/domains/npc-creature/packs/fantasy-basics.ts` | `81ca439a786d0fcb2fa3bf28d801f68f068d7ff201831c157c2cec876f78561b` |
| `src/domains/npc-creature/packs/index.ts` | `7bb8adddd9ea09409db03785cfcce0656338fe948a86a2f5b4aa14f6a986aeb7` |
| `src/domains/npc-creature/parse.ts` | `29986eb9251451da88c70e6f127f8dd21007a1d61f232da6100872a9be7b2e02` |
| `src/domains/npc-creature/payload.ts` | `935c5f24af7e47173315ba80661767fe0b7acb2f890227c2062b333f3394f1fa` |
| `src/domains/npc-creature/policy.ts` | `c864eecb3fff0e0c7fc5c64ae3090ab7b45e0dfb134280583dd732b66d1ecb05` |
| `src/domains/npc-creature/promotion.ts` | `bf49060eeb671c84102d35471568f2497bb60865310851e247bbcbc230cc7f92` |
| `src/domains/npc-creature/taxonomy.ts` | `3dbc3aaed85858710186551bb41eeaac7475bcb573e1b980a9e64e63852936bc` |
| `src/domains/npc-creature/validate.ts` | `5cedac40b675972a2c617212d86603cdfec39692f17afe6a96d19d2270d33fd0` |
| `src/domains/npc-creature/world-catalog.ts` | `6f87522e1d00aa2ed1b9e1e0310d47f8bb25506fc33d6bee9048f98705ddba2f` |
| `src/domains/rules/sagatree/attribute-progression/index.ts` | `1f7ef073a45fd01150c4a90c7b711953f9e0c9efe4ba235bb2cf93e5b6523ae3` |
| `src/domains/rules/sagatree/character-creation/index.ts` | `9e032fe110c4665ec6744e0750d07c57a5d6b083fb292b2bd6441e21db7cdb07` |
| `src/domains/rules/sagatree/npc-creature-power/benchmarks.ts` | `d102fe585bfec2eb44e556fc133d67086fb9915da4ba65497c83869fa82eb54d` |
| `src/domains/rules/sagatree/npc-creature-power/combat-roles.ts` | `28a1ddccaf3a34292e919a768bac20a226e9a4fbb423f17ab7c3cf70be27f512` |
| `src/domains/rules/sagatree/npc-creature-power/compute.ts` | `8085e6151a610bc1465cf129ea22845850042d6cff3c93aa052055039ead49f8` |
| `src/domains/rules/sagatree/npc-creature-power/damage-steps.ts` | `8bc739457eeeb77336b6124153d3f3a3642877c50c23fa7dab1f82b075c26a58` |
| `src/domains/rules/sagatree/npc-creature-power/index.ts` | `ff26d6741c491b687d01d8eaa87722a89df1fe25251794625d98e35a0f3fb5c6` |
| `src/domains/rules/sagatree/npc-creature-power/machtgrad.ts` | `19d4daafb9580b890ed2337feccffed19122a01dfb23c2eeb2dadd2523778f7a` |
| `src/domains/rules/sagatree/npc-creature-power/profiles.ts` | `aa3d450842ddce7548f6e8e826225cdbdeae6de7660e09798fe43663dc9ce1fa` |
| `src/domains/rules/sagatree/npc-creature-power/types.ts` | `de25ba46549bab20e0e55a513fb0745e722449d8f1b61bb51887d986653c4eab` |
| `src/infrastructure/npc-creature/host-npc-creature-adapter.ts` | `c707763455a2e935f607ce3a43e750f1a3b2de42e90e1a5c96be8fb15f22a2bb` |
| `src/infrastructure/npc-creature/host-npc-creature-ports.contract.ts` | `781e93fe661518ad05e0b2708813fe89aceda69f212cf59a8de157fc9c408a69` |
| `src/infrastructure/npc-creature/npc-creature-controller.persistence.ts` | `9832d02675fdfc5a7d9520ff68c60a3636e25de2ed497e523218e7c8985fe530` |
| `src/infrastructure/npc-creature/npc-creature-instance.persistence.ts` | `00aaa3e07b5cdc72305da5381e0c8e0754b2a159df623a4a6355748cb269776f` |
| `src/infrastructure/npc-creature/npc-creature-service.ts` | `6c282de89059d13638306111956d6019d2d86662d1c1688016020fb6ae787015` |
| `src/infrastructure/npc-creature/npc-creature.persistence.ts` | `2823d44f52887026e5e5bac5120bb7d2def738e29e1354686d06f670e0d33420` |
| `src/infrastructure/npc-creature/supabase-npc-creature.repository.ts` | `5a4ffd9548db32d83f852e36c5ec77b878a758d16e080a45a014c9f15256c041` |
| `src/lib/authenticatedUser.ts` | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `src/lib/localAdmin.ts` | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

