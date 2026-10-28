# Infrastructure contract: world

**Status: SPEC; current branch source verified.** Implementation issue: **#812**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-world.json](source-contracts/infra-world.json) (SHA-256 `62f1b661aed0c9caef575ab90f7f66e6abeb63341183e1e736a2d2102e90793a`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

World profiles and17 world/atlas/place RPCs, item/NPC definition reads, world-atlas image storage and world-map-pins uploads. Class-field this.tableName resolves to world_profiles.

Owner/editor read differs from saga-player reveal projection; preserve p_saga_public_id,p_player_view and no private catalog/map/layer/title exposure.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (17): `archive_world_node_subtree`, `create_world_node_with_maps`, `delete_world_node`, `duplicate_world_node`, `ensure_world_atlas_root`, `get_world_atlas_map`, `get_world_map`, `list_world_atlas_maps`, `list_world_place_map_links`, `list_world_places`, `preview_world_node_consequences`, `rename_world_node`, `reparent_world_node`, `save_world_map`, `upsert_world_atlas_map`, `upsert_world_place`, `upsert_world_place_map_link`.

Tables (3): `inventory_item_definitions`, `npc_creature_definitions`, `world_profiles`.

Storage buckets (2): `world-atlas`, `world-map-pins`.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 2.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| rpc | `archive_world_node_subtree` | #813 | RPC-WORLD-DESTRUCTIVE |
| rpc | `create_world_node_with_maps` | #813 | RPC-WORLD-CREATE |
| rpc | `delete_world_node` | #813 | RPC-WORLD-DESTRUCTIVE |
| rpc | `duplicate_world_node` | #813 | RPC-WORLD-RESTRUCTURE |
| rpc | `ensure_world_atlas_root` | #813 | RPC-ATLAS-MAPS |
| rpc | `get_world_atlas_map` | #813 | RPC-ATLAS-MAPS |
| rpc | `get_world_map` | #813 | RPC-WORLD-MAP |
| rpc | `list_world_atlas_maps` | #813 | RPC-ATLAS-MAPS |
| rpc | `list_world_place_map_links` | #813 | RPC-WORLD-PLACES |
| rpc | `list_world_places` | #813 | RPC-WORLD-PLACES |
| rpc | `preview_world_node_consequences` | #813 | RPC-WORLD-DESTRUCTIVE |
| rpc | `rename_world_node` | #813 | RPC-WORLD-CREATE |
| rpc | `reparent_world_node` | #813 | RPC-WORLD-RESTRUCTURE |
| rpc | `save_world_map` | #813 | RPC-WORLD-MAP |
| rpc | `upsert_world_atlas_map` | #813 | RPC-ATLAS-MAPS |
| rpc | `upsert_world_place` | #813 | RPC-WORLD-PLACES |
| rpc | `upsert_world_place_map_link` | #813 | RPC-WORLD-PLACES |
| table | `inventory_item_definitions` | #791 | Policy #792 |
| table | `npc_creature_definitions` | #791 | Policy #792 |
| table | `world_profiles` | #791 | Policy #792 |
| storage | `world-atlas` | #841 |  |
| storage | `world-map-pins` | #841 |  |
| auth | `authenticated account/session transport` | #793 |  |
| infra | `media` | #805 |  |

## Acceptance and negative tests (required, not executed)

- Create world/node/maps; edit/rename/reparent/duplicate/archive/delete with consequence preview and reload into DB-backed tree.
- Player sees only explicitly revealed map/place projection for the selected saga; owner without GM privileges follows actual per-RPC policy.
- Map pin upload uses storage bucket (not a table); every17 RPC dependency and profile CRUD transport ready before facade cutover.
- Contract fixture for archive_world_node_subtree: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for create_world_node_with_maps: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for delete_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for duplicate_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for ensure_world_atlas_root: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for get_world_atlas_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for get_world_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for list_world_atlas_maps: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for list_world_place_map_links: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for list_world_places: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for preview_world_node_consequences: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for rename_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for reparent_world_node: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for save_world_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for upsert_world_atlas_map: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for upsert_world_place: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.
- Contract fixture for upsert_world_place_map_link: exact caller argument/default and decoded result/error union from source evidence; effective SQL policy/side effects from RPC contract; unauthorized and rollback/reload cases remain required.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### rpc: list_world_atlas_maps

`src/infrastructure/world/world-atlas-service.ts:46` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('list_world_atlas_maps', {
      p_world_profile_id: id,
      p_player_view: options.playerView === true,
      p_saga_public_id: options.sagaPublicId?.trim() || null,
    })
```

Enclosing operation: `src/infrastructure/world/world-atlas-service.ts:39`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: ensure_world_atlas_root

`src/infrastructure/world/world-atlas-service.ts:59` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('ensure_world_atlas_root', {
      p_world_profile_id: id,
    })
```

Enclosing operation: `src/infrastructure/world/world-atlas-service.ts:55`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: get_world_atlas_map

`src/infrastructure/world/world-atlas-service.ts:74` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('get_world_atlas_map', {
      p_map_id: id,
      p_player_view: playerView,
      p_saga_public_id: sagaPublicId?.trim() || null,
    })
```

Enclosing operation: `src/infrastructure/world/world-atlas-service.ts:66`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: upsert_world_atlas_map

`src/infrastructure/world/world-atlas-service.ts:85` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('upsert_world_atlas_map', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_map_id: input.mapId ?? null,
      p_parent_map_id: input.parentMapId ?? null,
      p_kind: input.kind,
      p_title: input.title,
      p_sort_order: input.sortOrder ?? 0,
      p_bounds: input.bounds,
      p_layers: input.layers,
      p_basemap_storage_path: input.basemapStoragePath ?? null,
      p_azgaar_map_storage_path: input.azgaarMapStoragePath ?? null,
      p_generator_meta: input.generatorMeta ?? {},
      p_expected_revision: input.expectedRevision ?? null,
    })
```

Enclosing operation: `src/infrastructure/world/world-atlas-service.ts:83`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/world/world-atlas-service.ts:113` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/world/world-atlas-service.ts:111`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: world-atlas

`src/infrastructure/world/world-atlas-service.ts:119` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage.from(ATLAS_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
```

Enclosing operation: `src/infrastructure/world/world-atlas-service.ts:111`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: world-atlas

`src/infrastructure/world/world-atlas-service.ts:131` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage
      .from(ATLAS_BUCKET)
      .createSignedUrl(path, expiresSec)
```

Enclosing operation: `src/infrastructure/world/world-atlas-service.ts:127`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: get_world_map

`src/infrastructure/world/world-map-service.ts:75` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('get_world_map', {
      p_world_profile_id: id,
      p_player_view: playerView,
    })
```

Enclosing operation: `src/infrastructure/world/world-map-service.ts:72`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: save_world_map

`src/infrastructure/world/world-map-service.ts:92` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('save_world_map', {
      p_world_profile_id: id,
      p_expected_revision: expectedRevision,
      p_map_data: mapData,
    })
```

Enclosing operation: `src/infrastructure/world/world-map-service.ts:85`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth: session identity

`src/infrastructure/world/world-map-service.ts:115` — dynamic-expression.

Exact call/query chain:
```ts
supabase.auth.getUser()
```

Enclosing operation: `src/infrastructure/world/world-map-service.ts:107`; complete request/default/result/error logic is in the declarations below and the snapshot.
### storage: world-map-pins

`src/infrastructure/world/world-map-service.ts:132` — literal-or-constant.

Exact call/query chain:
```ts
supabase.storage.from('world-map-pins').upload(path, prepared, {
      upsert: false,
      contentType: prepared.type || 'image/jpeg',
    })
```

Enclosing operation: `src/infrastructure/world/world-map-service.ts:107`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: list_world_places

`src/infrastructure/world/world-place-service.ts:41` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('list_world_places', {
      p_world_profile_id: id,
      p_player_view: options.playerView === true,
      p_saga_public_id: options.sagaPublicId?.trim() || null,
    })
```

Enclosing operation: `src/infrastructure/world/world-place-service.ts:34`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: list_world_place_map_links

`src/infrastructure/world/world-place-service.ts:57` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('list_world_place_map_links', {
      p_world_profile_id: id,
      p_player_view: options.playerView === true,
      p_saga_public_id: options.sagaPublicId?.trim() || null,
    })
```

Enclosing operation: `src/infrastructure/world/world-place-service.ts:50`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: upsert_world_place

`src/infrastructure/world/world-place-service.ts:68` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('upsert_world_place', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId ?? null,
      p_parent_place_id: input.parentPlaceId ?? null,
      p_kind: input.kind,
      p_name: input.name,
      p_description: input.description ?? null,
      p_status: input.status ?? 'draft',
      p_seed_key: input.seedKey ?? null,
      p_sort_order: input.sortOrder ?? 0,
    })
