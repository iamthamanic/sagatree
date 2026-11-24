/**
 * World profile `npc-creature-catalog` module — config normalize/validate and
 * pure availability resolver (#199). Availability is separate from definition
 * scope/ownership. Definitions are referenced by id — never embedded duplicates.
 * Location: src/domains/npc-creature/world-catalog.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { NpcCreatureDefinition } from './definition';
import type { NpcCreaturePack } from './pack';
import {
  ALL_NPC_CREATURE_PACKS,
  getBuiltinNpcCreatureDefinition,
  getNpcCreaturePack,
} from './packs';

/** Stable world-module id persisted under world_profiles.modules. */
export const NPC_CREATURE_CATALOG_MODULE_ID = 'npc-creature-catalog' as const;

/** Persisted shape of the `npc-creature-catalog` world module. */
export interface NpcCreatureCatalogModuleConfig {
  enabledPackIds: string[];
  includedDefinitionIds: string[];
  excludedDefinitionIds: string[];
  /** When false, personal definitions are omitted from world availability. Default true. */
  allowPersonalDefinitions: boolean;
}

/** Soft diagnosis from normalize — never blocks persistence of other modules. */
export interface NpcCreatureCatalogModuleDiagnosis {
  unknownPackIds: readonly string[];
  unknownIncludedDefinitionIds: readonly string[];
  unknownExcludedDefinitionIds: readonly string[];
  coercedFields: readonly string[];
}

export interface NormalizeNpcCreatureCatalogModuleResult {
  config: NpcCreatureCatalogModuleConfig;
  diagnosis: NpcCreatureCatalogModuleDiagnosis;
}

export interface ResolveWorldNpcCreatureCatalogInput {
  config: NpcCreatureCatalogModuleConfig;
  /** Core archetypes — always present; excludes of these ids are ignored. */
  coreDefinitions: readonly NpcCreatureDefinition[];
  /**
   * Resolves pack members and explicit includes (builtin, world, …).
   * Core ids may also resolve here; Core list is still unioned explicitly.
   */
  resolveDefinition: (definitionId: string) => NpcCreatureDefinition | undefined;
  /** Pack catalog; defaults to ALL_NPC_CREATURE_PACKS. */
  packs?: readonly NpcCreaturePack[];
  /** World-scoped definitions for this world — always appended after excludes. */
  worldDefinitions?: readonly NpcCreatureDefinition[];
  /** Personal definitions — appended only when allowPersonalDefinitions is true. */
  personalDefinitions?: readonly NpcCreatureDefinition[];
}

export interface NpcCreatureCatalogResolveDiagnosis {
  unknownPackIds: readonly string[];
  unresolvedIncludedDefinitionIds: readonly string[];
  ignoredCoreExcludeIds: readonly string[];
}

export interface ResolvedWorldNpcCreatureCatalog {
  definitions: readonly NpcCreatureDefinition[];
  diagnosis: NpcCreatureCatalogResolveDiagnosis;
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
export function defaultNpcCreatureCatalogModuleConfig(): NpcCreatureCatalogModuleConfig {
  return {
    enabledPackIds: [],
    includedDefinitionIds: [],
    excludedDefinitionIds: [],
    allowPersonalDefinitions: true,
  };
}

/**
 * Normalize raw JSONB module config. Unknown pack/definition ids are preserved
 * so older clients do not destroy newer profiles. Invalid shapes coerce to
 * defaults with diagnosis — never throws.
 */
export function normalizeNpcCreatureCatalogModuleConfig(
  raw: unknown,
  options?: {
    knownPackIds?: ReadonlySet<string>;
    resolveDefinition?: (definitionId: string) => NpcCreatureDefinition | undefined;
  },
): NormalizeNpcCreatureCatalogModuleResult {
  const knownPackIds =
    options?.knownPackIds ?? new Set(ALL_NPC_CREATURE_PACKS.map((pack) => pack.id));
  const resolveDefinition =
    options?.resolveDefinition ?? ((id: string) => getBuiltinNpcCreatureDefinition(id));

  const coercedFields: string[] = [];

  if (!isRecord(raw)) {
    return {
      config: defaultNpcCreatureCatalogModuleConfig(),
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

  let allowPersonalDefinitions = true;
  if (typeof raw.allowPersonalDefinitions === 'boolean') {
    allowPersonalDefinitions = raw.allowPersonalDefinitions;
  } else if (raw.allowPersonalDefinitions !== undefined) {
    coercedFields.push('allowPersonalDefinitions');
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
      allowPersonalDefinitions,
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
export function getNpcCreatureCatalogModuleConfig(
  modules: Record<string, unknown> | null | undefined,
): NormalizeNpcCreatureCatalogModuleResult {
  const raw = modules?.[NPC_CREATURE_CATALOG_MODULE_ID];
  return normalizeNpcCreatureCatalogModuleConfig(raw);
}

/**
 * Pure deterministic catalog for a world.
 *
 * Order:
 * 1. Union definitions from enabled packs
 * 2. Add explicit includes
 * 3. Remove excludes (Core ids never removed)
 * 4. Add world-scoped definitions
 * 5. Add personal definitions when `allowPersonalDefinitions`
 * 6. Always ensure Core archetypes are present
 * 7. Dedupe by stable definition id (first wins)
 */
export function resolveWorldNpcCreatureCatalog(
  input: ResolveWorldNpcCreatureCatalogInput,
): ResolvedWorldNpcCreatureCatalog {
  const packs = input.packs ?? ALL_NPC_CREATURE_PACKS;
  const packById = new Map(packs.map((pack) => [pack.id, pack]));
  const worldDefinitions = input.worldDefinitions ?? [];
  const personalDefinitions = input.personalDefinitions ?? [];

  const coreIds = new Set(input.coreDefinitions.map((definition) => definition.id));
  const byId = new Map<string, NpcCreatureDefinition>();

  const unknownPackIds: string[] = [];
  const unresolvedIncludedDefinitionIds: string[] = [];
  const ignoredCoreExcludeIds: string[] = [];

  for (const packId of input.config.enabledPackIds) {
    const pack = packById.get(packId) ?? getNpcCreaturePack(packId);
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

  for (const definitionId of input.config.includedDefinitionIds) {
    if (byId.has(definitionId)) continue;
    const definition = input.resolveDefinition(definitionId);
    if (definition) {
      byId.set(definitionId, definition);
    } else {
      unresolvedIncludedDefinitionIds.push(definitionId);
    }
  }

  for (const definitionId of input.config.excludedDefinitionIds) {
    if (coreIds.has(definitionId)) {
      ignoredCoreExcludeIds.push(definitionId);
      continue;
    }
    byId.delete(definitionId);
  }

  for (const definition of worldDefinitions) {
    byId.set(definition.id, definition);
  }

  if (input.config.allowPersonalDefinitions) {
    for (const definition of personalDefinitions) {
      byId.set(definition.id, definition);
    }
  }

  for (const definition of input.coreDefinitions) {
    byId.set(definition.id, definition);
  }

  const definitions: NpcCreatureDefinition[] = [];
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
