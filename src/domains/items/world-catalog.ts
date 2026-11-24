/**
 * World profile `item-catalog` module — config normalize/validate and pure
 * availability resolver (#142). Availability is separate from definition
 * scope/ownership. Character Inventory (#143) consumes
 * {@link composeCharacterInventoryAddCatalog}.
 * Location: src/domains/items/world-catalog.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { ItemDefinition } from './definition';
import type { ItemPack } from './pack';
import { ALL_ITEM_PACKS, getBuiltinStandardDefinition, getItemPack } from './packs';

/** Stable world-module id persisted under world_profiles.modules. */
export const ITEM_CATALOG_MODULE_ID = 'item-catalog' as const;

/** Persisted shape of the `item-catalog` world module. */
export interface ItemCatalogModuleConfig {
  enabledPackIds: string[];
  includedDefinitionIds: string[];
  excludedDefinitionIds: string[];
  /** When false, personal definitions are omitted from new add-catalogs. Default true. */
  allowPersonalItems: boolean;
}

/** Soft diagnosis from normalize — never blocks persistence of other modules. */
export interface ItemCatalogModuleDiagnosis {
  /** Pack ids preserved in config but not found in the known pack catalog. */
  unknownPackIds: readonly string[];
  /** Include ids preserved but not resolvable via the provided lookup. */
  unknownIncludedDefinitionIds: readonly string[];
  /** Exclude ids preserved but not resolvable (still applied by id when resolving). */
  unknownExcludedDefinitionIds: readonly string[];
  /** Fields that were missing or wrong-typed and coerced to defaults. */
  coercedFields: readonly string[];
}

export interface NormalizeItemCatalogModuleResult {
  config: ItemCatalogModuleConfig;
  diagnosis: ItemCatalogModuleDiagnosis;
}

export interface ResolveWorldItemCatalogInput {
  config: ItemCatalogModuleConfig;
  /** Core archetypes — always present; excludes of these ids are ignored. */
  coreDefinitions: readonly ItemDefinition[];
  /**
   * Resolves pack members and explicit includes (builtin-standard, world, …).
   * Core ids may also resolve here; Core list is still unioned explicitly.
   */
  resolveDefinition: (definitionId: string) => ItemDefinition | undefined;
  /** Pack catalog; defaults to ALL_ITEM_PACKS. Unknown pack ids are skipped with diagnosis. */
  packs?: readonly ItemPack[];
  /** World-scoped definitions for this world — always appended after excludes. */
  worldDefinitions?: readonly ItemDefinition[];
  /** Personal definitions — appended only when allowPersonalItems is true. */
  personalDefinitions?: readonly ItemDefinition[];
}

export interface ItemCatalogResolveDiagnosis {
  unknownPackIds: readonly string[];
  unresolvedIncludedDefinitionIds: readonly string[];
  ignoredCoreExcludeIds: readonly string[];
}

export interface ResolvedWorldItemCatalog {
  definitions: readonly ItemDefinition[];
  diagnosis: ItemCatalogResolveDiagnosis;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeStringIdList(value: unknown): { ids: string[]; coerced: boolean } {
  if (!Array.isArray(value)) {
    return { ids: [], coerced: value !== undefined };
  }
  const ids: string[] = [];
  let coerced = false;
  for (const entry of value) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      ids.push(entry.trim());
    } else {
      coerced = true;
    }
  }
  return { ids, coerced };
}