```

Enclosing operation: `src/infrastructure/world/world-place-service.ts:66`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: create_world_node_with_maps

`src/infrastructure/world/world-place-service.ts:99` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('create_world_node_with_maps', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_kind: input.kind,
      p_name: input.name,
      p_idempotency_key: input.idempotencyKey.trim(),
      p_subtype: input.subtype ?? null,
      p_parent_place_id: input.parentPlaceId ?? null,
      p_description: input.description ?? null,
    })
```

Enclosing operation: `src/infrastructure/world/world-place-service.ts:89`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: preview_world_node_consequences

`src/infrastructure/world/world-place-service.ts:121` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('preview_world_node_consequences', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
    })
```

Enclosing operation: `src/infrastructure/world/world-place-service.ts:116`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: rename_world_node

`src/infrastructure/world/world-place-service.ts:136` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('rename_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_name: input.name,
    })
```

Enclosing operation: `src/infrastructure/world/world-place-service.ts:130`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: reparent_world_node

`src/infrastructure/world/world-place-service.ts:154` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('reparent_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_new_parent_place_id: input.newParentPlaceId,
      p_confirm_relocate: input.confirmRelocate,
    })
```

Enclosing operation: `src/infrastructure/world/world-place-service.ts:147`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: duplicate_world_node

`src/infrastructure/world/world-place-service.ts:171` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('duplicate_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_deep: input.deep === true,
    })
```

Enclosing operation: `src/infrastructure/world/world-place-service.ts:165`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: archive_world_node_subtree

`src/infrastructure/world/world-place-service.ts:187` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('archive_world_node_subtree', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_confirm: input.confirm,
    })
```

Enclosing operation: `src/infrastructure/world/world-place-service.ts:181`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: delete_world_node

`src/infrastructure/world/world-place-service.ts:203` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('delete_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_confirm: input.confirm,
    })
```

Enclosing operation: `src/infrastructure/world/world-place-service.ts:197`; complete request/default/result/error logic is in the declarations below and the snapshot.
### rpc: upsert_world_place_map_link

`src/infrastructure/world/world-place-service.ts:218` — literal-or-constant.

Exact call/query chain:
```ts
supabase.rpc('upsert_world_place_map_link', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_map_id: input.mapId.trim(),
      p_usage: input.usage,
      p_feature_id: input.featureId ?? null,
      p_anchor: input.anchor ?? {},
    })
```

Enclosing operation: `src/infrastructure/world/world-place-service.ts:213`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: world_profiles

`src/infrastructure/world/world-profile-service.ts:55` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .select(WORLD_SELECT)
      .eq('owner_user_id', jwtUserId)
      .order('created_at', { ascending: false })
```

Enclosing operation: `src/infrastructure/world/world-profile-service.ts:52`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: world_profiles

`src/infrastructure/world/world-profile-service.ts:68` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .select(WORLD_SELECT)
      .eq('id', id)
      .eq('owner_user_id', jwtUserId)
      .single()
```

Enclosing operation: `src/infrastructure/world/world-profile-service.ts:65`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: world_profiles

`src/infrastructure/world/world-profile-service.ts:84` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .select(WORLD_SELECT)
      .eq('public_id', publicId)
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/world/world-profile-service.ts:80`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: world_profiles

`src/infrastructure/world/world-profile-service.ts:104` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .insert(insertPayload)
      .select(WORLD_SELECT)
      .single()
```

Enclosing operation: `src/infrastructure/world/world-profile-service.ts:94`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: world_profiles

`src/infrastructure/world/world-profile-service.ts:138` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .update(updatePayload)
      .eq('id', id)
      .eq('owner_user_id', jwtUserId)
      .select(WORLD_SELECT)
      .single()
```

Enclosing operation: `src/infrastructure/world/world-profile-service.ts:124`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: inventory_item_definitions

`src/infrastructure/world/world-profile-service.ts:157` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('inventory_item_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('world_profile_id', id)
```

Enclosing operation: `src/infrastructure/world/world-profile-service.ts:150`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: npc_creature_definitions

