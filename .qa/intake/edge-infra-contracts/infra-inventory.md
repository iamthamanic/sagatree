# Infrastructure contract: inventory

**Status: SPEC; current branch source verified.** Implementation issue: **#802**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-inventory.json](source-contracts/infra-inventory.json) (SHA-256 `ebc757072ed30dc832f77aa2ffeec1580e5c3db4929fe163bbcb6fd85e611699`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Persists inventory arrays on character and item-definition catalog, signs item thumbnail/model assets, handles asynchronous generation jobs.

Personal definitions owner-only; world definitions use world-profile ownership; archived mutations blocked; asset resolve follows existing owner/world policy.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (0): none.

Storage buckets (0): none.

Edge invokes (0): none.

Realtime call sites: 0. Direct fetch sites: 2. Explicit auth/helper sites: 2.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| auth | `authenticated account/session transport` | #793 |  |
| infra | `character` | #801 |  |
| infra | `media` | #805 |  |
| infra | `project` | #807 |  |

## Acceptance and negative tests (required, not executed)

- Inventory add/equip/consume persistence survives reload and cross-owner updates fail.
- Definition thumbnail and model upload/generate/status/resolve/remove preserve payload.assetKey/model3d and signed URL expiry.
- Catalog list/search includes allowed standard/personal/world items without promoting client-supplied origins.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### auth-helper: session identity

`src/infrastructure/inventory/inventory-persistence.ts:115` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/inventory/inventory-persistence.ts:110`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/inventory/item-catalog-service.ts:403` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/inventory/item-catalog-service.ts:390`; complete request/default/result/error logic is in the declarations below and the snapshot.
### fetch: `${base}/api/v1/items/model3d`

`src/infrastructure/inventory/item-model3d-service.ts:102` — dynamic-expression.

Exact call/query chain:
```ts
fetch(`${base}/api/v1/items/model3d`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
```

Enclosing operation: `src/infrastructure/inventory/item-model3d-service.ts:92`; complete request/default/result/error logic is in the declarations below and the snapshot.
### fetch: requestUrl

`src/infrastructure/inventory/item-thumbnail-service.ts:161` — dynamic-expression.

Exact call/query chain:
```ts
fetch(requestUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
```

Enclosing operation: `src/infrastructure/inventory/item-thumbnail-service.ts:149`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/inventory/host-inventory-adapter.ts:10

```ts
export type HostInventoryAdapter = HostInventoryPorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_INVENTORY_OPS;
};
```

### src/infrastructure/inventory/host-inventory-adapter.ts:15

```ts
export function createHostInventoryAdapter(ports: HostInventoryPorts): HostInventoryAdapter {
  return {
    transport: 'host',
    ops: HOST_INVENTORY_OPS,
    getOwnedInventory: (actorId, characterId) => ports.getOwnedInventory(actorId, characterId),
    putOwnedInventory: (actorId, characterId, inventory) =>
      ports.putOwnedInventory(actorId, characterId, inventory),
    listCatalog: (actorId, options) => ports.listCatalog(actorId, options),
    createDefinition: (actorId, draft) => ports.createDefinition(actorId, draft),
  };
}
```

### src/infrastructure/inventory/host-inventory-ports.contract.ts:9

```ts
export type HostInventoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };
```

### src/infrastructure/inventory/host-inventory-ports.contract.ts:13

```ts
export type HostInventoryStateRecord = {
  readonly characterId: string;
  readonly schemaVersion: number;
  readonly inventory: Readonly<Record<string, unknown>>;
  readonly updatedAt: string;
};
```

### src/infrastructure/inventory/host-inventory-ports.contract.ts:20

```ts
export type HostInventoryDefinitionRecord = {
  readonly id: string;
  readonly publicId: string;
  readonly origin: 'standard' | 'personal' | 'world';
  readonly ownerUserId: string | null;
  readonly worldProfileId: string | null;
  readonly status: 'active' | 'archived';
  readonly name: string;
  readonly payload: Readonly<Record<string, unknown>>;
};
```

### src/infrastructure/inventory/host-inventory-ports.contract.ts:31

```ts
export type HostInventoryDefinitionDraft = {
  readonly name?: unknown;
  readonly origin?: unknown;
  readonly worldProfileId?: unknown;
  readonly payload?: unknown;
};
```

### src/infrastructure/inventory/host-inventory-ports.contract.ts:38

```ts
export type HostInventoryPorts = {
  readonly getOwnedInventory: (
    actorId: string,
    characterId: string,
  ) => Promise<HostInventoryResult<HostInventoryStateRecord | null>>;
  readonly putOwnedInventory: (
    actorId: string,
    characterId: string,
    inventory: unknown,
  ) => Promise<HostInventoryResult<HostInventoryStateRecord>>;
  readonly listCatalog: (
    actorId: string,
    options?: {
      readonly worldProfileId?: string | null;
      readonly query?: string;
      readonly includeArchived?: boolean;
      readonly origins?: readonly ('standard' | 'personal' | 'world')[];
    },
  ) => Promise<HostInventoryResult<readonly HostInventoryDefinitionRecord[]>>;
  readonly createDefinition: (
    actorId: string,
    draft: HostInventoryDefinitionDraft,
  ) => Promise<HostInventoryResult<HostInventoryDefinitionRecord>>;
};
```

### src/infrastructure/inventory/host-inventory-ports.contract.ts:63

```ts
export const HOST_INVENTORY_OPS = [
  'getOwnedInventory',
  'putOwnedInventory',
  'listCatalog',
  'createDefinition',
] as const;
```

### src/infrastructure/inventory/inventory-persistence.ts:32

```ts
export interface CharacterInventoryRead {
  state: InventoryState;
  authoritativeV2: boolean;
  legacyFallback: boolean;
}
```

### src/infrastructure/inventory/inventory-persistence.ts:38

```ts
export function readCharacterInventory(
  dto: Pick<CharacterDto, 'inventory' | 'inventory_v2' | 'inventory_schema_version'>,
): CharacterInventoryRead {
  if (dto.inventory_schema_version === 2 && isInventoryV2State(dto.inventory_v2)) {
    return {
      state: cloneInventory(dto.inventory_v2),
      authoritativeV2: true,
      legacyFallback: false,
    };
  }

  if (dto.inventory_schema_version === 2) {
    console.warn(
      '[inventory-v2] inventory_schema_version=2 but inventory_v2 payload is invalid; falling back to legacy ItemDto[] without overwriting.',
    );
  }

  const migrated = migrateLegacyInventory(dto.inventory as ItemDto[] | undefined);
  return {
    state: migrated.state,
    authoritativeV2: false,
    legacyFallback: true,
  };
}
```

### src/infrastructure/inventory/inventory-persistence.ts:63

```ts
export async function assertWritableInventoryV2(
  state: unknown,
  characterId: string | null,
): Promise<InventoryState> {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
  return catalogAssertWritableInventoryV2(state, characterId);
}
```

### src/infrastructure/inventory/inventory-persistence.ts:73

```ts
export async function persistMigratedInventory(
  characterId: string,
  migration: LegacyMigrationResult,
): Promise<InventoryState> {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }

  const fingerprintToId = new Map<string, string>();
  for (const draft of migration.personalDrafts) {
    const stableId = await ensurePersonalDefinition(draft);
    fingerprintToId.set(draft.fingerprint, stableId);
  }

  const bound = bindPendingDefinitions(migration.state, fingerprintToId);

  const current = await fetchHostLibraryCharacter(characterId);
  const sheet = { ...(current.sheet ?? {}) } as Record<string, unknown>;
  const schemaVersion =
    typeof sheet.inventory_schema_version === 'number' ? sheet.inventory_schema_version : 1;
  if (schemaVersion !== 1) {
    throw new Error(
      'Inventar-Migration kollidierte mit einer anderen Speicherung. Bitte erneut versuchen.',
    );
  }

  const nextSheet = {
    ...sheet,
    inventory_v2: bound,
    inventory_schema_version: 2,
  };

  await updateHostLibraryCharacter(characterId, { sheet: nextSheet });

  return bound;
}
```

### src/infrastructure/inventory/inventory-persistence.ts:136

```ts
export function migrationDefinitionId(fingerprint: string): string {
  return `personal:mig-${fnv1aHex(fingerprint, 32)}`;
}
```

### src/infrastructure/inventory/item-catalog-service.ts:48

```ts
export type ForkDefinitionTarget =
  | { scope: 'personal' }
  | { scope: 'world'; worldProfileId: string };