function dedupePreserveOrder(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Default config when the module is absent or empty. */
export function defaultItemCatalogModuleConfig(): ItemCatalogModuleConfig {
  return {
    enabledPackIds: [],
    includedDefinitionIds: [],
    excludedDefinitionIds: [],
    allowPersonalItems: true,
  };
}

/**
 * Normalize raw JSONB module config. Unknown pack/definition ids are preserved
 * so older clients do not destroy newer profiles. Invalid shapes coerce to
 * defaults with diagnosis — never throws.
 */
export function normalizeItemCatalogModuleConfig(
  raw: unknown,
  options?: {
    knownPackIds?: ReadonlySet<string>;
    resolveDefinition?: (definitionId: string) => ItemDefinition | undefined;
  },
): NormalizeItemCatalogModuleResult {
  const knownPackIds =
    options?.knownPackIds ??
    new Set(ALL_ITEM_PACKS.map((pack) => pack.id));
  const resolveDefinition =
    options?.resolveDefinition ?? ((id: string) => getBuiltinStandardDefinition(id));

  const coercedFields: string[] = [];

  if (!isRecord(raw)) {
    return {
      config: defaultItemCatalogModuleConfig(),
      diagnosis: {
        unknownPackIds: [],
        unknownIncludedDefinitionIds: [],
        unknownExcludedDefinitionIds: [],
        coercedFields: raw === undefined || raw === null ? [] : ['config'],
      },
    };
  }

  const packs = normalizeStringIdList(raw.enabledPackIds);
  if (packs.coerced) coercedFields.push('enabledPackIds');
  const includes = normalizeStringIdList(raw.includedDefinitionIds);
  if (includes.coerced) coercedFields.push('includedDefinitionIds');
  const excludes = normalizeStringIdList(raw.excludedDefinitionIds);
  if (excludes.coerced) coercedFields.push('excludedDefinitionIds');

  let allowPersonalItems = true;
  if (typeof raw.allowPersonalItems === 'boolean') {
    allowPersonalItems = raw.allowPersonalItems;
  } else if (raw.allowPersonalItems !== undefined) {
    coercedFields.push('allowPersonalItems');
  }

  const enabledPackIds = dedupePreserveOrder(packs.ids);
  const includedDefinitionIds = dedupePreserveOrder(includes.ids);
  const excludedDefinitionIds = dedupePreserveOrder(excludes.ids);

  const unknownPackIds = enabledPackIds.filter((id) => !knownPackIds.has(id));
  const unknownIncludedDefinitionIds = includedDefinitionIds.filter(
    (id) => resolveDefinition(id) === undefined,
  );
  const unknownExcludedDefinitionIds = excludedDefinitionIds.filter(
    (id) => resolveDefinition(id) === undefined,
  );

  return {
    config: {
      enabledPackIds,
      includedDefinitionIds,
      excludedDefinitionIds,
      allowPersonalItems,
    },
    diagnosis: {
      unknownPackIds,
      unknownIncludedDefinitionIds,
      unknownExcludedDefinitionIds,
      coercedFields,
    },
  };
}

/**
 * Read module config from a world modules map (defaults when absent).
 */
export function getItemCatalogModuleConfig(
  modules: Record<string, unknown> | null | undefined,
): NormalizeItemCatalogModuleResult {
  const raw = modules?.[ITEM_CATALOG_MODULE_ID];
  return normalizeItemCatalogModuleConfig(raw);
}

/**
 * Pure deterministic catalog for a world.
 *
 * Order:
 * 1. Union definitions from enabled packs (declaration order within each pack;
 *    pack order follows `enabledPackIds`)
 * 2. Add explicit includes
 * 3. Remove excludes (Core ids never removed)
 * 4. Add world-scoped definitions
 * 5. Add personal definitions when `allowPersonalItems`
 * 6. Always ensure Core archetypes are present
 * 7. Dedupe by stable definition id (first wins)
 */
export function resolveWorldItemCatalog(
  input: ResolveWorldItemCatalogInput,
): ResolvedWorldItemCatalog {
  const packs = input.packs ?? ALL_ITEM_PACKS;
  const packById = new Map(packs.map((pack) => [pack.id, pack]));
  const worldDefinitions = input.worldDefinitions ?? [];
  const personalDefinitions = input.personalDefinitions ?? [];

  const coreIds = new Set(input.coreDefinitions.map((definition) => definition.id));
  const byId = new Map<string, ItemDefinition>();

  const unknownPackIds: string[] = [];
  const unresolvedIncludedDefinitionIds: string[] = [];
  const ignoredCoreExcludeIds: string[] = [];

  // 1. Packs union
  for (const packId of input.config.enabledPackIds) {
    const pack = packById.get(packId) ?? getItemPack(packId);
    if (!pack) {
      unknownPackIds.push(packId);
      continue;
    }
    for (const definitionId of pack.definitionIds) {
      if (byId.has(definitionId)) continue;
      const definition = input.resolveDefinition(definitionId);
      if (definition) byId.set(definitionId, definition);
    }
  }

  // 2. Explicit includes
  for (const definitionId of input.config.includedDefinitionIds) {
    if (byId.has(definitionId)) continue;
    const definition = input.resolveDefinition(definitionId);
    if (definition) {
      byId.set(definitionId, definition);
    } else {
      unresolvedIncludedDefinitionIds.push(definitionId);
    }
  }

  // 3. Excludes (Core never removed)
  for (const definitionId of input.config.excludedDefinitionIds) {
    if (coreIds.has(definitionId)) {
      ignoredCoreExcludeIds.push(definitionId);
      continue;
    }
    byId.delete(definitionId);
  }

  // 4. World-scoped definitions
  for (const definition of worldDefinitions) {
    byId.set(definition.id, definition);
  }

  // 5. Personal when allowed
  if (input.config.allowPersonalItems) {
    for (const definition of personalDefinitions) {
      byId.set(definition.id, definition);
    }
  }

  // 6. Core always present (after excludes so Core cannot be stripped)
  for (const definition of input.coreDefinitions) {
    byId.set(definition.id, definition);
  }

  // Stable output: Core first (catalog order), then remaining in insertion order
  const definitions: ItemDefinition[] = [];
  const emitted = new Set<string>();
  for (const definition of input.coreDefinitions) {
    definitions.push(definition);
    emitted.add(definition.id);
  }
  for (const definition of byId.values()) {
    if (emitted.has(definition.id)) continue;
    definitions.push(definition);
    emitted.add(definition.id);
  }

  return {
    definitions,
    diagnosis: {
      unknownPackIds: dedupePreserveOrder(unknownPackIds),
      unresolvedIncludedDefinitionIds: dedupePreserveOrder(unresolvedIncludedDefinitionIds),
      ignoredCoreExcludeIds: dedupePreserveOrder(ignoredCoreExcludeIds),
    },
  };
}

export interface ComposeCharacterInventoryAddCatalogInput {
  /** Adventure > Character > null — null means Core + Personal only (no packs). */
  effectiveWorldProfileId: string | null;
  /** World `item-catalog` module; defaults apply when module missing. Ignored if no world. */
  config: ItemCatalogModuleConfig;
  coreDefinitions: readonly ItemDefinition[];
  resolveDefinition: (definitionId: string) => ItemDefinition | undefined;
  packs?: readonly ItemPack[];
  worldDefinitions?: readonly ItemDefinition[];
  personalDefinitions?: readonly ItemDefinition[];
}

/**
 * Character Inventory v2 add-catalog composition (#143).
 *
 * - Null world: Core ∪ Personal (no built-in packs / includes).
 * - Effective world: {@link resolveWorldItemCatalog} with that world's module config.
 */
export function composeCharacterInventoryAddCatalog(
  input: ComposeCharacterInventoryAddCatalogInput,
): ResolvedWorldItemCatalog {
  const personalDefinitions = input.personalDefinitions ?? [];

  if (!input.effectiveWorldProfileId) {
    const definitions: ItemDefinition[] = [];
    const emitted = new Set<string>();
    for (const definition of input.coreDefinitions) {
      definitions.push(definition);
      emitted.add(definition.id);
    }
    for (const definition of personalDefinitions) {
      if (emitted.has(definition.id)) continue;
      definitions.push(definition);
      emitted.add(definition.id);
    }
    return {
      definitions,
      diagnosis: {
        unknownPackIds: [],
        unresolvedIncludedDefinitionIds: [],
        ignoredCoreExcludeIds: [],
      },
    };
  }

  return resolveWorldItemCatalog({
    config: input.config,
    coreDefinitions: input.coreDefinitions,
    resolveDefinition: input.resolveDefinition,
    packs: input.packs,
    worldDefinitions: input.worldDefinitions,
    personalDefinitions,
  });
}