`src/infrastructure/world/world-profile-service.ts:170` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('npc_creature_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('world_profile_id', id)
```

Enclosing operation: `src/infrastructure/world/world-profile-service.ts:150`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: world_profiles

`src/infrastructure/world/world-profile-service.ts:183` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .eq('owner_user_id', jwtUserId)
```

Enclosing operation: `src/infrastructure/world/world-profile-service.ts:150`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/world/host-world-adapter.ts:13

```ts
export type HostWorldAdapter = HostWorldPorts & {
  readonly transport: 'host';
  readonly rpcNames: typeof HOST_WORLD_RPC_NAMES;
};
```

### src/infrastructure/world/host-world-adapter.ts:22

```ts
export function createHostWorldAdapter(ports: HostWorldPorts): HostWorldAdapter {
  return {
    transport: 'host',
    rpcNames: HOST_WORLD_RPC_NAMES,
    listOwnedWorlds: (actorId) => ports.listOwnedWorlds(actorId),
    getWorld: (actorId, worldId) => ports.getWorld(actorId, worldId),
    createOwnedWorld: (actorId, title) => ports.createOwnedWorld(actorId, title),
    updateOwnedWorld: (actorId, worldId, title) => ports.updateOwnedWorld(actorId, worldId, title),
    deleteOwnedWorld: (actorId, worldId) => ports.deleteOwnedWorld(actorId, worldId),
    getWorldMap: (actorId, worldProfileId, playerView) =>
      ports.getWorldMap(actorId, worldProfileId, playerView),
    saveWorldMap: (actorId, worldProfileId, expectedRevision, mapData) =>
      ports.saveWorldMap(actorId, worldProfileId, expectedRevision, mapData),
    ensureWorldAtlasRoot: (actorId, worldProfileId) =>
      ports.ensureWorldAtlasRoot(actorId, worldProfileId),
    listWorldAtlasMaps: (actorId, worldProfileId, playerView, sagaPublicId) =>
      ports.listWorldAtlasMaps(actorId, worldProfileId, playerView, sagaPublicId),
    getWorldAtlasMap: (actorId, mapId, playerView, sagaPublicId) =>
      ports.getWorldAtlasMap(actorId, mapId, playerView, sagaPublicId),
    upsertWorldAtlasMap: (actorId, input) => ports.upsertWorldAtlasMap(actorId, input),
    listWorldPlaces: (actorId, worldProfileId, playerView, sagaPublicId) =>
      ports.listWorldPlaces(actorId, worldProfileId, playerView, sagaPublicId),
    listWorldPlaceMapLinks: (actorId, worldProfileId, playerView, sagaPublicId) =>
      ports.listWorldPlaceMapLinks(actorId, worldProfileId, playerView, sagaPublicId),
    upsertWorldPlace: (actorId, input) => ports.upsertWorldPlace(actorId, input),
    upsertWorldPlaceMapLink: (actorId, input) => ports.upsertWorldPlaceMapLink(actorId, input),
    createWorldNodeWithMaps: (actorId, input) => ports.createWorldNodeWithMaps(actorId, input),
    renameWorldNode: (actorId, input) => ports.renameWorldNode(actorId, input),
    reparentWorldNode: (actorId, input) => ports.reparentWorldNode(actorId, input),
    duplicateWorldNode: (actorId, input) => ports.duplicateWorldNode(actorId, input),
    previewWorldNodeConsequences: (actorId, input) =>
      ports.previewWorldNodeConsequences(actorId, input),
    archiveWorldNodeSubtree: (actorId, input) => ports.archiveWorldNodeSubtree(actorId, input),
    deleteWorldNode: (actorId, input) => ports.deleteWorldNode(actorId, input),
    publishWorldAsset: (actorId, input) => ports.publishWorldAsset(actorId, input),
  };
}
```

### src/infrastructure/world/host-world-ports.contract.ts:16

```ts
export type HostWorldMapDto = {
  readonly worldProfileId: string;
  readonly revision: number;
  readonly mapData: Readonly<Record<string, unknown>>;
  readonly updatedAt: string | null;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:23

```ts
export type HostWorldAtlasMapSummary = {
  readonly id: string;
  readonly worldProfileId: string;
  readonly parentMapId: string | null;
  readonly kind: string;
  readonly title: string;
  readonly sortOrder: number;
  readonly revision: number;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:33

```ts
export type HostWorldAtlasMapVm = HostWorldAtlasMapSummary & {
  readonly bounds: Readonly<Record<string, unknown>>;
  readonly layers: Readonly<Record<string, unknown>>;
  readonly basemapStoragePath: string | null;
  readonly azgaarMapStoragePath: string | null;
  readonly generatorMeta: Readonly<Record<string, unknown>>;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:42

```ts
export type HostWorldPlaceVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly worldProfileId: string;
  readonly name: string;
  readonly kind: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:49

```ts
export type HostWorldPlaceMapLinkVm = Readonly<Record<string, unknown>> & {
  readonly id: string;
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:57

```ts
export type HostUpsertWorldAtlasMapInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:61

```ts
export type HostCreateWorldNodeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly kind: string;
  readonly name: string;
  readonly idempotencyKey: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:68

```ts
export type HostCreateWorldNodeResult = Readonly<Record<string, unknown>> & {
  readonly targetPlaceId: string;
  readonly worldProfileId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:73

```ts
export type HostRenameWorldNodeInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly name: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:79

```ts
export type HostReparentWorldNodeInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly newParentPlaceId: string | null;
  readonly confirmRelocate: boolean;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:86

```ts
export type HostDuplicateWorldNodeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:91

```ts
export type HostPreviewWorldNodeConsequencesInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:96

```ts
export type HostArchiveWorldNodeSubtreeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:101

```ts
export type HostDeleteWorldNodeInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:106

```ts
export type HostUpsertWorldPlaceInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly kind: string;
  readonly name: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:112

```ts
export type HostUpsertWorldPlaceMapLinkInput = Readonly<Record<string, unknown>> & {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:119

```ts
export type HostWorldAssetPublishInput = {
  readonly worldProfileId: string;
  readonly kind: 'map-pin' | 'world-atlas';
  readonly bytes: Uint8Array;
  readonly contentType: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:126

```ts
export type HostWorldAssetPublishResult = {
  readonly assetId: string;
  readonly contentType: string;
  /** Opaque storage reference (successor of Supabase bucket path). */
  readonly storageRef: string;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:137

```ts
export type HostWorldPorts = HostWorldReadPort & {
  readonly createOwnedWorld: (
    actorId: string,
    title: string,
  ) => Promise<HostWorldReadResult<{ readonly id: string; readonly title: string; readonly createdAt: string }>>;
  readonly updateOwnedWorld: (
    actorId: string,
    worldId: string,
    title: string,
  ) => Promise<HostWorldReadResult<HostWorldReadDto>>;
  readonly deleteOwnedWorld: (
    actorId: string,
    worldId: string,
  ) => Promise<HostWorldReadResult<{ readonly deleted: true }>>;

  readonly getWorldMap: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
  ) => Promise<HostWorldReadResult<HostWorldMapDto>>;
  readonly saveWorldMap: (
    actorId: string,
    worldProfileId: string,
    expectedRevision: number | null,
    mapData: Readonly<Record<string, unknown>>,
  ) => Promise<HostWorldReadResult<HostWorldMapDto>>;

  readonly ensureWorldAtlasRoot: (
    actorId: string,
    worldProfileId: string,
  ) => Promise<HostWorldReadResult<readonly HostWorldAtlasMapSummary[]>>;
  readonly listWorldAtlasMaps: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<readonly HostWorldAtlasMapSummary[]>>;
  readonly getWorldAtlasMap: (
    actorId: string,
    mapId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<HostWorldAtlasMapVm>>;
  readonly upsertWorldAtlasMap: (
    actorId: string,
    input: HostUpsertWorldAtlasMapInput,
  ) => Promise<HostWorldReadResult<HostWorldAtlasMapVm>>;

  readonly listWorldPlaces: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<readonly HostWorldPlaceVm[]>>;
  readonly listWorldPlaceMapLinks: (
    actorId: string,
    worldProfileId: string,
    playerView?: boolean,
    sagaPublicId?: string | null,
  ) => Promise<HostWorldReadResult<readonly HostWorldPlaceMapLinkVm[]>>;
  readonly upsertWorldPlace: (
    actorId: string,
    input: HostUpsertWorldPlaceInput,
  ) => Promise<HostWorldReadResult<HostWorldPlaceVm>>;
  readonly upsertWorldPlaceMapLink: (
    actorId: string,
    input: HostUpsertWorldPlaceMapLinkInput,
  ) => Promise<HostWorldReadResult<HostWorldPlaceMapLinkVm>>;

  readonly createWorldNodeWithMaps: (
    actorId: string,
    input: HostCreateWorldNodeInput,
  ) => Promise<HostWorldReadResult<HostCreateWorldNodeResult>>;
  readonly renameWorldNode: (
    actorId: string,
    input: HostRenameWorldNodeInput,
  ) => Promise<HostWorldReadResult<HostWorldPlaceVm>>;
  readonly reparentWorldNode: (
    actorId: string,
    input: HostReparentWorldNodeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly duplicateWorldNode: (
    actorId: string,
    input: HostDuplicateWorldNodeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly previewWorldNodeConsequences: (
    actorId: string,
    input: HostPreviewWorldNodeConsequencesInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly archiveWorldNodeSubtree: (
    actorId: string,
    input: HostArchiveWorldNodeSubtreeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;
  readonly deleteWorldNode: (
    actorId: string,
    input: HostDeleteWorldNodeInput,
  ) => Promise<HostWorldReadResult<Readonly<Record<string, unknown>>>>;

  /**
   * Storage successor for `world-map-pins` / `world-atlas` buckets.
   * Must not write pin/atlas bytes into world SQL tables.
   * Implementations MUST authorize `world.edit` for `input.worldProfileId`
   * before publishing bytes (no cross-world asset attach by actor id alone).
   */
  readonly publishWorldAsset: (
    actorId: string,
    input: HostWorldAssetPublishInput,
  ) => Promise<HostWorldReadResult<HostWorldAssetPublishResult>>;
};
```

### src/infrastructure/world/host-world-ports.contract.ts:248

```ts
export const HOST_WORLD_RPC_NAMES = [
  'archive_world_node_subtree',
  'create_world_node_with_maps',
  'delete_world_node',
  'duplicate_world_node',
  'ensure_world_atlas_root',
  'get_world_atlas_map',
  'get_world_map',
  'list_world_atlas_maps',
  'list_world_place_map_links',
  'list_world_places',
  'preview_world_node_consequences',
  'rename_world_node',
  'reparent_world_node',
  'save_world_map',
  'upsert_world_atlas_map',
  'upsert_world_place',
  'upsert_world_place_map_link',
] as const;
```

### src/infrastructure/world/host-world-ports.contract.ts:268

```ts
export type HostWorldRpcName = (typeof HOST_WORLD_RPC_NAMES)[number];
```

### src/infrastructure/world/host-world-read.contract.ts:12

```ts
export type HostWorldReadDto = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
};
```

### src/infrastructure/world/host-world-read.contract.ts:18

```ts
export type HostWorldReadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };
```

### src/infrastructure/world/host-world-read.contract.ts:26

```ts
export type HostWorldReadPort = {
  readonly listOwnedWorlds: (actorId: string) => Promise<HostWorldReadResult<readonly HostWorldReadDto[]>>;
  readonly getWorld: (actorId: string, worldId: string) => Promise<HostWorldReadResult<HostWorldReadDto>>;
};
```

### src/infrastructure/world/world-atlas-service.ts:23

```ts
export type UpsertWorldAtlasMapInput = {
  readonly worldProfileId: string;
  readonly mapId?: string | null;
  readonly parentMapId?: string | null;
  readonly kind: WorldAtlasMapKind;
  readonly title: string;
  readonly sortOrder?: number;
  readonly bounds: WorldAtlasBounds;
  readonly layers: WorldAtlasFeatureCollection;
  readonly basemapStoragePath?: string | null;
  readonly azgaarMapStoragePath?: string | null;
  readonly generatorMeta?: Readonly<Record<string, unknown>>;
  readonly expectedRevision?: number | null;
};
```

### src/infrastructure/world/world-atlas-service.ts:141

```ts
export const worldAtlasService = new WorldAtlasService();
```

### src/infrastructure/world/world-map-service.ts:15

```ts
export type UploadPinImageOptions = {
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/world/world-map-service.ts:21

```ts
export async function prepareWorldMapPinFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  if (file.size > MAP_PIN_MAX_BYTES) {
    throw new Error('Bild ist zu groß. Maximum 5 MB');
  }
  const { optimizeMedia } = await import('../media/optimizer');
  let optimizedBytes: Uint8Array | undefined;
  const result = await optimizeMedia({
    kind: 'image',
    profileId: 'map-pin',
    mimeType: file.type || 'application/octet-stream',
    byteSize: file.size,
    bytes: file,
    signal,
    onOptimizedBytes: (bytes) => {
      optimizedBytes = bytes;
    },
  });

  if (result.status === 'unchanged') {
    if (!MAP_PIN_ALLOWED_MIME.has(file.type)) {
      throw new Error('Nur PNG, JPEG oder WebP erlaubt.');
    }
    return file;
  }

  if (result.status === 'optimized') {
    if (!optimizedBytes || optimizedBytes.byteLength === 0) {
      throw new Error('Pin-Bild-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'pin';
    const ext = result.outputMimeType === 'image/webp' ? 'webp' : 'bin';
    return new File([copy], `${base}.${ext}`, { type: result.outputMimeType });
  }

  if (result.status === 'aborted') {
    throw new Error(result.message || 'Pin-Bild-Optimierung abgebrochen.');
  }

  const message =
    'message' in result && typeof result.message === 'string'
      ? result.message
      : 'Pin-Bild-Optimierung fehlgeschlagen.';
  throw new Error(message);
}
```

### src/infrastructure/world/world-map-service.ts:141

```ts
export const worldMapService = new WorldMapService();
```

### src/infrastructure/world/world-place-service.ts:19

```ts
export type ListWorldPlacesOptions = {
  readonly playerView?: boolean;
  readonly sagaPublicId?: string | null;
};
```

### src/infrastructure/world/world-place-service.ts:24

```ts
export type LinkWorldPlaceMapInput = {
  readonly worldProfileId: string;
  readonly placeId: string;
  readonly mapId: string;
  readonly usage: WorldPlaceMapUsage;
  readonly featureId?: string | null;
  readonly anchor?: Readonly<Record<string, unknown>>;
};
```

### src/infrastructure/world/world-place-service.ts:233

```ts
export const worldPlaceService = new WorldPlaceService();
```

### src/infrastructure/world/world-profile-service.ts:193

```ts
export const worldProfileService = new WorldProfileService();
```


## Remaining backend helper operations

### src/infrastructure/world/world-atlas-service.ts:39

```ts
async listMaps(
    worldProfileId: string,
    options: { readonly playerView?: boolean; readonly sagaPublicId?: string | null } = {},
  ): Promise<WorldAtlasMapSummary[]> {
    await assertSupabaseJwtSession();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const { data, error } = await supabase.rpc('list_world_atlas_maps', {
      p_world_profile_id: id,
      p_player_view: options.playerView === true,
      p_saga_public_id: options.sagaPublicId?.trim() || null,
    });
    if (error) throw new Error(`Atlas-Liste fehlgeschlagen: ${error.message}`);
    return parseWorldAtlasMapList(data);
  }
```

### src/infrastructure/world/world-atlas-service.ts:55

```ts
async ensureRoot(worldProfileId: string): Promise<WorldAtlasMapSummary[]> {
    await assertSupabaseJwtSession();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const { data, error } = await supabase.rpc('ensure_world_atlas_root', {
      p_world_profile_id: id,
    });
    if (error) throw new Error(`Atlas-Root fehlgeschlagen: ${error.message}`);
    return parseWorldAtlasMapList(data);
  }
```

### src/infrastructure/world/world-atlas-service.ts:66

```ts
async getMap(
    mapId: string,
    playerView = false,
    sagaPublicId?: string | null,
  ): Promise<WorldAtlasMapVm> {
    await assertSupabaseJwtSession();
    const id = mapId.trim();
    if (!id) throw new Error('Karten-ID fehlt');
    const { data, error } = await supabase.rpc('get_world_atlas_map', {
      p_map_id: id,
      p_player_view: playerView,
      p_saga_public_id: sagaPublicId?.trim() || null,
    });
    if (error) throw new Error(`Atlas-Karte konnte nicht geladen werden: ${error.message}`);
    return parseWorldAtlasMapVm(data);
  }
```

### src/infrastructure/world/world-atlas-service.ts:83

```ts
async upsertMap(input: UpsertWorldAtlasMapInput): Promise<WorldAtlasMapVm> {
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('upsert_world_atlas_map', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_map_id: input.mapId ?? null,
      p_parent_map_id: input.parentMapId ?? null,
      p_kind: input.kind,
      p_title: input.title,
      p_sort_order: input.sortOrder ?? 0,
      p_bounds: input.bounds,
      p_layers: input.layers,
      p_basemap_storage_path: input.basemapStoragePath ?? null,
      p_azgaar_map_storage_path: input.azgaarMapStoragePath ?? null,
      p_generator_meta: input.generatorMeta ?? {},
      p_expected_revision: input.expectedRevision ?? null,
    });
    if (error) {
      if (error.code === '40001' || /revision conflict/i.test(error.message)) {
        throw new Error(
          'Die Karte wurde inzwischen geändert. Bitte neu laden und erneut speichern.',
        );
      }
      throw new Error(`Atlas speichern fehlgeschlagen: ${error.message}`);
    }
    return parseWorldAtlasMapVm(data);
  }
```

### src/infrastructure/world/world-atlas-service.ts:111

```ts
async uploadAzgaarMapFile(worldProfileId: string, file: File): Promise<string> {
    await assertSupabaseJwtSession();
    const userId = await getAuthenticatedUserId();
    if (file.size > AZGAAR_MAX_BYTES) {
      throw new Error('Azgaar-Datei ist zu groß (max. 40 MB).');
    }
    const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'world.map';
    const path = `${userId}/${worldProfileId.trim()}/azgaar/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(ATLAS_BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });
    if (error) throw new Error(`Azgaar-Upload fehlgeschlagen: ${error.message}`);
    return path;
  }
```

### src/infrastructure/world/world-atlas-service.ts:127

```ts
async createSignedUrl(storagePath: string, expiresSec = 3600): Promise<string> {
    await assertSupabaseJwtSession();
    const path = storagePath.trim();
    if (!path) throw new Error('Storage-Pfad fehlt');
    const { data, error } = await supabase.storage
      .from(ATLAS_BUCKET)
      .createSignedUrl(path, expiresSec);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message || 'Download-URL fehlgeschlagen.');
    }
    return data.signedUrl;
  }
```

### src/infrastructure/world/world-map-service.ts:72

```ts
async getMap(worldProfileId: string, playerView = false): Promise<WorldMapVm> {
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const { data, error } = await supabase.rpc('get_world_map', {
      p_world_profile_id: id,
      p_player_view: playerView,
    });
    if (error) throw new Error(`Karte konnte nicht geladen werden: ${error.message}`);
    const vm = parseWorldMapVm(data);
    if (!vm) throw new Error('Ungültige Kartenantwort');
    return vm;
  }
```

### src/infrastructure/world/world-map-service.ts:85

```ts
async saveMap(
    worldProfileId: string,
    expectedRevision: number,
    mapData: WorldMapData,
  ): Promise<WorldMapVm> {
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const { data, error } = await supabase.rpc('save_world_map', {
      p_world_profile_id: id,
      p_expected_revision: expectedRevision,
      p_map_data: mapData,
    });
    if (error) throw new Error(`Karte konnte nicht gespeichert werden: ${error.message}`);
    const vm = parseWorldMapVm(data);
    if (!vm) throw new Error('Ungültige Speicherantwort');
    return vm;
  }
```

### src/infrastructure/world/world-map-service.ts:107

```ts
async uploadPinImage(
    worldProfileId: string,
    file: File,
    options?: UploadPinImageOptions,
  ): Promise<string> {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('Anmeldung erforderlich');

    const prepared = options?.alreadyOptimized
      ? file
      : await prepareWorldMapPinFile(file, options?.signal);

    if (prepared.size > MAP_PIN_MAX_BYTES) {
      throw new Error('Bild ist zu groß. Maximum 5 MB');
    }
    if (prepared.type && !MAP_PIN_ALLOWED_MIME.has(prepared.type)) {
      throw new Error('Nur PNG, JPEG oder WebP erlaubt.');
    }

    const ext =
      prepared.type === 'image/png' ? 'png' : prepared.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user.id}/world/${worldProfileId}/pins/${Date.now().toString(36)}.${ext}`;
    const { error } = await supabase.storage.from('world-map-pins').upload(path, prepared, {
      upsert: false,
      contentType: prepared.type || 'image/jpeg',
    });
    if (error) throw new Error(`Pin-Bild Upload fehlgeschlagen: ${error.message}`);
    return path;
  }
```

### src/infrastructure/world/world-place-service.ts:34

```ts
async listPlaces(
    worldProfileId: string,
    options: ListWorldPlacesOptions = {},
  ): Promise<WorldPlaceVm[]> {
    await assertSupabaseJwtSession();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const { data, error } = await supabase.rpc('list_world_places', {
      p_world_profile_id: id,
      p_player_view: options.playerView === true,
      p_saga_public_id: options.sagaPublicId?.trim() || null,
    });
    if (error) throw new Error(`Orte konnten nicht geladen werden: ${error.message}`);
    return parseWorldPlaceList(data);
  }
```

### src/infrastructure/world/world-place-service.ts:50

```ts
async listMapLinks(
    worldProfileId: string,
    options: ListWorldPlacesOptions = {},
  ): Promise<WorldPlaceMapLinkVm[]> {
    await assertSupabaseJwtSession();
    const id = worldProfileId.trim();
    if (!id) throw new Error('Weltprofil fehlt');
    const { data, error } = await supabase.rpc('list_world_place_map_links', {
      p_world_profile_id: id,
      p_player_view: options.playerView === true,
      p_saga_public_id: options.sagaPublicId?.trim() || null,
    });
    if (error) throw new Error(`Kartenverknüpfungen fehlgeschlagen: ${error.message}`);
    return parseWorldPlaceMapLinkList(data);
  }
```

### src/infrastructure/world/world-place-service.ts:66

```ts
async upsertPlace(input: UpsertWorldPlaceInput): Promise<WorldPlaceVm> {
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('upsert_world_place', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId ?? null,
      p_parent_place_id: input.parentPlaceId ?? null,
      p_kind: input.kind,
      p_name: input.name,
      p_description: input.description ?? null,
      p_status: input.status ?? 'draft',
      p_seed_key: input.seedKey ?? null,
      p_sort_order: input.sortOrder ?? 0,
    });
    if (error) throw new Error(`Ort speichern fehlgeschlagen: ${error.message}`);
    const parsed = parseWorldPlaceVm(data);
    if (!parsed) throw new Error('Ort speichern: ungültige Antwort');
    return parsed;
  }
```

### src/infrastructure/world/world-place-service.ts:89

```ts
async createNodeWithMaps(input: {
    readonly worldProfileId: string;
    readonly kind: WorldNodeKind;
    readonly name: string;
    readonly idempotencyKey: string;
    readonly subtype?: WorldNodeSubtype | null;
    readonly parentPlaceId?: string | null;
    readonly description?: string | null;
  }): Promise<Readonly<Record<string, unknown>>> {
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('create_world_node_with_maps', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_kind: input.kind,
      p_name: input.name,
      p_idempotency_key: input.idempotencyKey.trim(),
      p_subtype: input.subtype ?? null,
      p_parent_place_id: input.parentPlaceId ?? null,
      p_description: input.description ?? null,
    });
    if (error) throw new Error(`Weltknoten anlegen fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') {
      throw new Error('Weltknoten anlegen: ungültige Antwort');
    }
    return data as Readonly<Record<string, unknown>>;
  }
```

### src/infrastructure/world/world-place-service.ts:116

```ts
async previewNodeConsequences(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
  }): Promise<Readonly<Record<string, unknown>>> {
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('preview_world_node_consequences', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
    });
    if (error) throw new Error(`Folgenabschätzung fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error('Folgenabschätzung: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }
```

### src/infrastructure/world/world-place-service.ts:130

```ts
async renameNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly name: string;
  }): Promise<WorldPlaceVm> {
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('rename_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_name: input.name,
    });
    if (error) throw new Error(`Umbenennen fehlgeschlagen: ${error.message}`);
    const parsed = parseWorldPlaceVm(data);
    if (!parsed) throw new Error('Umbenennen: ungültige Antwort');
    return parsed;
  }
```

### src/infrastructure/world/world-place-service.ts:147

```ts
async reparentNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly newParentPlaceId: string | null;
    readonly confirmRelocate: boolean;
  }): Promise<Readonly<Record<string, unknown>>> {
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('reparent_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_new_parent_place_id: input.newParentPlaceId,
      p_confirm_relocate: input.confirmRelocate,
    });
    if (error) throw new Error(`Verschieben fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error('Verschieben: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }
```

### src/infrastructure/world/world-place-service.ts:165

```ts
async duplicateNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly deep?: boolean;
  }): Promise<Readonly<Record<string, unknown>>> {
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('duplicate_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_deep: input.deep === true,
    });
    if (error) throw new Error(`Duplizieren fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error('Duplizieren: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }
```

### src/infrastructure/world/world-place-service.ts:181

```ts
async archiveNodeSubtree(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly confirm: boolean;
  }): Promise<Readonly<Record<string, unknown>>> {
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('archive_world_node_subtree', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_confirm: input.confirm,
    });
    if (error) throw new Error(`Archivieren fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error('Archivieren: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }
```

### src/infrastructure/world/world-place-service.ts:197

```ts
async deleteNode(input: {
    readonly worldProfileId: string;
    readonly placeId: string;
    readonly confirm: boolean;
  }): Promise<Readonly<Record<string, unknown>>> {
    await assertSupabaseJwtSession();
    const { data, error } = await supabase.rpc('delete_world_node', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_confirm: input.confirm,
    });
    if (error) throw new Error(`Löschen fehlgeschlagen: ${error.message}`);
    if (!data || typeof data !== 'object') throw new Error('Löschen: ungültige Antwort');
    return data as Readonly<Record<string, unknown>>;
  }
```

### src/infrastructure/world/world-place-service.ts:213

```ts
async linkMap(input: LinkWorldPlaceMapInput): Promise<WorldPlaceMapLinkVm> {
    await assertSupabaseJwtSession();
    if (!isWorldPlaceMapUsage(input.usage)) {
      throw new Error(`Ungültige Kartenverwendung: ${input.usage}`);
    }
    const { data, error } = await supabase.rpc('upsert_world_place_map_link', {
      p_world_profile_id: input.worldProfileId.trim(),
      p_place_id: input.placeId.trim(),
      p_map_id: input.mapId.trim(),
      p_usage: input.usage,
      p_feature_id: input.featureId ?? null,
      p_anchor: input.anchor ?? {},
    });
    if (error) throw new Error(`Kartenverknüpfung fehlgeschlagen: ${error.message}`);
    const parsed = parseWorldPlaceMapLinkVm(data);
    if (!parsed) throw new Error('Kartenverknüpfung: ungültige Antwort');
    return parsed;
  }
```

### src/infrastructure/world/world-profile-service.ts:52

```ts
async getUserWorldProfiles(ownerUserId: string): Promise<WorldProfileVm[]> {
    if (!ownerUserId) throw new Error('User not authenticated');
    const jwtUserId = await assertSupabaseJwtSession();
    const { data, error } = await supabase
      .from(this.tableName)
      .select(WORLD_SELECT)
      .eq('owner_user_id', jwtUserId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Welten konnten nicht geladen werden: ${error.message}`);
    return (data ?? []).map((entry) => this.mapToViewModel(entry as WorldProfileDto));
  }
```

### src/infrastructure/world/world-profile-service.ts:65

```ts
async getWorldProfile(ownerUserId: string, id: string): Promise<WorldProfileVm> {
    if (!ownerUserId) throw new Error('User not authenticated');
    const jwtUserId = await assertSupabaseJwtSession();
    const { data, error } = await supabase
      .from(this.tableName)
      .select(WORLD_SELECT)
      .eq('id', id)
      .eq('owner_user_id', jwtUserId)
      .single();

    if (error) throw new Error(`Welt konnte nicht geladen werden: ${error.message}`);
    return this.mapToViewModel(data as WorldProfileDto);
  }
```

### src/infrastructure/world/world-profile-service.ts:80

```ts
async getByPublicId(worldPublicId: string): Promise<WorldProfileVm | null> {
    await assertSupabaseJwtSession();
    const publicId = worldPublicId.trim().toUpperCase();
    if (!publicId) return null;
    const { data, error } = await supabase
      .from(this.tableName)
      .select(WORLD_SELECT)
      .eq('public_id', publicId)
      .maybeSingle();
    if (error) throw new Error(`Welt konnte nicht geladen werden: ${error.message}`);
    if (!data) return null;
    return this.mapToViewModel(data as WorldProfileDto);
  }
```

### src/infrastructure/world/world-profile-service.ts:94

```ts
async createWorldProfile(ownerUserId: string, payload: CreateWorldProfileDto): Promise<WorldProfileVm> {
    if (!ownerUserId) throw new Error('User not authenticated');
    const jwtUserId = await assertSupabaseJwtSession();
    const insertPayload = {
      owner_user_id: jwtUserId,
      name: normalizeName(payload.name),
      description: normalizeDescription(payload.description),
      modules: normalizeWorldModuleConfigMap(payload.modules),
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .insert(insertPayload)
      .select(WORLD_SELECT)
      .single();

    if (error) throw new Error(`Welt konnte nicht erstellt werden: ${error.message}`);
    return this.mapToViewModel(data as WorldProfileDto);
  }
```

### src/infrastructure/world/world-profile-service.ts:124

```ts
async updateWorldProfile(
    ownerUserId: string,
    id: string,
    payload: UpdateWorldProfileDto,
  ): Promise<WorldProfileVm> {
    if (!ownerUserId) throw new Error('User not authenticated');
    const jwtUserId = await assertSupabaseJwtSession();
    const updatePayload = {
      ...(typeof payload.name === 'string' ? { name: normalizeName(payload.name) } : {}),
      ...(typeof payload.description === 'string' ? { description: normalizeDescription(payload.description) } : {}),
      ...(payload.modules ? { modules: normalizeWorldModuleConfigMap(payload.modules) } : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(this.tableName)
      .update(updatePayload)
      .eq('id', id)
      .eq('owner_user_id', jwtUserId)
      .select(WORLD_SELECT)
      .single();

    if (error) throw new Error(`Welt konnte nicht gespeichert werden: ${error.message}`);
    return this.mapToViewModel(data as WorldProfileDto);
  }
```

### src/infrastructure/world/world-profile-service.ts:150

```ts
async deleteWorldProfile(ownerUserId: string, id: string): Promise<void> {
    if (!ownerUserId) throw new Error('User not authenticated');
    const jwtUserId = await assertSupabaseJwtSession();

    // World item definitions reference this profile with ON DELETE RESTRICT so
    // owned instances never become permanently unresolvable. Refuse early with
    // a German message instead of surfacing the Postgres FK error.
    const { count, error: catalogError } = await supabase
      .from('inventory_item_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('world_profile_id', id);
    if (catalogError) {
      throw new Error(`Welt konnte nicht gelöscht werden: ${catalogError.message}`);
    }
    if ((count ?? 0) > 0) {
      throw new Error(
        'Welt kann nicht gelöscht werden, solange Gegenstand-Definitionen darauf verweisen. Archivieren Sie die Definitionen zuerst — Löschen würde bestehende Inventare unauflösbar machen.',
      );
    }

    const { count: npcCount, error: npcError } = await supabase
      .from('npc_creature_definitions')
      .select('id', { count: 'exact', head: true })
      .eq('world_profile_id', id);
    if (npcError) {
      throw new Error(`Welt konnte nicht gelöscht werden: ${npcError.message}`);
    }
    if ((npcCount ?? 0) > 0) {
      throw new Error(
        'Welt kann nicht gelöscht werden, solange NPC-/Kreatur-Definitionen darauf verweisen.',
      );
    }

    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .eq('owner_user_id', jwtUserId);

    if (error) throw new Error(`Welt konnte nicht gelöscht werden: ${error.message}`);
  }
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/character/inventory-v2/primitives.ts` | `7fd8dd5bddc63580ede1b8e0d6c89c146531ba7751128b664bf731c405343c86` |
| `src/domains/items/definition.ts` | `e47891149c62504d1ff96fb38e6a86ca26bf2e9a52795b7cd876a66b90c78b4a` |
| `src/domains/items/pack.ts` | `3214e2a3cbe1db088fb0eaca3d52503911f3c3601c6b01ed08bb75ef2707d975` |
| `src/domains/items/packs/build-standard-item.ts` | `1c2654f0e7980b409762995fe9025649f9cc2bd5324df3a6d50dd4642bdfe569` |
| `src/domains/items/packs/contemporary-basic.ts` | `c72535324491133bc1331abd5fb050d6c328f2177976b8d76f39b2438118f1c1` |
| `src/domains/items/packs/context-packs.ts` | `768e1cf834ea03ecb0b6b3e2335da8e4356682da34bf045df5ba18a1dd9df6fb` |
| `src/domains/items/packs/core-snapshots.ts` | `440e4fe239eedb982555c2e4aa82ea45ae3d687cb26e057516c1b36feccbc19e` |
| `src/domains/items/packs/fantasy-basic.ts` | `0d18e6a46d5d0603b66eade2eaa92f56a0531ad0e71dc1361bfca6cb4f507c2a` |
| `src/domains/items/packs/index.ts` | `d851952181c448d93ac61a51e2f4d02d89253447ef74ca93ff1048590bfff43d` |
| `src/domains/items/packs/scifi-basic.ts` | `6bfed5584dfaabcbc1ce6c323ebd6d9ababc286e9a94d77106c8355667379333` |
| `src/domains/items/taxonomy.ts` | `fa58dde95e4f9fa424244137f845ee4dbf8ae77d3e4e3ec1d114b74b1debc54a` |
| `src/domains/items/world-catalog.ts` | `fc39966cc6290f6c59bfdef799cd9e972e7799978299b8fe83a6a8b4b1162941` |
| `src/domains/media/index.ts` | `768ded2d0f0fd1d510d660924e787817673955dbeff021d7de9e0a8d8e38bdec` |
| `src/domains/media/optimization-contract.ts` | `ba9216dab79a9c03f66a16b77dedf1c26d4d00d6ae2693cc5a68919d1647846d` |
| `src/domains/media/optimization-policy.ts` | `6145574bc08d1eb94f54d488ebc1f8bc030c2a956e3e3fd24cb15a7c8e50c5ec` |
| `src/domains/npc-creature/definition.ts` | `c5cfbd3e9b937142fd04b2d9d8ef1470382062ae1565d4cf3622eb6053c05a45` |
| `src/domains/npc-creature/pack.ts` | `401d1450f6060c6984ec3a937ad4a5127602ce34f0e169fe008b860392892e25` |
| `src/domains/npc-creature/packs/animals.ts` | `728cbea35f072058db6974ce5dd3c80686012a9bd00e4de85c80e0d9f969b021` |
| `src/domains/npc-creature/packs/build-builtin.ts` | `ce343c3558c918920fd328fa1891d5085d00cf4c7fd3360709f749a3fe0c20c7` |
| `src/domains/npc-creature/packs/context-packs.ts` | `a95d23684c4c3687a02b4c98c3437155ef3a1eb01b02e39e8db50d8cf4b36ec6` |
| `src/domains/npc-creature/packs/fantasy-basics.ts` | `81ca439a786d0fcb2fa3bf28d801f68f068d7ff201831c157c2cec876f78561b` |
| `src/domains/npc-creature/packs/index.ts` | `7bb8adddd9ea09409db03785cfcce0656338fe948a86a2f5b4aa14f6a986aeb7` |
| `src/domains/npc-creature/taxonomy.ts` | `3dbc3aaed85858710186551bb41eeaac7475bcb573e1b980a9e64e63852936bc` |
| `src/domains/npc-creature/world-catalog.ts` | `6f87522e1d00aa2ed1b9e1e0310d47f8bb25506fc33d6bee9048f98705ddba2f` |
| `src/domains/rules/sagatree/items/carry-capacity.ts` | `1ea1910d07cbfcbbe5373a78a9256e79a746273f16a3c2e2e82693f1a17037df` |
| `src/domains/rules/sagatree/items/index.ts` | `ab296a0e5462aecb9c94a1e5b530a1afac2b1556d793c09eab631cad6bd62822` |
| `src/domains/rules/sagatree/items/resource-affordability.ts` | `ed42c8faa66a711bd8c7be240df38530bb2d02fff435d1f3aa200538f9388a09` |
| `src/domains/rules/sagatree/items/tool-rules.ts` | `3026c3797388370309b0ea33d1366969abc05b803654cf99c68c4eff42832f18` |
| `src/domains/rules/sagatree/items/types.ts` | `af76e6a5ebcec4a5e8acc3d3fd6461abfe083065c025080ef0b2ca851fdc6ff2` |
| `src/domains/rules/sagatree/items/validators.ts` | `257732bceab776a0afc34f01340eb7e47a94b5c9d984ebf3fff8e0bb7c8ff543` |
| `src/domains/rules/sagatree/npc-creature-power/benchmarks.ts` | `d102fe585bfec2eb44e556fc133d67086fb9915da4ba65497c83869fa82eb54d` |
| `src/domains/rules/sagatree/npc-creature-power/combat-roles.ts` | `28a1ddccaf3a34292e919a768bac20a226e9a4fbb423f17ab7c3cf70be27f512` |
| `src/domains/rules/sagatree/npc-creature-power/compute.ts` | `8085e6151a610bc1465cf129ea22845850042d6cff3c93aa052055039ead49f8` |
| `src/domains/rules/sagatree/npc-creature-power/damage-steps.ts` | `8bc739457eeeb77336b6124153d3f3a3642877c50c23fa7dab1f82b075c26a58` |
| `src/domains/rules/sagatree/npc-creature-power/index.ts` | `ff26d6741c491b687d01d8eaa87722a89df1fe25251794625d98e35a0f3fb5c6` |
| `src/domains/rules/sagatree/npc-creature-power/machtgrad.ts` | `19d4daafb9580b890ed2337feccffed19122a01dfb23c2eeb2dadd2523778f7a` |
| `src/domains/rules/sagatree/npc-creature-power/profiles.ts` | `aa3d450842ddce7548f6e8e826225cdbdeae6de7660e09798fe43663dc9ce1fa` |
| `src/domains/rules/sagatree/npc-creature-power/types.ts` | `de25ba46549bab20e0e55a513fb0745e722449d8f1b61bb51887d986653c4eab` |
| `src/domains/world/atlas/atlas-persist-state.ts` | `84ab0edbd0b525c95b5db85afeb683d335351884ba6c612e94f327719a6b60ca` |
| `src/domains/world/atlas/atlas-prototype-lod.ts` | `2fb7c706ad2210f7a3f389f22564f60e3f22aa615ec49af49695e388ae582256` |
| `src/domains/world/atlas/atlas-tool-registry.ts` | `9a6d6ef66b233ccb0a2fe82c5fea50406b7f3ef210ad3ef5280b7e79bd1acca4` |
| `src/domains/world/atlas/dornhain-unified-starter.ts` | `db76bc80f477931d3ca5b63f0858e34ed73d40a993355db3aaed86c8002105eb` |
| `src/domains/world/atlas/dungeon-generator.ts` | `2f65a7f1d96ef917a4973b52a3470e6bebbdc87eca53d41c0bbfe9bbe5cd81df` |
| `src/domains/world/atlas/index.ts` | `d1579908b6226016f0c89e4f1f4d2882f2d0a9cca3a6b9e77b9b28c5758fc18d` |
| `src/domains/world/atlas/map-edit-ops.ts` | `76ed8b7a5119dad0aa26f32419d40595a345ce467a34d49683cdaa4bc0bf2813` |
| `src/domains/world/atlas/map-frame.ts` | `5d915a8a4560698655964645ee31fbb309288188200938130a1c67af530c185a` |
| `src/domains/world/atlas/unified-canvas-doc.ts` | `ba7ac1a1e76d31a7bac71221d2f06c8e9e44a1bd55a6a14b6d7f9c3f6b950753` |
| `src/domains/world/atlas/validate-world-atlas.ts` | `3042c993e644808c908331970dd87367649889dbf9421c5507f88b7b415b009e` |
| `src/domains/world/atlas/webgl-runtime-bridge.ts` | `cc8365f602313ed487faa185257ce6b12400241d2f70867b00ef40329809e9b8` |
| `src/domains/world/atlas/world-atlas.types.ts` | `094fa1a6f46a54063fe396c7d641c6c34d5b8907c3f6e0127a2ae9e6443dcee7` |
| `src/domains/world/contracts/world.types.ts` | `ad676f8bf83b6d55627a568c28d5221bd8f4f616e33eae31fab502223c74f6fb` |
| `src/domains/world/hierarchy/create-plan.ts` | `6fefab23a8f62fb9a6ebe716c3f44704fa7ab5466b8d5fe0de904920f5aee38e` |
| `src/domains/world/hierarchy/index.ts` | `576f02be2a3187b6da3f83200079cbc3bbd274c44919a569c84da79008fe09b8` |
| `src/domains/world/hierarchy/legacy-kind-map.ts` | `8b9d99f4d56c970e274250c11849b746dbd8597eeade1c5401d327fa65335316` |
| `src/domains/world/hierarchy/migration-plan.ts` | `2226b97b89db2c2ca56631f3bae26d94bbd4dc9e8973a3f1cff0a2cd26c599a8` |
| `src/domains/world/hierarchy/mutations.ts` | `15e52f9f6460d4e5ec19d71f3ec42057b1a81e8468bc0d9490f58d7f6f5a6dcc` |
| `src/domains/world/hierarchy/world-hierarchy.ts` | `eb78e102eb0701a84c7a9b16e6da2321f4722755246ff30e3b4cac04bbd311ea` |
| `src/domains/world/hierarchy/world-node.types.ts` | `6baf15ffbb844e3483d8d351751aaa9c03c7b0ff17ce7746703154ad7e142e58` |
| `src/domains/world/hierarchy/world-scoped-inventory.ts` | `d4d2116ff392a949e0ef6c7b94cbffbc217b976f9948ba8d15f1a9c8b2e9354d` |
| `src/domains/world/map/atlas-camera.ts` | `e6f12a22831e1abe42cd69ee4040e68689b89924e67b7e63d978972683d84c48` |
| `src/domains/world/map/constants.ts` | `4310089141e333e8d740199f8c4ed212ce65dfdcbc119ef81ce8b3f8b6b1f707` |
| `src/domains/world/map/dornhain-starter-map.ts` | `b4bb022827d2b2fe7f4d0b490e1348b5f9fc1045ba1547b1e734d9130e335b8c` |
| `src/domains/world/map/index.ts` | `7ed8b7504cf841d0c40932c5bccf90c96871e0bb1e69ce1a51815c4615721624` |
| `src/domains/world/map/validate-world-map.ts` | `0209b9dfc4f8113ad8d0f620c482f0c0fd24af5a9d0a49ac19b07c7c439d91ec` |
| `src/domains/world/map/world-map.types.ts` | `3f84174b19f1ea1237560bf26c8874073ace59703dafe46cd14b7b63944dc8d2` |
| `src/domains/world/places/atlas-place-nav.ts` | `c8a53a66f401166edec26e6e43eb561143590998465d3401e218a487b4423142` |
| `src/domains/world/places/atlas-webgl-nav-tree.ts` | `e6f5bcaad2b6873f76bbfe8359677c9ae4ed0d8fe289348b3e5c1c0ebd67b740` |
| `src/domains/world/places/index.ts` | `32f10c6001d7fd81cc5ef6b991d18005469105cf296a4d4eb73ddde1c7633952` |
| `src/domains/world/places/parse-world-place.ts` | `05aab634ce97dd167871331376a1184f8f5ebad15fe970680bfc9feecb8d89de` |
| `src/domains/world/places/settlement-presets.ts` | `b2b5b95f43524fda6c7a76eeb332150202f9750c47db5d7a6518fee98b796199` |
| `src/domains/world/places/world-place.types.ts` | `32081a2c16516c68393e879ebc4e888441ca4e5009b20404158c6b25d09f4ef0` |
| `src/domains/world/worldModuleRegistry.ts` | `9683d27ea65c7a22456245c0e2e706168285f61e229f6ea181e0fb6a65064cc0` |
| `src/infrastructure/media/optimizer/engines/audio/index.ts` | `7585190a705085692bff0896e08b4d78f791895b47e24d57deeaaa10bb669d4e` |
| `src/infrastructure/media/optimizer/engines/image/image.worker.ts` | `d34793b4de682556d9306194cfbcd05fdafdf215da25393f955d2669c7499276` |
| `src/infrastructure/media/optimizer/engines/image/index.ts` | `4944001b7e0f7784d487da2e60d06d845aa564e9ddd7516ff50633af1591a322` |
| `src/infrastructure/media/optimizer/engines/image/optimize-image.ts` | `bf73e826651227f704aff5ed584546a087f22f26c68a4c45ba918dfefbe7ce3e` |
| `src/infrastructure/media/optimizer/engines/image/raster-decode.ts` | `8ba5eda07565b10d1fb3d4090d068d12b1415399088c6c6b4a2aadc3fe4d290c` |
| `src/infrastructure/media/optimizer/engines/image/resource-limits.ts` | `1178fc226c85aee4f4989a7bd650d0b9830b37657c7499c1cec174b4aa9af364` |
| `src/infrastructure/media/optimizer/engines/image/types.ts` | `501095579c8bf1cc3af3a93147f4ab9fe1f280909c02e759d3d95c0f7151d45d` |
| `src/infrastructure/media/optimizer/engines/image/webp-budget.ts` | `7e7a1669b42c38b713f35952517260a61ca636cc6f84f29c76b949e3bcc2f70c` |
| `src/infrastructure/media/optimizer/engines/image/webp-worker-client.ts` | `718b74e3146c6723862f0a4639eb5b7905a35f70a8c0e3c6e33d530a4ef80b84` |
| `src/infrastructure/media/optimizer/engines/model3d/index.ts` | `bcc13ca0c9f7bfa1a68e6c893509b21e682fe2c44732945fba85215042ac6d62` |
| `src/infrastructure/media/optimizer/engines/video/index.ts` | `d8c6aaaabb2ad762d4c15f9ef4aa9bc016f5968b2512cfe52f71cb09655dd842` |
| `src/infrastructure/media/optimizer/index.ts` | `c1b162af47239195707de742a8991bea14d85f2238108968613c3bad3d91cf02` |
| `src/infrastructure/media/optimizer/media-optimizer.ts` | `7d58424f12b7855ccb3c0153270628850e03afc15c285b1fc2b47218918255d9` |
| `src/infrastructure/world/host-world-adapter.ts` | `fa229c2ceb37648d38d91f85699817ae584ae85f9195b45ea0ebe594aba786da` |
| `src/infrastructure/world/host-world-ports.contract.ts` | `406d77c65527f6869c558a7b4c98c901766134f8e8d7dc6afc5271d6ba1a7f8e` |
| `src/infrastructure/world/host-world-read.contract.ts` | `271a052d5f621ddf7f3344eaa55e3a58579c5cf629fe76a4827393d0d1c7a05c` |
| `src/infrastructure/world/world-atlas-service.ts` | `252141b947176fbc28c1b353e0473eec2d18cef19ec671e8f89ac8998d107de1` |
| `src/infrastructure/world/world-map-service.ts` | `952e85442ef9cd7ac198ac33ba6703e58b967ab115efad0183cd240dccddee1e` |
| `src/infrastructure/world/world-place-service.ts` | `0a18cae0d8ac1503ffcb7f149e12f757aea44a6f346f75eb4f44742724e8d6c0` |
| `src/infrastructure/world/world-profile-service.ts` | `1197f7e5445289e7a5302990b7f3b21b635813888e8f1e0703808cd693de09fb` |
| `src/lib/authenticatedUser.ts` | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `src/lib/localAdmin.ts` | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