```

### src/infrastructure/inventory/item-catalog-service.ts:53

```ts
export type ItemDefinitionDraft = ItemDefinitionWriteDraft;
```

### src/infrastructure/inventory/item-catalog-service.ts:123

```ts
export async function resolveEffectiveWorldProfileId(characterId: string): Promise<string | null> {
  assertHost();
  const trimmed = characterId.trim();
  if (!trimmed) return null;

  const row = await fetchHostLibraryCharacter(trimmed);
  const sheet = isRecord(row.sheet) ? row.sheet : {};
  const characterWorldRaw =
    (typeof sheet.world_profile_id === 'string' ? sheet.world_profile_id : null) ??
    (typeof sheet.worldProfileId === 'string' ? sheet.worldProfileId : null);

  let adventureWorldProfileId: string | null = null;
  const arcs = await fetchHostLibraryAdventureArcs(trimmed);
  for (const arc of arcs) {
    if (!isRecord(arc)) continue;
    if (arc.status !== 'active' && arc.status !== undefined) continue;
    const projectId = typeof arc.project_id === 'string' ? arc.project_id : '';
    if (!projectId) continue;
    try {
      const project = await projectService.getProjectById(projectId);
      if (project.worldProfileId) {
        adventureWorldProfileId = project.worldProfileId;
        break;
      }
    } catch {
      /* ignore missing project */
    }
  }

  return resolveEffectiveWorldProfileIdFromBinding({
    adventureWorldProfileId,
    characterWorldProfileId: typeof characterWorldRaw === 'string' ? characterWorldRaw : null,
  });
}
```

### src/infrastructure/inventory/item-catalog-service.ts:170

```ts
export interface CharacterItemCatalog {
  effectiveWorldProfileId: string | null;
  addable: ItemDefinition[];
  lookup: ItemDefinitionLookup;
  records: CatalogDefinitionRecord[];
}
```

### src/infrastructure/inventory/item-catalog-service.ts:177

```ts
export interface LibraryItemCatalog {
  definitions: ItemDefinition[];
  persistedRecords: CatalogDefinitionRecord[];
}
```

### src/infrastructure/inventory/item-catalog-service.ts:182

```ts
export async function loadCharacterItemCatalog(
  characterId: string | null,
  userId: string,
): Promise<CharacterItemCatalog> {
  assertHost();
  const effectiveWorldProfileId = characterId ? await resolveEffectiveWorldProfileId(characterId) : null;
  const records = await listCatalogRecordsForEffectiveWorld(effectiveWorldProfileId, userId);
  const context = { userId, effectiveWorldProfileId };

  // Host world `modules` parity (#1159): defaults until host exposes modules JSON.
  const modules = null;
  const { config } = getItemCatalogModuleConfig(modules);

  const worldDefinitions = records
    .filter(
      (record) =>
        record.status === 'active' &&
        record.definition.scope === 'world' &&
        isDefinitionVisible(record, context),
    )
    .map((record) => record.definition);

  const personalDefinitions = records
    .filter(
      (record) =>
        record.status === 'active' &&
        record.definition.scope === 'personal' &&
        isDefinitionVisible(record, context),
    )
    .map((record) => record.definition);

  const resolveDefinition = (definitionId: string): ItemDefinition | undefined => {
    const builtin = getBuiltinStandardDefinition(definitionId);
    if (builtin) return builtin;
    const core = getCoreItemDefinition(definitionId);
    if (core) return core;
    const match = records.find((record) => record.definition.id === definitionId);
    return match?.definition;
  };

  const composed = composeCharacterInventoryAddCatalog({
    effectiveWorldProfileId,
    config,
    coreDefinitions: listCoreItemDefinitions(),
    resolveDefinition,
    worldDefinitions,
    personalDefinitions,
  });

  const baseLookup = createDefinitionLookup(records, context);
  const lookup: ItemDefinitionLookup = (definitionId) =>
    baseLookup(definitionId) ?? getBuiltinStandardDefinition(definitionId);

  return {
    effectiveWorldProfileId,
    addable: [...composed.definitions],
    lookup,
    records,
  };
}
```

### src/infrastructure/inventory/item-catalog-service.ts:243

```ts
export async function loadLibraryItemCatalog(): Promise<LibraryItemCatalog> {
  assertHost();
  const persistedRecords = await fetchHostItemRecords();
  const byId = new Map<string, ItemDefinition>();

  for (const definition of listCoreItemDefinitions()) {
    byId.set(definition.id, withCatalogPublicId(normalizeItemDefinition(definition)));
  }
  for (const definition of listBuiltinStandardDefinitions()) {
    byId.set(definition.id, withCatalogPublicId(normalizeItemDefinition(definition)));
  }
  for (const record of persistedRecords) {
    if (record.status !== 'active') continue;
    const normalized = normalizeItemDefinition(record.definition);
    byId.set(
      record.definition.id,
      record.publicId ? { ...normalized, publicId: record.publicId } : normalized,
    );
  }

  const definitions = [...byId.values()].sort(compareLibraryItemDefinitions);
  return { definitions, persistedRecords };
}
```

### src/infrastructure/inventory/item-catalog-service.ts:267

```ts
export async function loadWorldProfileItemCatalog(
  worldProfileId: string,
): Promise<CatalogDefinitionRecord[]> {
  assertHost();
  const wid = worldProfileId.trim();
  if (!wid) return [];
  // CUT-06b: host world-scoped list including archived; ACL fail-closed (403).
  return fetchHostItemRecords({
    worldProfileId: wid,
    includeArchived: true,
    origins: ['world'],
  });
}
```

### src/infrastructure/inventory/item-catalog-service.ts:281

```ts
export async function getItemDefinitionById(definitionId: string): Promise<{
  definition: ItemDefinition;
  record: CatalogDefinitionRecord | null;
} | null> {
  assertHost();
  const hostItem = await fetchHostLibraryItem(definitionId);
  const record = mapHostLibraryItemRecord(hostItem);
  if (record) return { definition: record.definition, record };
  const core = getCoreItemDefinition(definitionId);
  if (core) return { definition: withCatalogPublicId(core), record: null };
  const builtin = getBuiltinStandardDefinition(definitionId);
  if (builtin) return { definition: withCatalogPublicId(builtin), record: null };
  return null;
}
```

### src/infrastructure/inventory/item-catalog-service.ts:314

```ts
export async function createPersonalDefinition(
  draft: ItemDefinitionDraft,
): Promise<CatalogDefinitionRecord> {
  assertHost();
  return createHostCatalogDefinition('personal', draft, null);
}
```

### src/infrastructure/inventory/item-catalog-service.ts:321

```ts
export async function createWorldDefinition(
  worldProfileId: string,
  draft: ItemDefinitionDraft,
): Promise<CatalogDefinitionRecord> {
  assertHost();
  return createHostCatalogDefinition('world', draft, worldProfileId);
}
```

### src/infrastructure/inventory/item-catalog-service.ts:329

```ts
export async function updateDefinition(
  definitionId: string,
  draft: ItemDefinitionDraft,
): Promise<CatalogDefinitionRecord> {
  assertHost();
  const payload = toDefinitionPayload({
    ...draft,
    id: definitionId,
    scope: 'personal',
  });
  const updated = await updateHostLibraryItem(definitionId, {
    name: draft.name,
    payload,
  });
  const record = mapHostLibraryItemRecord(updated);
  if (!record) throw new Error('Host-Item speichern: ungültige Antwort');
  return record;
}
```

### src/infrastructure/inventory/item-catalog-service.ts:348

```ts
export async function archiveDefinition(definitionId: string): Promise<CatalogDefinitionRecord> {
  assertHost();
  const archived = await archiveHostLibraryItem(definitionId);
  const record = mapHostLibraryItemRecord(archived);
  if (!record) throw new Error('Host-Item archivieren: ungültige Antwort');
  return record;
}
```

### src/infrastructure/inventory/item-catalog-service.ts:356

```ts
export async function restoreDefinition(definitionId: string): Promise<CatalogDefinitionRecord> {
  assertHost();
  const restored = await restoreHostLibraryItem(definitionId);
  const record = mapHostLibraryItemRecord(restored);
  if (!record) throw new Error('Host-Item wiederherstellen: ungültige Antwort');
  return record;
}
```

### src/infrastructure/inventory/item-catalog-service.ts:364

```ts
export async function forkDefinition(
  sourceDefinitionId: string,
  target: ForkDefinitionTarget,
): Promise<CatalogDefinitionRecord> {
  assertHost();
  const origin = target.scope === 'world' ? 'world' : 'personal';
  const worldProfileId = target.scope === 'world' ? target.worldProfileId : null;
  const localSource =
    getCoreItemDefinition(sourceDefinitionId) ?? getBuiltinStandardDefinition(sourceDefinitionId);
  if (localSource) {
    const draft = buildForkedItemDefinitionDraft(localSource, origin);
    return createHostCatalogDefinition(origin, draft, worldProfileId);
  }
  const forked = await forkHostLibraryItem(sourceDefinitionId, {
    origin,
    worldProfileId,
  });
  const record = mapHostLibraryItemRecord(forked);
  if (!record) throw new Error('Host-Item forken: ungültige Antwort');
  return record;
}
```

### src/infrastructure/inventory/item-catalog-service.ts:390

```ts
export async function assertWritableInventoryV2(
  state: unknown,
  characterId: string | null,
): Promise<InventoryState> {
  assertHost();
  if (!isInventoryV2State(state)) {
    throw new Error('Inventar-Zustand ist ungültig.');
  }
  const definitionIds = new Set(
    Object.values(state.instances).map((instance) => instance.definitionId),
  );
  if (definitionIds.size === 0) return state;

  const userId = await getAuthenticatedUserId();
  const effectiveWorldProfileId = characterId
    ? await resolveEffectiveWorldProfileId(characterId)
    : null;
  const catalog = await listCatalogRecordsForEffectiveWorld(effectiveWorldProfileId, userId);
  const visible = new Set(catalog.map((record) => record.definition.id));
  // Builtin-standard ids resolve locally (#137/#143). Owned pack instances must
  // remain writable after the world excludes them from the add-catalog.
  const missing = [...definitionIds].filter((id) => {
    if (visible.has(id)) return false;
    return getBuiltinStandardDefinition(id) === undefined;
  });
  if (missing.length > 0) {
    throw new Error(
      `Unbekannte oder nicht sichtbare Gegenstandsdefinitionen: ${missing.slice(0, 5).join(', ')}`,
    );
  }
  return state;
}
```

### src/infrastructure/inventory/item-catalog.persistence.ts:16

```ts
export type PersistedDefinitionScope = 'world' | 'personal';
```

### src/infrastructure/inventory/item-catalog.persistence.ts:19

```ts
export interface ItemDefinitionDto {
  id: string;
  public_id?: string | null;
  scope: PersistedDefinitionScope;
  world_profile_id: string | null;
  owner_user_id: string;
  payload: unknown;
  status: CatalogDefinitionStatus;
  created_at: string;
  updated_at: string;
}
```

### src/infrastructure/inventory/item-catalog.persistence.ts:32

```ts
export const ITEM_DEFINITION_COLUMNS =
  'id, public_id, scope, world_profile_id, owner_user_id, payload, status, created_at, updated_at';
