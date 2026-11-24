/**
 * useItemWorldAvailability — world-editor state for the `item-catalog` module
 * (#142). Wraps pack toggles, include/exclude lists, personal switch, and a
 * live effective-count via the domain-pure resolver. Does not call a backend client
 * for pack data; optional world-scoped defs load through the catalog service.
 * Location: src/app/world/item-catalog/useItemWorldAvailability.ts
 */
import { useEffect, useState } from 'react';
import { listCoreItemDefinitions } from '../../../domains/character/inventory-v2';
import type { ItemDefinition } from '../../../domains/items/definition';
import {
  ITEM_CATALOG_MODULE_ID,
  getItemCatalogModuleConfig,
  normalizeItemCatalogModuleConfig,
  resolveWorldItemCatalog,
  type ItemCatalogModuleConfig,
  type ItemCatalogModuleDiagnosis,
} from '../../../domains/items/world-catalog';
import {
  CONTEMPORARY_BASIC_PACK_ID,
  FANTASY_BASIC_PACK_ID,
  SCIFI_BASIC_PACK_ID,
  getBuiltinStandardDefinition,
  listBaseItemPacks,
  listBuiltinStandardDefinitions,
  listContextItemPacks,
} from '../../../domains/items/packs';
import { loadWorldProfileItemCatalog } from '../../../infrastructure/inventory/item-catalog-service';
import type { WorldModuleConfigMap } from '../../../domains/world/contracts/world.types';

const BASE_PACK_LABELS: Readonly<Record<string, string>> = {
  [FANTASY_BASIC_PACK_ID]: 'Fantasy',
  [SCIFI_BASIC_PACK_ID]: 'Sci-Fi',
  [CONTEMPORARY_BASIC_PACK_ID]: 'Gegenwart',
};

export interface PackToggleVm {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  unknown: boolean;
}

export interface IdListEntryVm {
  id: string;
  label: string;
  unknown: boolean;
}

export interface UseItemWorldAvailabilityArgs {
  modules: WorldModuleConfigMap;
  onModulesChange: (
    next:
      | WorldModuleConfigMap
      | ((current: WorldModuleConfigMap) => WorldModuleConfigMap),
  ) => void;
  worldProfileId?: string | null;
}

export interface UseItemWorldAvailabilityResult {
  config: ItemCatalogModuleConfig;
  diagnosis: ItemCatalogModuleDiagnosis;
  basePacks: PackToggleVm[];
  contextPacks: PackToggleVm[];
  includes: IdListEntryVm[];
  excludes: IdListEntryVm[];
  allowPersonalItems: boolean;
  effectiveCount: number;
  worldDefsLoading: boolean;
  worldDefsError: string | null;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  searchResults: readonly ItemDefinition[];
  togglePack: (packId: string, enabled: boolean) => void;
  addInclude: (definitionId: string) => void;
  removeInclude: (definitionId: string) => void;
  addExclude: (definitionId: string) => void;
  removeExclude: (definitionId: string) => void;
  setAllowPersonalItems: (value: boolean) => void;
}

function writeConfig(
  modules: WorldModuleConfigMap,
  config: ItemCatalogModuleConfig,
): WorldModuleConfigMap {
  return {
    ...modules,
    [ITEM_CATALOG_MODULE_ID]: {
      ...(modules[ITEM_CATALOG_MODULE_ID] ?? {}),
      enabledPackIds: config.enabledPackIds,
      includedDefinitionIds: config.includedDefinitionIds,
      excludedDefinitionIds: config.excludedDefinitionIds,
      allowPersonalItems: config.allowPersonalItems,
    },
  };
}

function labelForDefinitionId(definitionId: string): string {
  const builtin = getBuiltinStandardDefinition(definitionId);
  if (builtin) return builtin.name;
  const core = listCoreItemDefinitions().find((entry) => entry.id === definitionId);
  if (core) return core.name;
  return definitionId;
}

function patchList(ids: readonly string[], id: string, add: boolean): string[] {
  if (add) {
    if (ids.includes(id)) return [...ids];
    return [...ids, id];
  }
  return ids.filter((entry) => entry !== id);
}

/**
 * Hook: item-catalog module UI state for the world editor.
 */
