# Infrastructure contract: inventory

**Status: SPEC; current branch source verified.** Implementation issue: **#802**.

Source baseline: `3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248`. **Live backend verified: false. Successor parity verified: false.** Required acceptance tests below are specifications, not executed test results. No architecture gate is approved by this contract.

Exact AST snapshot: [infra-inventory.json](source-contracts/infra-inventory.json) (SHA-256 `7bca19bc4336280727a7f0d284397338cb1062e633b3128d3924d476f1f6ef42`). The snapshot includes complete source declarations and operation expressions; no list is truncated.

## Facade behavior and authorization boundary

Persists inventory arrays on character and item-definition catalog, signs item thumbnail/model assets, handles asynchronous generation jobs.

Personal definitions owner-only; world definitions use world-profile ownership; archived mutations blocked; asset resolve follows existing owner/world policy.

The adapter establishes request/filter behavior. Server permission and rollback guarantees require the linked effective SQL/RLS contracts and backend fixtures; a source-only adapter review does not prove a live RLS policy.

## Complete backend inventory

RPCs (0): none.

Tables (5): `characters`, `inventory_item_definitions`, `project_members`, `projects`, `world_profiles`.

Storage buckets (0): none.

Edge invokes (2): `item-model3d`, `item-thumbnail`.

Realtime call sites: 0. Direct fetch sites: 0. Explicit auth/helper sites: 8.

## Complete implementation dependencies

| Kind | Contract dependency | Implementation issue | Additional policy/group |
|---|---|---|---|
| edge | `item-model3d` | #825 |  |
| edge | `item-thumbnail` | #826 |  |
| table | `characters` | #791 | Policy #792 |
| table | `inventory_item_definitions` | #791 | Policy #792 |
| table | `project_members` | #791 | Policy #792 |
| table | `projects` | #791 | Policy #792 |
| table | `world_profiles` | #791 | Policy #792 |
| auth | `authenticated account/session transport` | #793 |  |
| infra | `character` | #801 |  |
| infra | `media` | #805 |  |

## Acceptance and negative tests (required, not executed)

- Inventory add/equip/consume persistence survives reload and cross-owner updates fail.
- Definition thumbnail and model upload/generate/status/resolve/remove preserve payload.assetKey/model3d and signed URL expiry.
- Catalog list/search includes allowed standard/personal/world items without promoting client-supplied origins.

## Observed source defects and explicit successor decisions

None in the reviewed source.

## All backend calls, arguments, filters and result handling

### table: characters