```

### src/infrastructure/inventory/item-catalog.persistence.ts:43

```ts
export function mapDefinitionRow(dto: ItemDefinitionDto): CatalogDefinitionRecord | null {
  const definition = parseItemDefinition(dto.id, dto.scope, dto.payload);
  if (!definition) return null;
  const publicId =
    typeof dto.public_id === 'string' && dto.public_id.trim()
      ? dto.public_id.trim().toUpperCase()
      : null;
  return {
    definition: publicId ? { ...definition, publicId } : definition,
    status: dto.status === 'archived' ? 'archived' : 'active',
    publicId,
    worldProfileId: dto.world_profile_id,
    ownerUserId: dto.owner_user_id,
  };
}
```

### src/infrastructure/inventory/item-catalog.persistence.ts:66

```ts
export function toDefinitionPayload(definition: ItemDefinition): Record<string, unknown> {
  const { id: _id, scope: _scope, publicId: _publicId, ...payload } = definition;
  return {
    ...payload,
    payloadVersion: ITEM_DEFINITION_PAYLOAD_VERSION,
  };
}
```

### src/infrastructure/inventory/item-model3d-service.ts:20

```ts
export type ItemModel3dJobUiStatus =
  | 'idle'
  | 'waiting'
  | 'generating'
  | 'succeeded'
  | 'failed'
  | 'canceled';