export function useItemWorldAvailability({
  modules,
  onModulesChange,
  worldProfileId,
}: UseItemWorldAvailabilityArgs): UseItemWorldAvailabilityResult {
  const { config, diagnosis } = getItemCatalogModuleConfig(modules);
  const [searchQuery, setSearchQuery] = useState('');
  const [worldDefinitions, setWorldDefinitions] = useState<ItemDefinition[]>([]);
  const [worldDefsLoading, setWorldDefsLoading] = useState(false);
  const [worldDefsError, setWorldDefsError] = useState<string | null>(null);

  useEffect(() => {
    if (!worldProfileId) {
      setWorldDefinitions([]);
      setWorldDefsError(null);
      setWorldDefsLoading(false);
      return;
    }
    let cancelled = false;
    setWorldDefsLoading(true);
    setWorldDefsError(null);
    void loadWorldProfileItemCatalog(worldProfileId)
      .then((records) => {
        if (cancelled) return;
        setWorldDefinitions(
          records
            .filter((record) => record.status === 'active')
            .map((record) => record.definition),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[worlds] item-catalog world defs load failed', err);
        setWorldDefsError(
          err instanceof Error ? err.message : 'Welt-Gegenstände konnten nicht geladen werden.',
        );
        setWorldDefinitions([]);
      })
      .finally(() => {
        if (!cancelled) setWorldDefsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [worldProfileId]);

  const enabledPackSet = new Set(config.enabledPackIds);
  const knownBase = listBaseItemPacks();
  const knownContext = listContextItemPacks();
  const knownPackIds = new Set([...knownBase, ...knownContext].map((pack) => pack.id));

  const basePacks: PackToggleVm[] = knownBase.map((pack) => ({
    id: pack.id,
    label: BASE_PACK_LABELS[pack.id] ?? pack.name,
    description: pack.description,
    enabled: enabledPackSet.has(pack.id),
    unknown: false,
  }));

  const contextPacks: PackToggleVm[] = knownContext.map((pack) => ({
    id: pack.id,
    label: pack.name,
    description: pack.description,
    enabled: enabledPackSet.has(pack.id),
    unknown: false,
  }));

  // Preserve unknown pack ids as editable toggles (downgrade-safe).
  for (const packId of config.enabledPackIds) {
    if (knownPackIds.has(packId)) continue;
    contextPacks.push({
      id: packId,
      label: packId,
      description: 'Unbekanntes Pack (von neuerer App-Version). Bleibt erhalten.',
      enabled: true,
      unknown: true,
    });
  }

  const includes: IdListEntryVm[] = config.includedDefinitionIds.map((id) => ({
    id,
    label: labelForDefinitionId(id),
    unknown: getBuiltinStandardDefinition(id) === undefined
      && !listCoreItemDefinitions().some((entry) => entry.id === id),
  }));

  const excludes: IdListEntryVm[] = config.excludedDefinitionIds.map((id) => ({
    id,
    label: labelForDefinitionId(id),
    unknown: getBuiltinStandardDefinition(id) === undefined
      && !listCoreItemDefinitions().some((entry) => entry.id === id),
  }));

  const resolveDefinition = (definitionId: string): ItemDefinition | undefined => {
    const builtin = getBuiltinStandardDefinition(definitionId);
    if (builtin) return builtin;
    const world = worldDefinitions.find((entry) => entry.id === definitionId);
    if (world) return world;
    return listCoreItemDefinitions().find((entry) => entry.id === definitionId);
  };

  const resolved = resolveWorldItemCatalog({
    config,
    coreDefinitions: listCoreItemDefinitions(),
    resolveDefinition,
    worldDefinitions,
    personalDefinitions: [],
  });

  const query = searchQuery.trim().toLowerCase();
  const searchResults =
    query.length === 0
      ? []
      : listBuiltinStandardDefinitions()
          .filter((definition) => {
            const haystack = `${definition.name} ${definition.description} ${definition.id}`.toLowerCase();
            return haystack.includes(query);
          })
          .slice(0, 12);

  const updateConfig = (
    recipe: (current: ItemCatalogModuleConfig) => ItemCatalogModuleConfig,
  ) => {
    onModulesChange((currentModules) => {
      const { config: current } = getItemCatalogModuleConfig(currentModules);
      const normalized = normalizeItemCatalogModuleConfig(recipe(current));
      return writeConfig(currentModules, normalized.config);
    });
  };

  return {
    config,
    diagnosis,
    basePacks,
    contextPacks,
    includes,
    excludes,
    allowPersonalItems: config.allowPersonalItems,
    effectiveCount: resolved.definitions.length,
    worldDefsLoading,
    worldDefsError,
    searchQuery,
    setSearchQuery,
    searchResults,
    togglePack: (packId, enabled) => {
      updateConfig((current) => ({
        ...current,
        enabledPackIds: patchList(current.enabledPackIds, packId, enabled),
      }));
    },
    addInclude: (definitionId) => {
      updateConfig((current) => ({
        ...current,
        includedDefinitionIds: patchList(current.includedDefinitionIds, definitionId, true),
        excludedDefinitionIds: current.excludedDefinitionIds.filter((id) => id !== definitionId),
      }));
    },
    removeInclude: (definitionId) => {
      updateConfig((current) => ({
        ...current,
        includedDefinitionIds: patchList(current.includedDefinitionIds, definitionId, false),
      }));
    },
    addExclude: (definitionId) => {
      updateConfig((current) => ({
        ...current,
        excludedDefinitionIds: patchList(current.excludedDefinitionIds, definitionId, true),
      }));
    },
    removeExclude: (definitionId) => {
      updateConfig((current) => ({
        ...current,
        excludedDefinitionIds: patchList(current.excludedDefinitionIds, definitionId, false),
      }));
    },
    setAllowPersonalItems: (value) => {
      updateConfig((current) => ({
        ...current,
        allowPersonalItems: value,
      }));
    },
  };
}
