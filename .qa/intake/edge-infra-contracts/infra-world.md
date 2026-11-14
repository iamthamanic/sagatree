# Infrastructure contract: world

**Status: SPEC; current branch source verified.** Implementation issue: **#812**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-world.json](source-contracts/infra-world.json) (SHA-256 `2e7d34ac1f29e1400db3d8eab7ff2dc9c6bc15fcb4f4bb460720bbe4970fa6d7`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

World profiles and17 world/atlas/place RPCs, item/NPC definition reads, world-atlas image storage and world-map-pins uploads. Class-field this.tableName resolves to world_profiles.

Owner/editor read differs from saga-player reveal projection; preserve p_saga_public_id,p_player_view and no private catalog/map/layer/title exposure.

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
| infra | `media` | #805 |  |

## Acceptance and negative tests (required, not executed)

- Create world/node/maps; edit/rename/reparent/duplicate/archive/delete with consequence preview and reload into DB-backed tree.
- Player sees only explicitly revealed map/place projection for the selected saga; owner without GM privileges follows actual per-RPC policy.
- Map pin upload uses storage bucket (not a table); every17 RPC dependency and profile CRUD transport ready before facade cutover.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

This area has no RPC, Edge, table, storage, realtime, fetch or auth calls. Its public browser processing/worker API is retained in the complete public declarations.

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
    deleteWorldAtlasMap: (actorId, worldProfileId, mapId) =>
      ports.deleteWorldAtlasMap(actorId, worldProfileId, mapId),
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
  /** ATL2-E01 — delete secondary atlas map (not primary / not root). */
  readonly deleteWorldAtlasMap: (
    actorId: string,
    worldProfileId: string,
    mapId: string,
  ) => Promise<HostWorldReadResult<{ readonly deletedMapId: string }>>;

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

### src/infrastructure/world/host-world-ports.contract.ts:254