```

### src/infrastructure/inventory/item-model3d-service.ts:28

```ts
export interface ItemModel3dConfig {
  meshyConfigured: boolean;
  maxBytes: number;
  allowedMime: readonly string[];
}
```

### src/infrastructure/inventory/item-model3d-service.ts:34

```ts
export interface ItemModel3dUploadResult {
  model3d: string;
  signedUrl: string;
  mime: ItemModel3dMime;
  byteSize: number;
}
```

### src/infrastructure/inventory/item-model3d-service.ts:41

```ts
export interface ItemModel3dJobSnapshot {
  jobId: string;
  jobStatus: ItemModel3dJobUiStatus;
  progress: number;
  errorMessage?: string;
  model3d?: string;
  signedUrl?: string;
}
```

### src/infrastructure/inventory/item-model3d-service.ts:146

```ts
export async function validateModel3dFileClient(file: File): Promise<ItemModel3dMime> {
  if (file.size > ITEM_MODEL3D_MAX_BYTES) {
    throw new Error('Datei zu groß (max. 50 MB).');
  }
  const nameOk = file.name.toLowerCase().endsWith('.glb');
  const mimeOk = isAllowedItemModel3dMime(file.type) || file.type === '' || nameOk;
  if (!mimeOk) {
    throw new Error('Nur GLB-Dateien sind erlaubt.');
  }
  const magic = await readFileMagic(file);
  if (!sniffItemModel3dGlb(magic)) {
    throw new Error('Datei ist kein gültiges GLB (glTF Binary).');
  }
  return ITEM_MODEL3D_MIME;
}
```

### src/infrastructure/inventory/item-model3d-service.ts:290

```ts
export const itemModel3dService = new ItemModel3dService();
```

### src/infrastructure/inventory/item-thumbnail-service.ts:19

```ts
export type PrepareItemThumbnailOptions = {
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/inventory/item-thumbnail-service.ts:28

```ts
export async function prepareItemThumbnailFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  const mime = validateThumbnailFileClient(file);
  const { optimizeMedia } = await import('../media/optimizer');
  let optimizedBytes: Uint8Array | undefined;
  const result = await optimizeMedia({
    kind: 'image',
    profileId: 'item-thumbnail',
    mimeType: mime,
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
      throw new Error('Thumbnail-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    if (!isAllowedItemThumbnailMime(result.outputMimeType)) {
      throw new Error(`Optimiertes MIME ${result.outputMimeType} ist nicht erlaubt.`);
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'thumbnail';
    const ext =
      result.outputMimeType === 'image/webp'
        ? 'webp'
        : result.outputMimeType === 'image/png'
          ? 'png'
          : 'jpg';
    return new File([copy], `${base}.${ext}`, { type: result.outputMimeType });
  }

  if (result.status === 'aborted') {
    throw new Error(result.message || 'Thumbnail-Optimierung abgebrochen.');
  }

  const message =
    'message' in result && typeof result.message === 'string'
      ? result.message
      : 'Thumbnail-Optimierung fehlgeschlagen.';
  throw new Error(message);
}
```

### src/infrastructure/inventory/item-thumbnail-service.ts:81

```ts
export type ItemThumbnailJobUiStatus =
  | 'idle'
  | 'waiting'
  | 'generating'
  | 'succeeded'
  | 'failed'
  | 'canceled';
```

### src/infrastructure/inventory/item-thumbnail-service.ts:89

```ts
export interface ItemThumbnailConfig {
  meshyConfigured: boolean;
  maxBytes: number;
  allowedMime: readonly string[];
}
```

### src/infrastructure/inventory/item-thumbnail-service.ts:95

```ts
export interface ItemThumbnailUploadResult {
  assetKey: string;
  signedUrl: string;
  mime: ItemThumbnailMime;
  byteSize: number;
}
```

### src/infrastructure/inventory/item-thumbnail-service.ts:102

```ts
export interface ItemThumbnailJobSnapshot {
  jobId: string;
  jobStatus: ItemThumbnailJobUiStatus;
  progress: number;
  errorMessage?: string;
  assetKey?: string;
  signedUrl?: string;
}
```

### src/infrastructure/inventory/item-thumbnail-service.ts:200

```ts
export function validateThumbnailFileClient(file: File): ItemThumbnailMime {
  if (!isAllowedItemThumbnailMime(file.type)) {
    throw new Error('Nur PNG, JPEG oder WebP sind erlaubt.');
  }
  if (file.size > ITEM_THUMBNAIL_MAX_BYTES) {
    throw new Error('Datei zu groß (max. 10 MB).');
  }
  return file.type;
}
```

### src/infrastructure/inventory/item-thumbnail-service.ts:347

```ts
export const itemThumbnailService = new ItemThumbnailService();
```


## Remaining backend helper operations

### src/infrastructure/inventory/inventory-persistence.ts:110

```ts
async function ensurePersonalDefinition(draft: MigratedPersonalDefinitionDraft): Promise<string> {
  const id = migrationDefinitionId(draft.fingerprint);
  const existing = await fetchHostLibraryItem(id);
  if (existing) return id;

  await getAuthenticatedUserId();
  const payload = toDefinitionPayload({
    ...toItemDefinitionDraft(draft),
    id,
    scope: 'personal',
  });

  const created = await createHostLibraryItem({
    name: draft.name,
    origin: 'personal',
    worldProfileId: null,
    payload,
  });
  if (!created || typeof created !== 'object') {
    throw new Error('Persönliche Definition konnte nicht angelegt werden.');
  }
  const row = created as Record<string, unknown>;
  const newId = typeof row.id === 'string' ? row.id : id;
  return newId;
}
```

### src/infrastructure/inventory/item-model3d-service.ts:92

```ts
async function invokeHost(body: Record<string, unknown>): Promise<FunctionResponse> {
  if (!isHostLibraryEnabled()) {
    return { status: 'error', message: '3D-Modell-Dienst nicht erreichbar.' };
  }
  const base = getHostAuthBaseUrl()?.replace(/\/$/, '') ?? '';
  if (!base) {
    return { status: 'error', message: '3D-Modell-Dienst nicht erreichbar.' };
  }
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1/items/model3d`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 'error', message: '3D-Modell-Dienst nicht erreichbar.' };
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { status: 'error', message: '3D-Modell-Dienst nicht erreichbar.' };
  }
  return parseResponse(data);
}
```

### src/infrastructure/inventory/item-thumbnail-service.ts:149

```ts
async function invokeHost(body: Record<string, unknown>): Promise<FunctionResponse> {
  if (!isHostLibraryEnabled()) {
    return { status: 'error', message: 'Thumbnail-Dienst nicht erreichbar.' };
  }
  const base = getHostAuthBaseUrl();
  if (base === null) {
    return { status: 'error', message: 'Thumbnail-Dienst nicht erreichbar.' };
  }
  const requestUrl =
    base === '' ? '/api/v1/items/thumbnail' : `${base}/api/v1/items/thumbnail`;
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 'error', message: 'Thumbnail-Dienst nicht erreichbar.' };
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { status: 'error', message: 'Thumbnail-Dienst nicht erreichbar.' };
  }
  return parseResponse(data);
}
```


## Verification source manifest

| Path | SHA-256 |
|---|---|
| `src/domains/character/avatar/face-anchor-contract.ts` | `e302f0b6ab5827217a8bd30aa0a77fa8b0147c429b32a48b15c312f4cd778b5a` |
| `src/domains/character/avatar/morph-contract.ts` | `7540a9aaaba59981033500ac67329060e39c2f259c35460c964c39c1e461d96f` |
| `src/domains/character/domain/character.entity.ts` | `56e76a478531eb46ae523b1b1c3d8fd4d076af742baf2ef1edea5dac70768120` |
| `src/domains/character/domain/sagatree-profile.entity.ts` | `05e8ef0db1b750a537db5ef30456e6e7ec18ce49583d64f3e6c4d296cfde7f2f` |
| `src/domains/character/inventory-v2/catalog.ts` | `f909f58dcb7c831a3626c74e51fa16ce9d4c8c118ac8b8b9ec3b7385cb1df31d` |
| `src/domains/character/inventory-v2/core-catalog.ts` | `d3822381e8fdc3a4cee8dccdd2202fd9d1124d76e4cec1bac4f270b26e7c12ed` |
| `src/domains/character/inventory-v2/index.ts` | `893781b8449f0db869c064c184d56c6d412aefae61c122645cddae2d19673ba0` |
| `src/domains/character/inventory-v2/migrate-legacy.ts` | `d58e79c0ec7aafd7e5b505875c6740959b9ca0fbd3d58044a955de651dc61a61` |
| `src/domains/character/inventory-v2/operations.ts` | `84627bec59e4dc936ac71fe4c39215717d4af158d3cda017a2d29cc4d609d358` |
| `src/domains/character/inventory-v2/primitives.ts` | `5021b44baa17a7327c3bdb83de9d64ff2b0d20158ff46aaef5a08cfc68c45569` |
| `src/domains/character/inventory-v2/state.ts` | `1f9ad7531f6926ce95ade24278656d3a7fdfbc32d4cba1fde4a01e8b1dbf6ea2` |
| `src/domains/character/inventory-v2/types.ts` | `1fe13df9923dcd8e8fac3c4ab6e8bfbd35eb10ec352081ae5f252a2823da3c77` |
| `src/domains/character/inventory-v2/validation.ts` | `20f96d7c715b91a84db6124873e1cea1817c3feaaf62585f656aecac77360e74` |
| `src/domains/items/assets.ts` | `13a88adc0b73c0beab3786996b991ab9c0670d467d6385cdb97ab2c08c1d3c38` |
| `src/domains/items/definition.ts` | `ef251eed365154c4d4cb7c6f7d72bdc121fb7760425b4cac58591740f3368944` |
| `src/domains/items/fork.ts` | `2a8e5ca8f664f83f6b0ecf976d0f214d59888a341db41ff731f8f5604cf4d371` |
| `src/domains/items/icon-assets.ts` | `afa9813b79e9cbd36e56c0ab1b378a07e055f531cac8091ccdb93f45230c0079` |
| `src/domains/items/index.ts` | `f0bf801bd99a13014598868bcd1def1c03e1a2dcab208f5b7fdb0d8b9bd89b48` |
| `src/domains/items/library-query.ts` | `dd323479a80955a0b302688b3f7696cedd47d9a0ad41ab5ae5cff836dadf2d60` |
| `src/domains/items/model3d-assets.ts` | `80c1039bbc26634426aa11d686be78ed7b7454d8c3ca1aed4f04c51f63de363a` |
| `src/domains/items/normalize.ts` | `d422f42aba4d42bfe9c998b08ce652cb7f4c9a599d37145bb9ff0bd8802d2a12` |
| `src/domains/items/pack.ts` | `5bbfcd4281787655816e921966465b8b923395bd82f3cf177872ff162dd8ca52` |
| `src/domains/items/packs/build-standard-item.ts` | `20c12f039359118ff7da32369d691507cd427fd2385115182d8fbc9e73624b84` |
| `src/domains/items/packs/contemporary-basic.ts` | `27b236cbed30bc2e726c74770d344a8bea889dbd9dcd07f2e2aa1ba854dc368a` |
| `src/domains/items/packs/context-packs.ts` | `3e937ac0a28c6e0cd4a9a31293741bdb8be227160b4225c4dc759395b8906ca3` |
| `src/domains/items/packs/core-snapshots.ts` | `02e7b6f3c5f6489d8a9e64d9b7cd4b2f5aae7bcadf936e2f6dc1ba17ff8a29aa` |
| `src/domains/items/packs/fantasy-basic.ts` | `bf57619bcf321f4662e7b901bc87f4ab1f220d33af5028878c0bf1f0b9d695cf` |
| `src/domains/items/packs/index.ts` | `ce1be63b2477bf222226d7e9f27329d7e0ab85b8d397ce155575e123bfa84cbc` |
| `src/domains/items/packs/scifi-basic.ts` | `f5a6a7d2fcffc70cca5d682c1fbfb4958da0264fa40b36b1d006abe855b464ea` |
| `src/domains/items/payload.ts` | `a55a765efb9444af8ac56fb54b867dbd27d3852184d13201298f28236c490d61` |
| `src/domains/items/taxonomy.ts` | `dfc8e520760a38f6ff74416f1b628105f3515ba2339da0a9044b56f69364459d` |
| `src/domains/items/validate.ts` | `60029927eecad1632629695677f49626e07ae8a80bab3b56e3d9fbcbeeb18579` |
| `src/domains/items/world-catalog.ts` | `db0d6a449c0ffb41c18a4248327113781359146deb1c27d352e833ca94aa1384` |
| `src/domains/media/index.ts` | `768ded2d0f0fd1d510d660924e787817673955dbeff021d7de9e0a8d8e38bdec` |
| `src/domains/media/optimization-contract.ts` | `997c49f8cda2ea1661a89e4fbdbc5a106500da46fadaf7a3a9fc5900134c7ccd` |
| `src/domains/media/optimization-policy.ts` | `6145574bc08d1eb94f54d488ebc1f8bc030c2a956e3e3fd24cb15a7c8e50c5ec` |
| `src/domains/project/contracts/project.types.ts` | `ba6eadec19abdf34c965497f792403183d427cd8193d8d5293d8b39b91612ae5` |
| `src/domains/resource-id/index.ts` | `0ba8da924c8d9d62250e0428d4acfed48b0055205d3e256808a3f6ac4d045c0b` |
| `src/domains/resource-id/public-resource-id.ts` | `6df4fbe9cc3c7c1705ab88c1fba8baea8e7daef9b3869b96dcef8ce1e547a9ca` |
| `src/domains/resource-id/screen-vs-modal.ts` | `3a4b3a3cbfba83eccd410cb08fdbe73c02c9b911effb3ff7918fdf703816ecb1` |
| `src/domains/resource-id/session-routing.ts` | `8a471af964126b08e663785fec8c260762629d673747ec8b72cec0369b963400` |
| `src/domains/rules/sagatree/character-creation/index.ts` | `9e032fe110c4665ec6744e0750d07c57a5d6b083fb292b2bd6441e21db7cdb07` |
| `src/domains/rules/sagatree/items/carry-capacity.ts` | `191e5a1a25f0b210dd95930f1e1f3455da8f1d21e1aca7dc8e16b6a6129251c8` |
| `src/domains/rules/sagatree/items/index.ts` | `ab296a0e5462aecb9c94a1e5b530a1afac2b1556d793c09eab631cad6bd62822` |
| `src/domains/rules/sagatree/items/resource-affordability.ts` | `e8fab76b8eb1441dcee849c53249158196e3aab0690185648234d610aa9fb846` |
| `src/domains/rules/sagatree/items/tool-rules.ts` | `c69170ac5b37d1e71a6c90eda6c993f14d7962d0db5f0adfe8c44568a637cf82` |
| `src/domains/rules/sagatree/items/types.ts` | `9699b169feaf183597651838ea9f8b062e205d36862e50fa824fb95f54dc233e` |
| `src/domains/rules/sagatree/items/validators.ts` | `2d523a6d4cc37de3e34d19492c687fd7056b4acb3f9aac7a026fe786034c8e5e` |
| `src/domains/rules/sagatree/skill-progression/index.ts` | `7b4f5f109d49785497b4639a154b6e3856d58e52421befa7fa0ba0a278967cb7` |
| `src/domains/rules/sagatree/species-trait-options/index.ts` | `b21687494d66c5e5b3e1b791eadf3aa1ecabb9094695768a7961bba8b36730c4` |
| `src/domains/session/contracts/session-lifecycle.ts` | `1351a7e593a24cfed6467313def0c6b2fc293adae6f8032fbb7289dce36a8260` |
| `src/infrastructure/character/character.persistence.ts` | `0952bd632d90e054913cb0b41183df82274c46f6920f28736193e0e486bea2d1` |
| `src/infrastructure/host/host-library-http.ts` | `7f909cafd35ac7fab15a90f37dd6164390fbac5b85d915618a1f46138b7d852a` |
| `src/infrastructure/host/host-project-http.ts` | `287a426fb8645638e263a7b2d612d071eec4bf054cc778193b82f6b8252a0f92` |
| `src/infrastructure/host/host-session-http.ts` | `f0e603ecf93151669c7b809cb63aea3d0a98ed2ca17ae8f2768a5444bb9cab56` |
| `src/infrastructure/inventory/host-inventory-adapter.ts` | `06530d155a9514388bc5dd9ba7272bcaee338de038799e29cdd52c745cddff05` |
| `src/infrastructure/inventory/host-inventory-ports.contract.ts` | `8debf5b89bfcf5c232ce62d1432877c7c749276dc9d40b8ed361d6d68f9f8e89` |
| `src/infrastructure/inventory/inventory-persistence.ts` | `445a8dbb746d03fbe520c6281e0e3d0b1e55543f3e1948c7fd89518fdb4e04ee` |
| `src/infrastructure/inventory/item-catalog-service.ts` | `d4dd71a5bad8a8599c7f239d6f84bce2d52f795b8ca30073f6d69a69d1bef9a5` |
| `src/infrastructure/inventory/item-catalog.persistence.ts` | `a68903ba909af8030e81d28555a65798800c9a32a790a4281e96f52b1550c566` |
| `src/infrastructure/inventory/item-model3d-service.ts` | `a742072a08bb74e82290cebb2907b0742760414fb582ddfdcb8c1a585258224c` |
| `src/infrastructure/inventory/item-thumbnail-service.ts` | `11f2e1739e43b26a2451e627c0c67101669809bc30cd0c93152c595e6054719d` |
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
| `src/infrastructure/project/project-member-service.ts` | `40fc648e091c11dcdcf4535747d9db0cd6dc5da9e475663c3ff60dff9a53e594` |
| `src/infrastructure/project/project-service.ts` | `29846df2ae25287b68cba443a9c85f2f9952fa9cc1afd3faf762a78eb57a6fa6` |
| `src/lib/asset-urls.ts` | `fe92683d4c1418a3bfa9d6fe11d1be8c68ee11eea01e9b3b5f7119f7f86006af` |
| `src/lib/authenticatedUser.ts` | `b034ac66b532232c33ec19d5427aef11b6828905ca3e3e8991f060be3e9026d6` |
| `src/lib/hostAuthBridge.ts` | `30e513fead7db706b38e29ea0e44fadb745f98d57f5949b8deebd0e788a4d23a` |
| `src/lib/localAdmin.ts` | `7ceb27ff34dffa628cb47eaa6669f3bec32cc62981f310111a3615725bb0d376` |
| `src/lib/networkTimeout.ts` | `47fd1262837db8dfbdebf1a2459e5d1f7c165430ade5afa4b0de03658af582c4` |