`src/infrastructure/inventory/inventory-persistence.ts:138` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('characters')
      .select('updated_at, inventory_schema_version')
      .eq('id', characterId)
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/inventory/inventory-persistence.ts:124`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/inventory/inventory-persistence.ts:156` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('characters')
      .update({
        inventory_v2: bound,
        inventory_schema_version: 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', characterId)
      .eq('inventory_schema_version', 1)
      .eq('updated_at', current.updated_at as string)
      .select('id')
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/inventory/inventory-persistence.ts:124`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/inventory/inventory-persistence.ts:194` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/inventory/inventory-persistence.ts:189`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: inventory_item_definitions

`src/infrastructure/inventory/inventory-persistence.ts:202` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('inventory_item_definitions')
      .insert({
        id,
        scope: 'personal',
        world_profile_id: null,
        owner_user_id: userId,
        payload,
        status: 'active',
      })
      .select(ITEM_DEFINITION_COLUMNS)
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/inventory/inventory-persistence.ts:189`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: inventory_item_definitions

`src/infrastructure/inventory/inventory-persistence.ts:236` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from('inventory_item_definitions')
      .select('id')
      .eq('id', id)
      .maybeSingle()
```

Enclosing operation: `src/infrastructure/inventory/inventory-persistence.ts:234`; complete request/default/result/error logic is in the declarations below and the snapshot.
### edge: item-model3d

`src/infrastructure/inventory/item-model3d-service.ts:89` — literal-or-constant.

Exact call/query chain:
```ts
supabase.functions.invoke('item-model3d', { body })
```

Enclosing operation: `src/infrastructure/inventory/item-model3d-service.ts:88`; complete request/default/result/error logic is in the declarations below and the snapshot.
### edge: item-thumbnail

`src/infrastructure/inventory/item-thumbnail-service.ts:146` — literal-or-constant.

Exact call/query chain:
```ts
supabase.functions.invoke('item-thumbnail', { body })
```

Enclosing operation: `src/infrastructure/inventory/item-thumbnail-service.ts:145`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: characters

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:63` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(CHARACTERS_TABLE)
        .select('world_profile_id, project_id')
        .eq('id', characterId)
        .maybeSingle()
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:61`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: project_members

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:89` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from('project_members')
        .select('project_id')
        .eq('character_id', characterId)
        .eq('status', 'active')
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:61`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: projects

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:108` — literal-or-constant.

Exact call/query chain:
```ts
supabase
          .from(PROJECTS_TABLE)
          .select('id, world_profile_id')
          .in('id', projectIds)
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:61`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:141` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:140`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: inventory_item_definitions

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:143` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(DEFINITIONS_TABLE).select(ITEM_DEFINITION_COLUMNS)
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:140`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: world_profiles

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:181` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from('world_profiles')
        .select('modules')
        .eq('id', id)
        .maybeSingle()
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:176`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:204` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:203`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: inventory_item_definitions

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:207` — literal-or-constant.

Exact call/query chain:
```ts
supabase.from(DEFINITIONS_TABLE).select(ITEM_DEFINITION_COLUMNS)
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:203`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:222` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:221`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:239` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:235`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:260` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:258`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: inventory_item_definitions

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:278` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(DEFINITIONS_TABLE)
      .update({ payload })
      .eq('id', definitionId)
      .eq('scope', scope)
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:258`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:312` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:307`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: inventory_item_definitions

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:327` — literal-or-constant.

Exact call/query chain:
```ts
supabase
      .from(DEFINITIONS_TABLE)
      .update({ status })
      .eq('id', definitionId)
      .eq('scope', scope)
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:307`; complete request/default/result/error logic is in the declarations below and the snapshot.
### auth-helper: session identity

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:359` — dynamic-expression.

Exact call/query chain:
```ts
getAuthenticatedUserId()
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:354`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: inventory_item_definitions

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:412` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(DEFINITIONS_TABLE)
        .select(ITEM_DEFINITION_COLUMNS)
        .eq('id', definitionId)
        .maybeSingle()
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:410`; complete request/default/result/error logic is in the declarations below and the snapshot.
### table: inventory_item_definitions

`src/infrastructure/inventory/supabase-item-catalog.repository.ts:437` — literal-or-constant.

Exact call/query chain:
```ts
supabase
        .from(DEFINITIONS_TABLE)
        .insert({
          id,
          scope,
          world_profile_id: worldProfileId,
          // Derived from the authenticated session, never from client input.
          owner_user_id: ownerUserId,
          payload,
          status: 'active',
        })
        .select(ITEM_DEFINITION_COLUMNS)
        .maybeSingle()
```

Enclosing operation: `src/infrastructure/inventory/supabase-item-catalog.repository.ts:427`; complete request/default/result/error logic is in the declarations below and the snapshot.

## Complete public declarations and facade operation contracts

### src/infrastructure/inventory/inventory-persistence.ts:38

```ts
export interface CharacterInventoryRead {
  state: InventoryState;
  /** True when the persisted version marker is 2 and the payload validated. */
  authoritativeV2: boolean;
  /** Set when the reader fell back to legacy ItemDto[] (migrate in memory only). */
  legacyFallback: boolean;
}
```

### src/infrastructure/inventory/inventory-persistence.ts:51

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

### src/infrastructure/inventory/inventory-persistence.ts:82

```ts
export async function assertWritableInventoryV2(
  state: unknown,
  characterId: string | null,
): Promise<InventoryState> {
  if (!isInventoryV2State(state)) {
    throw new Error('Ungültiges Inventar v2 — Speichern abgebrochen.');
  }

  const definitionIds = new Set(
    Object.values(state.instances).map((instance) => instance.definitionId),
  );
  if (definitionIds.size === 0) return state;

  const worldProfileId = characterId
    ? await supabaseItemCatalogRepository.resolveEffectiveWorldProfileId(characterId)
    : null;
  const catalog = await supabaseItemCatalogRepository.listCatalogRecords(worldProfileId);
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

### src/infrastructure/inventory/inventory-persistence.ts:124

```ts
export async function persistMigratedInventory(
  characterId: string,
  migration: LegacyMigrationResult,
): Promise<InventoryState> {
  const fingerprintToId = new Map<string, string>();

  for (const draft of migration.personalDrafts) {
    const stableId = await ensurePersonalDefinition(draft);
    fingerprintToId.set(draft.fingerprint, stableId);
  }

  const bound = bindPendingDefinitions(migration.state, fingerprintToId);

  const { data: current, error: readError } = await raceWithTimeoutReject(
    supabase
      .from('characters')
      .select('updated_at, inventory_schema_version')
      .eq('id', characterId)
      .maybeSingle(),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Charakter konnte nicht für die Inventar-Migration geladen werden (Zeitüberschreitung).',
  );
  if (readError) {
    throw new Error(`Inventar-Migration konnte den Charakter nicht laden: ${readError.message}`);
  }
  if (!current || current.inventory_schema_version !== 1) {
    throw new Error(
      'Inventar-Migration kollidierte mit einer anderen Speicherung. Bitte erneut versuchen.',
    );
  }

  const { data, error } = await raceWithTimeoutReject(
    supabase
      .from('characters')
      .update({
        inventory_v2: bound,
        inventory_schema_version: 2,
        updated_at: new Date().toISOString(),
      })
      .eq('id', characterId)
      .eq('inventory_schema_version', 1)
      .eq('updated_at', current.updated_at as string)
      .select('id')
      .maybeSingle(),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Inventar v2 konnte nicht gespeichert werden (Zeitüberschreitung).',
  );

  if (error) {
    throw new Error(`Inventar v2 konnte nicht gespeichert werden: ${error.message}`);
  }
  if (!data) {
    throw new Error(
      'Inventar-Migration kollidierte mit einer anderen Speicherung. Bitte erneut versuchen.',
    );
  }

  return bound;
}
```

### src/infrastructure/inventory/inventory-persistence.ts:249

```ts
export function migrationDefinitionId(fingerprint: string): string {
  return `personal:mig-${fnv1aHex(fingerprint, 32)}`;
}
```

### src/infrastructure/inventory/item-catalog-service.ts:49

```ts
export interface CharacterItemCatalog {
  effectiveWorldProfileId: string | null;
  /** Active definitions offered by Add/Catalog surfaces, already ordered. */
  addable: ItemDefinition[];
  /** Resolves owned instances, including archived definitions. */
  lookup: ItemDefinitionLookup;
  /** Raw records, for callers that need status or ownership. */
  records: CatalogDefinitionRecord[];
}
```

### src/infrastructure/inventory/item-catalog-service.ts:60

```ts
export interface LibraryItemCatalog {
  /** Active definitions visible in the Library Items tab, already ordered. */
  definitions: ItemDefinition[];
  /** Raw persisted records (Personal/World), including archived. */
  persistedRecords: CatalogDefinitionRecord[];
}
```

### src/infrastructure/inventory/item-catalog-service.ts:75

```ts
export async function loadCharacterItemCatalog(
  characterId: string | null,
  userId: string,
): Promise<CharacterItemCatalog> {
  const effectiveWorldProfileId = characterId
    ? await supabaseItemCatalogRepository.resolveEffectiveWorldProfileId(characterId)
    : null;
  const records = await supabaseItemCatalogRepository.listCatalogRecords(effectiveWorldProfileId);
  const context = { userId, effectiveWorldProfileId };

  const modules = effectiveWorldProfileId
    ? await supabaseItemCatalogRepository.loadWorldProfileModules(effectiveWorldProfileId)
    : null;
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

### src/infrastructure/inventory/item-catalog-service.ts:143

```ts
export async function loadLibraryItemCatalog(): Promise<LibraryItemCatalog> {
  const persistedRecords = await supabaseItemCatalogRepository.listLibraryPersistedRecords();
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

### src/infrastructure/inventory/item-catalog-service.ts:170

```ts
export async function loadWorldProfileItemCatalog(
  worldProfileId: string,
): Promise<CatalogDefinitionRecord[]> {
  const records = await supabaseItemCatalogRepository.listCatalogRecords(worldProfileId);
  return records.filter(
    (r) => r.definition.scope === 'world' && r.worldProfileId === worldProfileId,
  );
}
```

### src/infrastructure/inventory/item-catalog-service.ts:183

```ts
export async function getItemDefinitionById(definitionId: string): Promise<{
  definition: ItemDefinition;
  record: CatalogDefinitionRecord | null;
} | null> {
  return supabaseItemCatalogRepository.getDefinitionById(definitionId);
}
```

### src/infrastructure/inventory/item-catalog-service.ts:190

```ts
export function createPersonalDefinition(draft: ItemDefinitionDraft): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.createPersonalDefinition(draft);
}
```

### src/infrastructure/inventory/item-catalog-service.ts:194

```ts
export function createWorldDefinition(
  worldProfileId: string,
  draft: ItemDefinitionDraft,
): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.createWorldDefinition(worldProfileId, draft);
}
```

### src/infrastructure/inventory/item-catalog-service.ts:201

```ts
export function updateDefinition(
  definitionId: string,
  draft: ItemDefinitionDraft,
): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.updateDefinition(definitionId, draft);
}
```

### src/infrastructure/inventory/item-catalog-service.ts:209

```ts
export function archiveDefinition(definitionId: string): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.setDefinitionStatus(definitionId, 'archived');
}
```

### src/infrastructure/inventory/item-catalog-service.ts:213

```ts
export function restoreDefinition(definitionId: string): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.setDefinitionStatus(definitionId, 'active');
}
```

### src/infrastructure/inventory/item-catalog-service.ts:221

```ts
export function forkDefinition(
  sourceDefinitionId: string,
  target: ForkDefinitionTarget,
): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.forkDefinition(sourceDefinitionId, target);
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

### src/infrastructure/inventory/item-model3d-service.ts:16

```ts
export type ItemModel3dJobUiStatus =
  | 'idle'
  | 'waiting'
  | 'generating'
  | 'succeeded'
  | 'failed'
  | 'canceled';
```

### src/infrastructure/inventory/item-model3d-service.ts:24

```ts
export interface ItemModel3dConfig {
  meshyConfigured: boolean;
  maxBytes: number;
  allowedMime: readonly string[];
}
```

### src/infrastructure/inventory/item-model3d-service.ts:30

```ts
export interface ItemModel3dUploadResult {
  model3d: string;
  signedUrl: string;
  mime: ItemModel3dMime;
  byteSize: number;
}
```

### src/infrastructure/inventory/item-model3d-service.ts:37

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

### src/infrastructure/inventory/item-model3d-service.ts:119

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

### src/infrastructure/inventory/item-model3d-service.ts:263

```ts
export const itemModel3dService = new ItemModel3dService();
```

### src/infrastructure/inventory/item-thumbnail-service.ts:15

```ts
export type PrepareItemThumbnailOptions = {
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};
```

### src/infrastructure/inventory/item-thumbnail-service.ts:24

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

### src/infrastructure/inventory/item-thumbnail-service.ts:77

```ts
export type ItemThumbnailJobUiStatus =
  | 'idle'
  | 'waiting'
  | 'generating'
  | 'succeeded'
  | 'failed'
  | 'canceled';
```

### src/infrastructure/inventory/item-thumbnail-service.ts:85

```ts
export interface ItemThumbnailConfig {
  meshyConfigured: boolean;
  maxBytes: number;
  allowedMime: readonly string[];
}
```

### src/infrastructure/inventory/item-thumbnail-service.ts:91

```ts
export interface ItemThumbnailUploadResult {
  assetKey: string;
  signedUrl: string;
  mime: ItemThumbnailMime;
  byteSize: number;
}
```

### src/infrastructure/inventory/item-thumbnail-service.ts:98

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

### src/infrastructure/inventory/item-thumbnail-service.ts:171

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

### src/infrastructure/inventory/item-thumbnail-service.ts:318

```ts
export const itemThumbnailService = new ItemThumbnailService();
```

### src/infrastructure/inventory/supabase-item-catalog.repository.ts:46

```ts
export interface ItemDefinitionDraft extends ItemDefinitionWriteDraft {}
```

### src/infrastructure/inventory/supabase-item-catalog.repository.ts:49

```ts
export type ForkDefinitionTarget =
  | { scope: 'personal' }
  | { scope: 'world'; worldProfileId: string };
```

### src/infrastructure/inventory/supabase-item-catalog.repository.ts:53

```ts
export class SupabaseItemCatalogRepository {
  /**
   * Effective world profile for a character.
   *
   * `adventureWorldProfileId ?? characterWorldProfileId ?? null`. The precedence
   * itself is the domain rule in `resolveEffectiveWorldProfileId` — this method
   * only supplies the two bindings.
   */
  async resolveEffectiveWorldProfileId(characterId: string): Promise<string | null> {
    const { data, error } = await raceWithTimeoutReject(
      supabase
        .from(CHARACTERS_TABLE)
        .select('world_profile_id, project_id')
        .eq('id', characterId)
        .maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Weltprofil konnte nicht aufgelöst werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Failed to resolve world profile for character: ${error.message}`);
    }
    if (!data) return null;

    const characterWorldProfileId = typeof data.world_profile_id === 'string' ? data.world_profile_id : null;

    // Adventure binding: characters.project_id is optional and often unset for
    // players — join_project_by_code / set_my_project_character only write
    // project_members.character_id. Active memberships are therefore the
    // authoritative adventure context, with characters.project_id preferred
    // when present (first in the candidate list).
    const projectIds: string[] = [];
    if (typeof data.project_id === 'string' && data.project_id) {
      projectIds.push(data.project_id);
    }

    const { data: memberships, error: membershipError } = await raceWithTimeoutReject(
      supabase
        .from('project_members')
        .select('project_id')
        .eq('character_id', characterId)
        .eq('status', 'active'),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Abenteuer-Mitgliedschaft konnte nicht aufgelöst werden (Zeitüberschreitung).',
    );
    if (membershipError) {
      throw new Error(`Failed to resolve adventure memberships: ${membershipError.message}`);
    }
    for (const membership of memberships ?? []) {
      const projectId = typeof membership.project_id === 'string' ? membership.project_id : null;
      if (projectId && !projectIds.includes(projectId)) projectIds.push(projectId);
    }

    let adventureWorldProfileId: string | null = null;
    if (projectIds.length > 0) {
      const { data: projects, error: projectError } = await raceWithTimeoutReject(
        supabase
          .from(PROJECTS_TABLE)
          .select('id, world_profile_id')
          .in('id', projectIds),
        SUPABASE_QUERY_TIMEOUT_MS,
        'Abenteuer-Weltprofil konnte nicht aufgelöst werden (Zeitüberschreitung).',
      );
      if (projectError) {
        throw new Error(`Failed to resolve world profile for adventure: ${projectError.message}`);
      }
      const byId = new Map(
        (projects ?? []).map((project) => [project.id as string, project.world_profile_id as string | null]),
      );
      for (const projectId of projectIds) {
        const worldProfileId = byId.get(projectId);
        if (typeof worldProfileId === 'string' && worldProfileId) {
          adventureWorldProfileId = worldProfileId;
          break;
        }
      }
    }

    return resolveEffectiveWorldProfileId({ adventureWorldProfileId, characterWorldProfileId });
  }

  /**
   * Every catalog record the signed-in user may see for this world profile:
   * Core from the repository, plus the World and Personal rows RLS returns.
   *
   * Includes archived rows so owned instances stay resolvable; callers that
   * render an Add catalog filter them out via `selectCatalogDefinitions`.
   */
  async listCatalogRecords(effectiveWorldProfileId: string | null): Promise<CatalogDefinitionRecord[]> {
    const userId = await getAuthenticatedUserId();

    let query = supabase.from(DEFINITIONS_TABLE).select(ITEM_DEFINITION_COLUMNS);
    if (effectiveWorldProfileId) {
      // `.or()` takes a raw PostgREST filter string, so both ids are checked
      // against the UUID shape before they are interpolated into it.
      query = query.or(
        `and(scope.eq.personal,owner_user_id.eq.${assertUuid(userId, 'Benutzer')}),` +
          `and(scope.eq.world,world_profile_id.eq.${assertUuid(effectiveWorldProfileId, 'Weltprofil')})`,
      );
    } else {
      query = query.eq('scope', 'personal').eq('owner_user_id', userId);
    }

    const { data, error } = await raceWithTimeoutReject(
      query,
      SUPABASE_QUERY_TIMEOUT_MS,
      'Gegenstandskatalog konnte nicht geladen werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Failed to load item definitions: ${error.message}`);
    }

    const persisted = ((data ?? []) as ItemDefinitionDto[])
      .map(mapDefinitionRow)
      .filter((record): record is CatalogDefinitionRecord => record !== null);

    return [...coreCatalogRecords(), ...persisted];
  }

  /**
   * Read `world_profiles.modules` for the effective world (#143).
   * Returns null when the row is missing or RLS denies read — callers apply
   * `item-catalog` module defaults (prior Core+World+Personal semantics).
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
    if (!data || typeof data.modules !== 'object' || data.modules === null || Array.isArray(data.modules)) {
      return null;
    }
    return data.modules as Record<string, unknown>;
  }

  /**
   * Library Items browser (#138): Personal + all World definitions RLS already
   * allows (no character effective-world narrowing). Core/builtin stay local.
   * Includes archived rows; UI filters to active.
   */
  async listLibraryPersistedRecords(): Promise<CatalogDefinitionRecord[]> {
    await getAuthenticatedUserId();

    const { data, error } = await raceWithTimeoutReject(
      supabase.from(DEFINITIONS_TABLE).select(ITEM_DEFINITION_COLUMNS),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Gegenstandskatalog konnte nicht geladen werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Failed to load library item definitions: ${error.message}`);
    }

    return ((data ?? []) as ItemDefinitionDto[])
      .map(mapDefinitionRow)
      .filter((record): record is CatalogDefinitionRecord => record !== null);
  }

  /** Create a Personal definition owned by the authenticated user. */
  async createPersonalDefinition(draft: ItemDefinitionDraft): Promise<CatalogDefinitionRecord> {
    const userId = await getAuthenticatedUserId();
    const context: CatalogMutationContext = { userId, editableWorldProfileIds: [] };
    if (!canCreateDefinition('personal', context)) {
      throw new Error('Persönliche Definition nicht erlaubt.');
    }
    return this.insertDefinition('personal', draft, userId, null);
  }

  /**
   * Create a World definition. Authorization is the world profile's own edit
   * rule, enforced by RLS via `current_user_can_edit_world_profile`.
   * `worldProfileId` comes from trusted caller context, never from the draft.
   */
  async createWorldDefinition(
    worldProfileId: string,
    draft: ItemDefinitionDraft,
  ): Promise<CatalogDefinitionRecord> {
    const userId = await getAuthenticatedUserId();
    if (!worldProfileId) {
      throw new Error('Eine Welt-Definition benötigt ein Weltprofil.');
    }
    const context: CatalogMutationContext = {
      userId,
      editableWorldProfileIds: [worldProfileId],
    };
    if (!canCreateDefinition('world', context, worldProfileId)) {
      throw new Error('Welt-Definition nicht erlaubt.');
    }
    return this.insertDefinition('world', draft, userId, worldProfileId);
  }

  /**
   * Update a definition's payload. Id, scope and ownership are immutable — the
   * database triggers reject any attempt to change them, so a rename can never
   * strand an owned instance. Cross-owner / Core writes fail closed.
   */
  async updateDefinition(definitionId: string, draft: ItemDefinitionDraft): Promise<CatalogDefinitionRecord> {
    assertPersistedMutableId(definitionId);
    const userId = await getAuthenticatedUserId();
    const existing = await this.loadPersistedRecord(definitionId);
    if (!existing) {
      throw new Error('Definition konnte nicht gespeichert werden.');
    }

    if (existing.definition.scope === 'personal') {
      if (!canMutateDefinition(existing, { userId, editableWorldProfileIds: [] })) {
        throw new Error('Definition konnte nicht gespeichert werden.');
      }
    } else if (existing.definition.scope !== 'world' || !existing.worldProfileId) {
      // World edit authority remains RLS (`current_user_can_edit_world_profile`).
      throw new Error('Definition konnte nicht gespeichert werden.');
    }

    const scope = scopeOfId(definitionId);
    const payload = assertWritablePayload(definitionId, scope, draft);

    let query = supabase
      .from(DEFINITIONS_TABLE)
      .update({ payload })
      .eq('id', definitionId)
      .eq('scope', scope);

    // Defense in depth: Personal updates must match the session owner even if
    // RLS were misconfigured. World writes bind the known world_profile_id.
    if (scope === 'personal') {
      query = query.eq('owner_user_id', userId);
    } else {
      query = query.eq('world_profile_id', assertUuid(existing.worldProfileId as string, 'Weltprofil'));
    }

    const { data, error } = await raceWithTimeoutReject(
      query.select(ITEM_DEFINITION_COLUMNS).maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Definition konnte nicht gespeichert werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Failed to update item definition: ${error.message}`);
    }
    return requireRecord(data as ItemDefinitionDto | null, 'Definition konnte nicht gespeichert werden.');
  }

  /**
   * Archive or restore a definition. Archiving is the only removal path — there
   * is no DELETE policy on the table, so owned instances always keep resolving.
   */
  async setDefinitionStatus(
    definitionId: string,
    status: 'active' | 'archived',
  ): Promise<CatalogDefinitionRecord> {
    assertPersistedMutableId(definitionId);
    const userId = await getAuthenticatedUserId();
    const existing = await this.loadPersistedRecord(definitionId);
    if (!existing) {
      throw new Error('Definition konnte nicht geändert werden.');
    }
    if (existing.definition.scope === 'personal') {
      if (!canMutateDefinition(existing, { userId, editableWorldProfileIds: [] })) {
        throw new Error('Definition konnte nicht geändert werden.');
      }
    } else if (existing.definition.scope !== 'world' || !existing.worldProfileId) {
      throw new Error('Definition konnte nicht geändert werden.');
    }

    const scope = scopeOfId(definitionId);

    let query = supabase
      .from(DEFINITIONS_TABLE)
      .update({ status })
      .eq('id', definitionId)
      .eq('scope', scope);

    if (scope === 'personal') {
      query = query.eq('owner_user_id', userId);
    } else {
      query = query.eq('world_profile_id', assertUuid(existing.worldProfileId as string, 'Weltprofil'));
    }

    const { data, error } = await raceWithTimeoutReject(
      query.select(ITEM_DEFINITION_COLUMNS).maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Status konnte nicht geändert werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Failed to change item definition status: ${error.message}`);
    }
    return requireRecord(data as ItemDefinitionDto | null, 'Definition konnte nicht geändert werden.');
  }

  /**
   * Fork any readable source (Core/World/Personal) into a new Personal or World
   * definition. Always allocates a new id; never overwrites the source.
   */
  async forkDefinition(
    sourceDefinitionId: string,
    target: ForkDefinitionTarget,
  ): Promise<CatalogDefinitionRecord> {
    // Ensure session before resolving source (RLS + owner derivation).
    await getAuthenticatedUserId();
    const source = await this.resolveForkSource(sourceDefinitionId);
    if (!source) {
      throw new Error('Quell-Definition wurde nicht gefunden.');
    }

    if (target.scope === 'personal') {
      const draft = buildForkedItemDefinitionDraft(source, 'personal');
      return this.createPersonalDefinition(draft);
    }

    const worldProfileId = target.worldProfileId;
    if (!worldProfileId) {
      throw new Error('Eine Welt-Definition benötigt ein Weltprofil.');
    }
    const draft = buildForkedItemDefinitionDraft(source, 'world');
    return this.createWorldDefinition(worldProfileId, draft);
  }

  /**
   * Resolve any readable definition by id for Workbench load / fork (#139).
   * Core and builtin-standard are local; Personal/World go through RLS.
   */
  async getDefinitionById(definitionId: string): Promise<{
    definition: ItemDefinition;
    record: CatalogDefinitionRecord | null;
  } | null> {
    const trimmed = definitionId.trim();
    if (!trimmed) return null;

    const core = getCoreItemDefinition(trimmed);
    if (core) {
      return { definition: core, record: null };
    }

    const builtin = getBuiltinStandardDefinition(trimmed);
    if (builtin) {
      return { definition: builtin, record: null };
    }

    const record = await this.loadPersistedRecord(trimmed);
    if (!record) return null;
    return { definition: record.definition, record };
  }

  private async resolveForkSource(sourceDefinitionId: string): Promise<ItemDefinition | null> {
    const resolved = await this.getDefinitionById(sourceDefinitionId);
    return resolved?.definition ?? null;
  }

  /** Load one persisted row; RLS decides visibility. Returns null when absent. */
  private async loadPersistedRecord(definitionId: string): Promise<CatalogDefinitionRecord | null> {
    const { data, error } = await raceWithTimeoutReject(
      supabase
        .from(DEFINITIONS_TABLE)
        .select(ITEM_DEFINITION_COLUMNS)
        .eq('id', definitionId)
        .maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Definition konnte nicht geladen werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Failed to load item definition: ${error.message}`);
    }
    if (!data) return null;
    return mapDefinitionRow(data as ItemDefinitionDto);
  }

  private async insertDefinition(
    scope: PersistedDefinitionScope,
    draft: ItemDefinitionDraft,
    ownerUserId: string,
    worldProfileId: string | null,
  ): Promise<CatalogDefinitionRecord> {
    const id = `${scope}:${crypto.randomUUID()}`;
    const payload = assertWritablePayload(id, scope, draft);

    const { data, error } = await raceWithTimeoutReject(
      supabase
        .from(DEFINITIONS_TABLE)
        .insert({
          id,
          scope,
          world_profile_id: worldProfileId,
          // Derived from the authenticated session, never from client input.
          owner_user_id: ownerUserId,
          payload,
          status: 'active',
        })
        .select(ITEM_DEFINITION_COLUMNS)
        .maybeSingle(),
      SUPABASE_QUERY_TIMEOUT_MS,
      'Definition konnte nicht angelegt werden (Zeitüberschreitung).',
    );
    if (error) {
      throw new Error(`Failed to create item definition: ${error.message}`);
    }
    return requireRecord(data as ItemDefinitionDto | null, 'Definition konnte nicht angelegt werden.');
  }
}
```

### src/infrastructure/inventory/supabase-item-catalog.repository.ts:514

```ts
export const supabaseItemCatalogRepository = new SupabaseItemCatalogRepository();
```


## Remaining backend helper operations

### src/infrastructure/inventory/inventory-persistence.ts:189

```ts
async function ensurePersonalDefinition(draft: MigratedPersonalDefinitionDraft): Promise<string> {
  const id = migrationDefinitionId(draft.fingerprint);
  const existing = await fetchDefinitionById(id);
  if (existing) return existing;

  const userId = await getAuthenticatedUserId();
  const payload = toDefinitionPayload({
    ...toItemDefinitionDraft(draft),
    id,
    scope: 'personal',
  });

  const { data, error } = await raceWithTimeoutReject(
    supabase
      .from('inventory_item_definitions')
      .insert({
        id,
        scope: 'personal',
        world_profile_id: null,
        owner_user_id: userId,
        payload,
        status: 'active',
      })
      .select(ITEM_DEFINITION_COLUMNS)
      .maybeSingle(),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Persönliche Definition konnte nicht angelegt werden (Zeitüberschreitung).',
  );

  if (error) {
    // Unique violation / race: another retry created it — read it back.
    const raced = await fetchDefinitionById(id);
    if (raced) return raced;
    throw new Error(`Failed to create item definition: ${error.message}`);
  }
  if (!data) {
    const raced = await fetchDefinitionById(id);
    if (raced) return raced;
    throw new Error('Definition konnte nicht angelegt werden.');
  }
  const record = mapDefinitionRow(data as ItemDefinitionDto);
  if (!record) throw new Error('Definition konnte nicht angelegt werden.');
  return record.definition.id;
}
```

### src/infrastructure/inventory/inventory-persistence.ts:234

```ts
async function fetchDefinitionById(id: string): Promise<string | null> {
  const { data, error } = await raceWithTimeoutReject(
    supabase
      .from('inventory_item_definitions')
      .select('id')
      .eq('id', id)
      .maybeSingle(),
    SUPABASE_QUERY_TIMEOUT_MS,
    'Definition konnte nicht geladen werden (Zeitüberschreitung).',
  );
  if (error) throw new Error(`Failed to load item definition: ${error.message}`);
  return typeof data?.id === 'string' ? data.id : null;
}
```

### src/infrastructure/inventory/item-model3d-service.ts:88

```ts
async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  const { data, error } = await supabase.functions.invoke('item-model3d', { body });
  if (error) {
    const serverMessage = await getFunctionErrorMessage(error);
    throw new Error(serverMessage ?? '3D-Modell-Dienst nicht erreichbar.');
  }
  return parseResponse(data);
}
```

### src/infrastructure/inventory/item-thumbnail-service.ts:145

```ts
async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  const { data, error } = await supabase.functions.invoke('item-thumbnail', { body });
  if (error) {
    const serverMessage = await getFunctionErrorMessage(error);
    throw new Error(serverMessage ?? 'Thumbnail-Dienst nicht erreichbar.');
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
| `src/domains/character/inventory-v2/migrate-legacy.ts` | `25dbe6979d3f16380078fcedfbe9dc132a93bfece2474b868181a636189bf11c` |
| `src/domains/character/inventory-v2/operations.ts` | `a2e704b8a6c9d0f734d0c2f8db4fd5fcd7f419ddf2468ad7ac210d5c4d5c62d9` |
| `src/domains/character/inventory-v2/primitives.ts` | `7fd8dd5bddc63580ede1b8e0d6c89c146531ba7751128b664bf731c405343c86` |
| `src/domains/character/inventory-v2/state.ts` | `c78ffa8a34d754fcfa444f587d1ae8457b1cfbbbea8d80e205f5b964b05de775` |
| `src/domains/character/inventory-v2/types.ts` | `ac4780f56499b209346e1be76ed06c1a81bbbc78843ff5d74a9bd96f83fc8643` |
| `src/domains/character/inventory-v2/validation.ts` | `d893ca4d051be6075a44e42b6be1bba2d72366bdac267b5625b723a39318609f` |
| `src/domains/items/assets.ts` | `531258cd09a5e29affafb2d52d7154400cd17a19a7e4a0e1f05dffa26461ae24` |
| `src/domains/items/definition.ts` | `e47891149c62504d1ff96fb38e6a86ca26bf2e9a52795b7cd876a66b90c78b4a` |
| `src/domains/items/fork.ts` | `6123d90663a24b1af0dd583a601cb491799137ef4ae894b0e2bf3d5643fb8b76` |
| `src/domains/items/icon-assets.ts` | `afa9813b79e9cbd36e56c0ab1b378a07e055f531cac8091ccdb93f45230c0079` |
| `src/domains/items/index.ts` | `f0bf801bd99a13014598868bcd1def1c03e1a2dcab208f5b7fdb0d8b9bd89b48` |
| `src/domains/items/library-query.ts` | `513d0d38b0531a58c25f9f680f4887f6e667d0594fa2c05bb4908179b34d8f83` |
| `src/domains/items/model3d-assets.ts` | `389043b61b7b9cea94ccc7e2c14a871b6e755d3bf428a205b3a3a278fe5fef2c` |
| `src/domains/items/normalize.ts` | `4b26c5ec71b9c3c2d1186004b6a4e7d1d09a48e078447e7b8815d2e5bf908909` |
| `src/domains/items/pack.ts` | `3214e2a3cbe1db088fb0eaca3d52503911f3c3601c6b01ed08bb75ef2707d975` |
| `src/domains/items/packs/build-standard-item.ts` | `1c2654f0e7980b409762995fe9025649f9cc2bd5324df3a6d50dd4642bdfe569` |
| `src/domains/items/packs/contemporary-basic.ts` | `c72535324491133bc1331abd5fb050d6c328f2177976b8d76f39b2438118f1c1` |
| `src/domains/items/packs/context-packs.ts` | `768e1cf834ea03ecb0b6b3e2335da8e4356682da34bf045df5ba18a1dd9df6fb` |
| `src/domains/items/packs/core-snapshots.ts` | `440e4fe239eedb982555c2e4aa82ea45ae3d687cb26e057516c1b36feccbc19e` |
| `src/domains/items/packs/fantasy-basic.ts` | `0d18e6a46d5d0603b66eade2eaa92f56a0531ad0e71dc1361bfca6cb4f507c2a` |
| `src/domains/items/packs/index.ts` | `d851952181c448d93ac61a51e2f4d02d89253447ef74ca93ff1048590bfff43d` |
| `src/domains/items/packs/scifi-basic.ts` | `6bfed5584dfaabcbc1ce6c323ebd6d9ababc286e9a94d77106c8355667379333` |
| `src/domains/items/payload.ts` | `cca377861fecbee054a248d6df16baa630a1cedc496fac0fd34b0dc58e575efc` |
| `src/domains/items/taxonomy.ts` | `fa58dde95e4f9fa424244137f845ee4dbf8ae77d3e4e3ec1d114b74b1debc54a` |
| `src/domains/items/validate.ts` | `3ad0170cce5d6cd27889eecf9752c707c19680e28ccdf493d71851bffbab4524` |
| `src/domains/items/world-catalog.ts` | `fc39966cc6290f6c59bfdef799cd9e972e7799978299b8fe83a6a8b4b1162941` |
| `src/domains/media/index.ts` | `768ded2d0f0fd1d510d660924e787817673955dbeff021d7de9e0a8d8e38bdec` |
| `src/domains/media/optimization-contract.ts` | `ba9216dab79a9c03f66a16b77dedf1c26d4d00d6ae2693cc5a68919d1647846d` |
| `src/domains/media/optimization-policy.ts` | `6145574bc08d1eb94f54d488ebc1f8bc030c2a956e3e3fd24cb15a7c8e50c5ec` |
| `src/domains/resource-id/index.ts` | `0ba8da924c8d9d62250e0428d4acfed48b0055205d3e256808a3f6ac4d045c0b` |
| `src/domains/resource-id/public-resource-id.ts` | `6df4fbe9cc3c7c1705ab88c1fba8baea8e7daef9b3869b96dcef8ce1e547a9ca` |
| `src/domains/resource-id/screen-vs-modal.ts` | `3a4b3a3cbfba83eccd410cb08fdbe73c02c9b911effb3ff7918fdf703816ecb1` |
| `src/domains/resource-id/session-routing.ts` | `8a471af964126b08e663785fec8c260762629d673747ec8b72cec0369b963400` |
| `src/domains/rules/sagatree/character-creation/index.ts` | `9e032fe110c4665ec6744e0750d07c57a5d6b083fb292b2bd6441e21db7cdb07` |
| `src/domains/rules/sagatree/items/carry-capacity.ts` | `1ea1910d07cbfcbbe5373a78a9256e79a746273f16a3c2e2e82693f1a17037df` |
| `src/domains/rules/sagatree/items/index.ts` | `ab296a0e5462aecb9c94a1e5b530a1afac2b1556d793c09eab631cad6bd62822` |
| `src/domains/rules/sagatree/items/resource-affordability.ts` | `ed42c8faa66a711bd8c7be240df38530bb2d02fff435d1f3aa200538f9388a09` |
| `src/domains/rules/sagatree/items/tool-rules.ts` | `3026c3797388370309b0ea33d1366969abc05b803654cf99c68c4eff42832f18` |
| `src/domains/rules/sagatree/items/types.ts` | `af76e6a5ebcec4a5e8acc3d3fd6461abfe083065c025080ef0b2ca851fdc6ff2` |
| `src/domains/rules/sagatree/items/validators.ts` | `257732bceab776a0afc34f01340eb7e47a94b5c9d984ebf3fff8e0bb7c8ff543` |
| `src/domains/rules/sagatree/skill-progression/index.ts` | `7b4f5f109d49785497b4639a154b6e3856d58e52421befa7fa0ba0a278967cb7` |
| `src/domains/rules/sagatree/species-trait-options/index.ts` | `b21687494d66c5e5b3e1b791eadf3aa1ecabb9094695768a7961bba8b36730c4` |
| `src/infrastructure/character/character.persistence.ts` | `5ed5f363555b9c4a3922507e01a227f74aee706764065641eb27ac9510024bd5` |
| `src/infrastructure/inventory/inventory-persistence.ts` | `79aaa09053ecd72a0bec8f8f0610b31ab0c9b34779f4a4c87f19f0d2ef7e4ac2` |
| `src/infrastructure/inventory/item-catalog-service.ts` | `f016e6e0f08fcf78532a97df16224280f8e052fa6870744e41a7002d9fd0f723` |
| `src/infrastructure/inventory/item-catalog.persistence.ts` | `a68903ba909af8030e81d28555a65798800c9a32a790a4281e96f52b1550c566` |
| `src/infrastructure/inventory/item-model3d-service.ts` | `c2ab599cea52e8ba923fc12c71129d38801dc00027064c5fe72aa2ceffafff55` |
| `src/infrastructure/inventory/item-thumbnail-service.ts` | `907b1f5589d6063b804727b636cd74e53507dbdc4578adde805738fac4be4b78` |
| `src/infrastructure/inventory/supabase-item-catalog.repository.ts` | `1ea1b14afc3d01c117c13e96af516a8cc0a315edfb170a6f1f11c6903ab366eb` |
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
| `src/lib/authenticatedUser.ts` | `c822140996ae4d318c19d2ccb5318d77f2ba4d302bdfbcb50a79420a7ef70d74` |
| `src/lib/localAdmin.ts` | `3a28dec23e85f25ed3e70682bc6e7f8c6b55e81dbbefdd1f6a837f68ac80d6b5` |
| `src/lib/networkTimeout.ts` | `835466d4cd28abcdd579116b13a14e23b50f7308cd1e9aedf114d851f6aef851` |
| `src/lib/supabase.ts` | `a3c450dc37e82e1fede9d188520d0d3414aa67ec6d5521c6f124af1a8b04898f` |