```ts
export const HOST_WORLD_RPC_NAMES = [
  'archive_world_node_subtree',
  'create_world_node_with_maps',
  'delete_world_atlas_map',
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

### src/infrastructure/world/host-world-ports.contract.ts:275

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

### src/infrastructure/world/world-atlas-service.ts:34

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

### src/infrastructure/world/world-atlas-service.ts:143

```ts
export const worldAtlasService = new WorldAtlasService();
```

### src/infrastructure/world/world-map-service.ts:20

```ts
export type UploadPinImageOptions = {
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/world/world-map-service.ts:32

```ts
export async function prepareWorldMapPinFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  if (file.size > MAP_PIN_MAX_BYTES) {
    throw new Error('Bild ist zu groß. Maximum 5 MB');
  }
  if (!MAP_PIN_ALLOWED_MIME.has(file.type)) {
    throw new Error('Nur PNG, JPEG oder WebP sind als Pin-Bild erlaubt.');
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
    return file;
  }

  if (result.status === 'optimized') {
    if (!optimizedBytes || optimizedBytes.byteLength === 0) {
      throw new Error('Pin-Bild-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    if (!MAP_PIN_ALLOWED_MIME.has(result.outputMimeType)) {
      throw new Error(`Optimiertes MIME ${result.outputMimeType} ist nicht erlaubt.`);
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'pin';
    const ext =
      result.outputMimeType === 'image/webp'
        ? 'webp'
        : result.outputMimeType === 'image/png'
          ? 'png'
          : 'jpg';
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

### src/infrastructure/world/world-place-service.ts:32

```ts
export type ListWorldPlacesOptions = {
  readonly playerView?: boolean;
  readonly sagaPublicId?: string | null;
};
```

### src/infrastructure/world/world-place-service.ts:37

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

### src/infrastructure/world/world-place-service.ts:228

```ts
export const worldPlaceService = new WorldPlaceService();
```

### src/infrastructure/world/world-profile-service.ts:150

```ts
export const worldProfileService = new WorldProfileService();
```


## Remaining backend helper operations

All backend operations are included in the public declarations above.

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
| `src/domains/world/atlas/atlas-canonical-features.ts` | `a7e2b9471c960d3839e39f93fe1f6b332f5822620ef589ba4e1a0805dda6c3bd` |
| `src/domains/world/atlas/atlas-diorama-look.ts` | `a0c2f5ea6af2faabed685d4eff4035dad43b1e82f3d6b2a67e017ddcddf99ea6` |
| `src/domains/world/atlas/atlas-edit-history.ts` | `13a91efde301ec766d3b0f183affcd794abba9f4c4872c00549e9f631947e294` |
| `src/domains/world/atlas/atlas-heightfield.ts` | `1fafa49c651ac14ba5ae1e9a226b38ffeea636935b7e486daa1cdd41090b71fb` |
| `src/domains/world/atlas/atlas-hierarchy-lod.ts` | `d8f476a6aab1a6f8c63ee4d465401869e5b4191154b89b238f60fdba6c8b9bff` |
| `src/domains/world/atlas/atlas-hierarchy-nav.ts` | `d9df6c10f147e7f325dfc735306fe481e4aa1fc601e215a1f79df0f53b190be7` |
| `src/domains/world/atlas/atlas-map-doc-adapter.ts` | `d85a2ed7b2e6cd9650c4d87664fb09e7b4621779f2a820ed65c421e353caf04a` |
| `src/domains/world/atlas/atlas-map-pins.ts` | `1421ca01edd55307c341adc3ac74f4c5a7cef87f60fadbbe0faaa141898b4791` |
| `src/domains/world/atlas/atlas-persist-state.ts` | `84ab0edbd0b525c95b5db85afeb683d335351884ba6c612e94f327719a6b60ca` |
| `src/domains/world/atlas/atlas-product-camera.ts` | `6d65226fe7e6594079b61df81ec39a226d5b79788327ef95609dc70f9980d179` |
| `src/domains/world/atlas/atlas-product-geometry-plan.ts` | `de94ca0b6c23374ae5aed057fa756539285295574df9925598a0ed029a2a3ce9` |
| `src/domains/world/atlas/atlas-prototype-lod.ts` | `2fb7c706ad2210f7a3f389f22564f60e3f22aa615ec49af49695e388ae582256` |
| `src/domains/world/atlas/atlas-renderer-target.ts` | `51beb5d64d2972fa88a42a1f0437d42639c689f9612cd852e94ed72721b48678` |
| `src/domains/world/atlas/atlas-revision-contract.ts` | `d01c356239143862f9aa8f3fd44fca79105e3ed390327c34b9be6ce1902c78d6` |
| `src/domains/world/atlas/atlas-selection.ts` | `6c16fb40fe26addea8e33e718a89a019de099c6008c1000dd697d48fa12849a7` |
| `src/domains/world/atlas/atlas-terrain-mesh.ts` | `50dc7ef6c013f87f82f2030317c69a8ad619c7b4db1b65db0a7571a18186dd5d` |
| `src/domains/world/atlas/atlas-tool-registry.ts` | `be0492bd7d71f1dafa260c6a1a75165f8c587bd1f55d3178f96fbd67ac5988af` |
| `src/domains/world/atlas/atlas-webgl-write-retire.ts` | `baf40e97aaa9c74c873f3919e72b4d9049e8c7781566ed58ce52ccf2f168ce69` |
| `src/domains/world/atlas/atlas-workstation-adaptive.ts` | `d69212422676124cc3bd9a3ba664be7695209df29e6f5baa37eba68fd811cc48` |
| `src/domains/world/atlas/canvas-polygon.ts` | `a1bf513b449cf21b8e7d449d291c1f7965303072916f0192a214328a90920cea` |
| `src/domains/world/atlas/dornhain-golden-hierarchy.ts` | `894d9769af93bcc3655938bbd2e6db5c39dbaf4a386786cb686a19704be9c0c0` |
| `src/domains/world/atlas/dornhain-golden-reset.ts` | `242b85a727062342a69f934a3b0cb64d3c5c726a71b87548043facd7e62f6c2f` |
| `src/domains/world/atlas/dornhain-unified-starter.ts` | `5e9afab7ec94b7bef19535be6311b51a2f77c59b5f82b36fcd8b78007cc336f5` |
| `src/domains/world/atlas/dungeon-forge-workflow.ts` | `43acec183dd010bf8bef24e2a79ac7a5bb7f317fcd568591a02182c502860b79` |
| `src/domains/world/atlas/dungeon-generator.ts` | `013ccdb248e427f85b51e9dc8dfbf39b5c5d185e106d0024259afe3301fdbbfc` |
| `src/domains/world/atlas/dungeon-grid.ts` | `1e564a1f91df01b5e0edb38c3e3976f4809bb053d5d8367b0c5d2666d6f40c4d` |
| `src/domains/world/atlas/index.ts` | `f70523066ffa6db0e0299ceea4ed417e26e006df2032f67c8c38e19f125d2557` |
| `src/domains/world/atlas/map-edit-ops.ts` | `3440965957e4212748d109f74ce202fa7a320840d5c9f1347b0457347c797b95` |
| `src/domains/world/atlas/map-frame.ts` | `7a5bc6fb6ddcb38efd09fa3adf71889709fa230313a8d241d09cb9f5fa98e7a5` |
| `src/domains/world/atlas/unified-canvas-doc.ts` | `59fa68591c71d2f0bba3185fffb4adecf8d325464df4701309af76a2a99fbd82` |
| `src/domains/world/atlas/validate-world-atlas.ts` | `3042c993e644808c908331970dd87367649889dbf9421c5507f88b7b415b009e` |
| `src/domains/world/atlas/webgl-runtime-bridge.ts` | `4d7acacb2a3ded8df55b0d333bb35d51d2b291f8e3849b24577a44f87785434d` |
| `src/domains/world/atlas/world-atlas.types.ts` | `094fa1a6f46a54063fe396c7d641c6c34d5b8907c3f6e0127a2ae9e6443dcee7` |
| `src/domains/world/contracts/world.types.ts` | `ad676f8bf83b6d55627a568c28d5221bd8f4f616e33eae31fab502223c74f6fb` |
| `src/domains/world/hierarchy/create-plan.ts` | `6fefab23a8f62fb9a6ebe716c3f44704fa7ab5466b8d5fe0de904920f5aee38e` |
| `src/domains/world/hierarchy/index.ts` | `05ef0b33d0950512a3ac12eb64497fb3e3321f43d81b4fcf76e909a2ef52efe2` |
| `src/domains/world/hierarchy/legacy-kind-map.ts` | `8b9d99f4d56c970e274250c11849b746dbd8597eeade1c5401d327fa65335316` |
| `src/domains/world/hierarchy/migration-plan.ts` | `2226b97b89db2c2ca56631f3bae26d94bbd4dc9e8973a3f1cff0a2cd26c599a8` |
| `src/domains/world/hierarchy/mutations.ts` | `15e52f9f6460d4e5ec19d71f3ec42057b1a81e8468bc0d9490f58d7f6f5a6dcc` |
| `src/domains/world/hierarchy/primary-map-links.ts` | `7d01ecbbb2cb467379eed308f37aa0eac0bd223768077b86ee210414a32a2ece` |
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
| `src/infrastructure/host/host-library-http.ts` | `c56b88c60d6c9491fc7b6e6e1143ac4985ffdab5dff16afef8a54bce79629a07` |
| `src/infrastructure/host/host-world-http.ts` | `4e5b1a2d336b907aec8ef7f58505f4605eef1674d15ed6ce4a109d47f352b6bd` |
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
| `src/infrastructure/world/host-world-adapter.ts` | `8fbaad8d6d4ec9cc42070444441fae94fb20af020cdada2125a705877ea4e1f1` |
| `src/infrastructure/world/host-world-ports.contract.ts` | `9d11c1085646775f6c6eb5bdc29baa7ed40af0245354589bd767d4f80da1d582` |
| `src/infrastructure/world/host-world-read.contract.ts` | `271a052d5f621ddf7f3344eaa55e3a58579c5cf629fe76a4827393d0d1c7a05c` |
| `src/infrastructure/world/world-atlas-service.ts` | `63cdb7aea8402a51c8bf6480e325fd15d951c33c28aa1a7923340251878c5c1d` |
| `src/infrastructure/world/world-map-service.ts` | `d99faed233ee5c66d96d08397c0e292113a44e43efb51f4b30b7cc6a21a91103` |
| `src/infrastructure/world/world-place-service.ts` | `5fe2e68dd3949fb193547aa9ee498c15fc0e3f368bf546156a39086e805312bb` |
| `src/infrastructure/world/world-profile-service.ts` | `10935d830086c8f9972b9f9f982e7ba8203609facd408020c634df4400032610` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |

