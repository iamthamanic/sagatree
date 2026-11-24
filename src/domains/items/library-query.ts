/**
 * library-query — pure search/filter helpers for the Library Items browser (#138).
 * Location: src/domains/items/library-query.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { ItemDefinition } from './definition';
import type { ItemPack } from './pack';
import type {
  ItemContext,
  ItemKindKey,
  ItemOrigin,
  ItemSettingTag,
} from './taxonomy';
import { normalizeItemDefinition } from './normalize';

/** Quelle filter values shown in the Library Items UI. */
export type LibraryItemSource = 'core' | 'standard' | 'personal' | 'world';

export interface ItemLibraryFilters {
  kinds: readonly ItemKindKey[];
  settings: readonly ItemSettingTag[];
  contexts: readonly ItemContext[];
  sources: readonly LibraryItemSource[];
  packIds: readonly string[];
}

export const EMPTY_ITEM_LIBRARY_FILTERS: ItemLibraryFilters = Object.freeze({
  kinds: Object.freeze([]),
  settings: Object.freeze([]),
  contexts: Object.freeze([]),
  sources: Object.freeze([]),
  packIds: Object.freeze([]),
});

/** Map normalized origin → Library Quelle bucket. */
export function librarySourceFromOrigin(origin: ItemOrigin | undefined): LibraryItemSource {
  switch (origin) {
    case 'builtin-standard':
      return 'standard';
    case 'personal':
      return 'personal';
    case 'world':
      return 'world';
    case 'core-archetype':
    default:
      return 'core';
  }
}

export function hasActiveItemLibraryFilters(filters: ItemLibraryFilters): boolean {
  return (
    filters.kinds.length > 0 ||
    filters.settings.length > 0 ||
    filters.contexts.length > 0 ||
    filters.sources.length > 0 ||
    filters.packIds.length > 0
  );
}

/**
 * Case-insensitive, trim-normalized fulltext match over name, description,
 * kind, settings, contexts, capabilities, and roles.
 */
export function itemMatchesFulltext(definition: ItemDefinition, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const normalized = normalizeItemDefinition(definition);
  const haystack = [
    normalized.name,
    normalized.description,
    normalized.kindKey ?? '',
    normalized.type,
    normalized.publicId ?? '',
    ...(normalized.settingTags ?? []),
    ...(normalized.contexts ?? []),
    ...(normalized.capabilities ?? []),
    ...(normalized.roles ?? []),
    normalized.origin ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

function matchesOrDimension<T>(selected: readonly T[], values: readonly T[]): boolean {
  if (selected.length === 0) return true;
  return selected.some((value) => values.includes(value));
}

/**
 * Apply Library filters: within a dimension OR, across dimensions AND.
 * Pack membership uses the provided pack id → definition id index.
 */
export function itemMatchesLibraryFilters(
  definition: ItemDefinition,
  filters: ItemLibraryFilters,
  packMembership: ReadonlyMap<string, readonly string[]>,
): boolean {
  const normalized = normalizeItemDefinition(definition);

  if (filters.kinds.length > 0) {
    const kind = normalized.kindKey;
    if (!kind || !filters.kinds.includes(kind)) return false;
  }

  if (!matchesOrDimension(filters.settings, normalized.settingTags ?? [])) return false;
  if (!matchesOrDimension(filters.contexts, normalized.contexts ?? [])) return false;

  if (filters.sources.length > 0) {
    const source = librarySourceFromOrigin(normalized.origin);
    if (!filters.sources.includes(source)) return false;
  }

  if (filters.packIds.length > 0) {
    const memberOf = packMembership.get(normalized.id) ?? [];
    if (!filters.packIds.some((packId) => memberOf.includes(packId))) return false;
  }

  return true;
}

/** Filter + search a catalog; does not mutate input. */
export function filterItemLibraryCatalog(
  definitions: readonly ItemDefinition[],
  searchQuery: string,
  filters: ItemLibraryFilters,
  packMembership: ReadonlyMap<string, readonly string[]>,
): ItemDefinition[] {
  return definitions.filter(
    (definition) =>
      itemMatchesFulltext(definition, searchQuery) &&
      itemMatchesLibraryFilters(definition, filters, packMembership),
  );
}

/** Build definitionId → packIds index from pack list (many packs per definition). */
export function buildPackMembershipIndex(
  packs: readonly ItemPack[],
): ReadonlyMap<string, readonly string[]> {
  const map = new Map<string, string[]>();
  for (const pack of packs) {
    for (const definitionId of pack.definitionIds) {
      const existing = map.get(definitionId);
      if (existing) {
        if (!existing.includes(pack.id)) existing.push(pack.id);
      } else {
        map.set(definitionId, [pack.id]);
      }
    }
  }
  return map;
}

/** Stable Library sort: source order Core → Standard → World → Personal, then de-DE name, then id. */
const SOURCE_SORT_ORDER: readonly LibraryItemSource[] = [
  'core',
  'standard',
  'world',
  'personal',
];

export function compareLibraryItemDefinitions(a: ItemDefinition, b: ItemDefinition): number {
  const na = normalizeItemDefinition(a);
  const nb = normalizeItemDefinition(b);
  const sourceDelta =
    SOURCE_SORT_ORDER.indexOf(librarySourceFromOrigin(na.origin)) -
    SOURCE_SORT_ORDER.indexOf(librarySourceFromOrigin(nb.origin));
  if (sourceDelta !== 0) return sourceDelta;
  const nameDelta = na.name.localeCompare(nb.name, 'de-DE');
  if (nameDelta !== 0) return nameDelta;
  return na.id.localeCompare(nb.id);
}
