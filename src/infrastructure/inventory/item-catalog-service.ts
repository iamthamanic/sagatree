/**
 * item-catalog-service — Inventory v2 catalog via host Library HTTP (CUT-20).
 * Location: src/infrastructure/inventory/item-catalog-service.ts
 */
import {
  createDefinitionLookup,
  getCoreItemDefinition,
  isDefinitionVisible,
  listCoreItemDefinitions,
  parseItemDefinition,
  resolveEffectiveWorldProfileId as resolveEffectiveWorldProfileIdFromBinding,
} from '../../domains/character/inventory-v2';
import type {
  CatalogDefinitionRecord,
  InventoryState,
  ItemDefinition,
  ItemDefinitionLookup,
} from '../../domains/character/inventory-v2';
import { isInventoryV2State } from '../../domains/character/inventory-v2';
import {
  buildForkedItemDefinitionDraft,
  compareLibraryItemDefinitions,
  composeCharacterInventoryAddCatalog,
  getBuiltinStandardDefinition,
  getItemCatalogModuleConfig,
  listBuiltinStandardDefinitions,
  normalizeItemDefinition,
  type ItemDefinitionWriteDraft,
} from '../../domains/items';
import { deriveStablePublicResourceId } from '../../domains/resource-id';
import { getAuthenticatedUserId } from '../../lib/authenticatedUser';
import {
  archiveHostLibraryItem,
  createHostLibraryItem,
  fetchHostLibraryAdventureArcs,
  fetchHostLibraryCharacter,
  fetchHostLibraryItem,
  fetchHostLibraryItems,
  forkHostLibraryItem,
  isHostLibraryEnabled,
  restoreHostLibraryItem,
  updateHostLibraryItem,
} from '../host/host-library-http';
import { projectService } from '../project/project-service';
import { toDefinitionPayload } from './item-catalog.persistence';

/** Target for fork — Personal or World (world requires profile id). */
export type ForkDefinitionTarget =
  | { scope: 'personal' }
  | { scope: 'world'; worldProfileId: string };

/** Draft for creating or updating a persisted definition (host payload). */
export type ItemDefinitionDraft = ItemDefinitionWriteDraft;

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Map host `/api/v1/library/items` rows into catalog records. */
function mapHostLibraryItemRecord(raw: unknown): CatalogDefinitionRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = typeof row.id === 'string' ? row.id : null;
  if (!id) return null;
  const origin = row.origin;
  const scope = origin === 'world' ? 'world' : origin === 'personal' ? 'personal' : null;
  if (!scope) return null;
  const payload =
    row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? row.payload
      : {};
  const definition = parseItemDefinition(id, scope, payload);
  if (!definition) return null;
  const publicId =
    typeof row.publicId === 'string' && row.publicId.trim()
      ? row.publicId.trim().toUpperCase()
      : null;
  const status = row.status === 'archived' ? 'archived' : 'active';
  const record: CatalogDefinitionRecord = {
    definition: publicId ? { ...definition, publicId } : definition,
    status,
    publicId,
    worldProfileId: typeof row.worldProfileId === 'string' ? row.worldProfileId : null,
  };
  const ownerFromHost = row.ownerUserId;
  record.ownerUserId = typeof ownerFromHost === 'string' ? ownerFromHost : null;
  return record;
}

/** Core / builtin: stable IT- public id for Library UX. */
function withCatalogPublicId(definition: ItemDefinition): ItemDefinition {
  if (definition.publicId) return definition;
  if (definition.scope !== 'core') return definition;
  return {
    ...definition,
    publicId: deriveStablePublicResourceId('item', definition.id),
  };
}

async function fetchHostItemRecords(
  options: {
    readonly worldProfileId?: string | null;
    readonly includeArchived?: boolean;
    readonly origins?: readonly ('standard' | 'personal' | 'world')[];
  } = {},
): Promise<CatalogDefinitionRecord[]> {
  const hostItems = await fetchHostLibraryItems(options);
  return hostItems
    .map(mapHostLibraryItemRecord)
    .filter((record): record is CatalogDefinitionRecord => record !== null);
}

/**
 * Effective world profile: adventure project binding wins over character sheet binding (#143).
 * Host: character sheet + active adventure arcs → project `worldProfileId`.
 */
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

async function listCatalogRecordsForEffectiveWorld(
  effectiveWorldProfileId: string | null,
  userId: string,
): Promise<CatalogDefinitionRecord[]> {
  // CUT-06b: host filters by worldProfileId + ACL (403 when unauthorized).
  const all = await fetchHostItemRecords({
    worldProfileId: effectiveWorldProfileId,
  });
  const context = { userId, effectiveWorldProfileId };
  return all.filter((record) => isDefinitionVisible(record, context));
}

export interface CharacterItemCatalog {
  effectiveWorldProfileId: string | null;
  addable: ItemDefinition[];
  lookup: ItemDefinitionLookup;
  records: CatalogDefinitionRecord[];
}

export interface LibraryItemCatalog {
  definitions: ItemDefinition[];
  persistedRecords: CatalogDefinitionRecord[];
}

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

async function createHostCatalogDefinition(
  origin: 'personal' | 'world',
  draft: ItemDefinitionDraft,
  worldProfileId: string | null,
): Promise<CatalogDefinitionRecord> {
  const tempId = `${origin}:pending`;
  const payload = toDefinitionPayload({ ...draft, id: tempId, scope: origin });
  const created = await createHostLibraryItem({
    name: draft.name,
    origin,
    worldProfileId,
    payload,
  });
  const record = mapHostLibraryItemRecord(created);
  if (!record) throw new Error('Host-Item anlegen: ungültige Antwort');
  return record;
}

export async function createPersonalDefinition(
  draft: ItemDefinitionDraft,
): Promise<CatalogDefinitionRecord> {
  assertHost();
  return createHostCatalogDefinition('personal', draft, null);
}

export async function createWorldDefinition(
  worldProfileId: string,
  draft: ItemDefinitionDraft,
): Promise<CatalogDefinitionRecord> {
  assertHost();
  return createHostCatalogDefinition('world', draft, worldProfileId);
}

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

export async function archiveDefinition(definitionId: string): Promise<CatalogDefinitionRecord> {
  assertHost();
  const archived = await archiveHostLibraryItem(definitionId);
  const record = mapHostLibraryItemRecord(archived);
  if (!record) throw new Error('Host-Item archivieren: ungültige Antwort');
  return record;
}

export async function restoreDefinition(definitionId: string): Promise<CatalogDefinitionRecord> {
  assertHost();
  const restored = await restoreHostLibraryItem(definitionId);
  const record = mapHostLibraryItemRecord(restored);
  if (!record) throw new Error('Host-Item wiederherstellen: ungültige Antwort');
  return record;
}

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

/**
 * Ensure every definitionId in a writable inventory is catalog-visible or a
 * builtin standard (#137/#143). Host-only (CUT-20).
 */
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
