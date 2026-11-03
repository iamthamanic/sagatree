/**
 * item-catalog-service — application-facing facade for the Inventory v2 catalog
 * (#107 / #136 / #138 / #143). This is the boundary the character UI and Library
 * Items browser consume; app slices must not query `inventory_item_definitions`
 * themselves. Lifecycle ops adapt the `domains/items` write/fork API onto the
 * existing catalog table. Character add-catalog composes via world item-catalog
 * resolver; Library browse stays an independent global catalog.
 * Location: src/infrastructure/inventory/item-catalog-service.ts
 */
import {
  createDefinitionLookup,
  getCoreItemDefinition,
  isDefinitionVisible,
  listCoreItemDefinitions,
} from '../../domains/character/inventory-v2';
import type {
  CatalogDefinitionRecord,
  ItemDefinition,
  ItemDefinitionLookup,
} from '../../domains/character/inventory-v2';
import {
  compareLibraryItemDefinitions,
  composeCharacterInventoryAddCatalog,
  getBuiltinStandardDefinition,
  getItemCatalogModuleConfig,
  listBuiltinStandardDefinitions,
  normalizeItemDefinition,
} from '../../domains/items';
import { deriveStablePublicResourceId } from '../../domains/resource-id';
import {
  fetchHostLibraryItems,
  isHostLibraryEnabled,
} from '../host/host-library-http';
import {
  supabaseItemCatalogRepository,
} from './supabase-item-catalog.repository';
import type {
  ForkDefinitionTarget,
  ItemDefinitionDraft,
} from './supabase-item-catalog.repository';

/** Core / builtin catalog rows have no DB trigger — stamp a stable IT- id for Library UX. */
function withCatalogPublicId(definition: ItemDefinition): ItemDefinition {
  if (definition.publicId) return definition;
  if (definition.scope !== 'core') return definition;
  return {
    ...definition,
    publicId: deriveStablePublicResourceId('item', definition.id),
  };
}

/** Everything a character screen needs to render and extend its inventory. */
export interface CharacterItemCatalog {
  effectiveWorldProfileId: string | null;
  /** Active definitions offered by Add/Catalog surfaces, already ordered. */
  addable: ItemDefinition[];
  /** Resolves owned instances, including archived definitions. */
  lookup: ItemDefinitionLookup;
  /** Raw records, for callers that need status or ownership. */
  records: CatalogDefinitionRecord[];
}

/** Library Items browser catalog (#138): Core + builtin-standard + persisted. */
export interface LibraryItemCatalog {
  /** Active definitions visible in the Library Items tab, already ordered. */
  definitions: ItemDefinition[];
  /** Raw persisted records (Personal/World), including archived. */
  persistedRecords: CatalogDefinitionRecord[];
}

/**
 * Load the catalog for a character (#143).
 *
 * Addable: always 36 Core; with effective world apply `item-catalog` module via
 * {@link composeCharacterInventoryAddCatalog}; null world → Core + Personal only.
 * Lookup also resolves builtin-standard ids so owned pack instances stay renderable
 * after exclude/archive from the add surface.
 */
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

/**
 * Load the Library Items catalog: local Core + builtin-standard packs plus
 * Personal/World rows RLS already returns. Filter is UX-only; visibility is
 * server-side (#136). Archived persisted rows are omitted from `definitions`.
 */
export async function loadLibraryItemCatalog(): Promise<LibraryItemCatalog> {
  let persistedRecords: Awaited<
    ReturnType<typeof supabaseItemCatalogRepository.listLibraryPersistedRecords>
  > = [];
  if (isHostLibraryEnabled()) {
    await fetchHostLibraryItems();
  } else {
    persistedRecords = await supabaseItemCatalogRepository.listLibraryPersistedRecords();
  }
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

/**
 * Load World-scoped catalog records for a single world profile (active + archived).
 * Used by World-profile item authoring (#112); not a character Add catalog.
 */
export async function loadWorldProfileItemCatalog(
  worldProfileId: string,
): Promise<CatalogDefinitionRecord[]> {
  const records = await supabaseItemCatalogRepository.listCatalogRecords(worldProfileId);
  return records.filter(
    (r) => r.definition.scope === 'world' && r.worldProfileId === worldProfileId,
  );
}

/**
 * Load one definition for the Item Workbench (#139).
 * Core/builtin resolve locally; Personal/World via RLS. Returns null when missing.
 */
export async function getItemDefinitionById(definitionId: string): Promise<{
  definition: ItemDefinition;
  record: CatalogDefinitionRecord | null;
} | null> {
  return supabaseItemCatalogRepository.getDefinitionById(definitionId);
}

export function createPersonalDefinition(draft: ItemDefinitionDraft): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.createPersonalDefinition(draft);
}

export function createWorldDefinition(
  worldProfileId: string,
  draft: ItemDefinitionDraft,
): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.createWorldDefinition(worldProfileId, draft);
}

export function updateDefinition(
  definitionId: string,
  draft: ItemDefinitionDraft,
): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.updateDefinition(definitionId, draft);
}

/** Archiving is the only removal path; owned instances keep resolving afterwards. */
export function archiveDefinition(definitionId: string): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.setDefinitionStatus(definitionId, 'archived');
}

export function restoreDefinition(definitionId: string): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.setDefinitionStatus(definitionId, 'active');
}

/**
 * Fork Core/World/Personal into a new Personal or World definition.
 * Always a new id with provenance; never overwrites the source.
 */
export function forkDefinition(
  sourceDefinitionId: string,
  target: ForkDefinitionTarget,
): Promise<CatalogDefinitionRecord> {
  return supabaseItemCatalogRepository.forkDefinition(sourceDefinitionId, target);
}

export type { ForkDefinitionTarget, ItemDefinitionDraft };
