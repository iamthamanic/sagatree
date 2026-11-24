/**
 * library-query — pure search/filter helpers for the Library NPCs & Kreaturen browser (#197).
 * Location: src/domains/npc-creature/library-query.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import {
  machtgradForLevel,
  type SagaTreeCombatRole,
  type SagaTreeMachtgrad,
} from '../rules/sagatree/npc-creature-power';
import type { NpcCreatureDefinition } from './definition';
import type { NpcCreatureCatalogRecord } from './policy';
import type {
  NpcCreatureCategory,
  NpcCreatureKind,
  NpcCreatureScope,
  NpcCreatureSheetMode,
} from './taxonomy';

/** Primary kind filter: all / npc-only / creature-only. */
export type NpcCreatureLibraryKindFilter = 'all' | NpcCreatureKind;

/** Quelle buckets shown in the Library NPC browser. */
export type LibraryNpcCreatureSource = 'core' | 'pack' | 'world' | 'personal';

export const LIBRARY_NPC_CREATURE_SOURCES: readonly LibraryNpcCreatureSource[] = Object.freeze([
  'core',
  'pack',
  'world',
  'personal',
]);

/** Map a definition to Library Quelle (Core vs Pack vs persisted scopes). */
export function librarySourceOf(definition: NpcCreatureDefinition): LibraryNpcCreatureSource {
  if (definition.scope === 'world') return 'world';
  if (definition.scope === 'personal') return 'personal';
  if (definition.id.startsWith('builtin.')) return 'pack';
  return 'core';
}


export interface NpcCreatureLibraryFilters {
  kind: NpcCreatureLibraryKindFilter;
  categories: readonly NpcCreatureCategory[];
  machtgrade: readonly SagaTreeMachtgrad[];
  combatRoles: readonly SagaTreeCombatRole[];
  sheetModes: readonly NpcCreatureSheetMode[];
  sources: readonly LibraryNpcCreatureSource[];
}

export const EMPTY_NPC_CREATURE_LIBRARY_FILTERS: NpcCreatureLibraryFilters = Object.freeze({
  kind: 'all',
  categories: Object.freeze([]),
  machtgrade: Object.freeze([]),
  combatRoles: Object.freeze([]),
  sheetModes: Object.freeze([]),
  sources: Object.freeze([]),
});

export function hasActiveNpcCreatureLibraryFilters(
  filters: NpcCreatureLibraryFilters,
): boolean {
  return (
    filters.kind !== 'all' ||
    filters.categories.length > 0 ||
    filters.machtgrade.length > 0 ||
    filters.combatRoles.length > 0 ||
    filters.sheetModes.length > 0 ||
    filters.sources.length > 0
  );
}

/**
 * Case-insensitive fulltext over name, kind, category, tags, notes, description.
 */
export function npcCreatureMatchesFulltext(
  definition: NpcCreatureDefinition,
  rawQuery: string,
): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const haystack = [
    definition.name,
    definition.description,
    definition.kind,
    definition.category,
    definition.sheetMode,
    definition.combatProfile,
    definition.combatRole,
    definition.notes ?? '',
    ...definition.tags,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

function matchesOrDimension<T>(selected: readonly T[], value: T): boolean {
  if (selected.length === 0) return true;
  return selected.includes(value);
}

export function npcCreatureMatchesLibraryFilters(
  definition: NpcCreatureDefinition,
  filters: NpcCreatureLibraryFilters,
): boolean {
  if (filters.kind !== 'all' && definition.kind !== filters.kind) return false;
  if (!matchesOrDimension(filters.categories, definition.category)) return false;
  if (!matchesOrDimension(filters.machtgrade, machtgradForLevel(definition.level))) {
    return false;
  }
  if (!matchesOrDimension(filters.combatRoles, definition.combatRole)) return false;
  if (!matchesOrDimension(filters.sheetModes, definition.sheetMode)) return false;
  if (!matchesOrDimension(filters.sources, librarySourceOf(definition))) return false;
  return true;
}

/** Filter + search catalog records; does not mutate input. */
export function filterNpcCreatureLibraryCatalog(
  records: readonly NpcCreatureCatalogRecord[],
  searchQuery: string,
  filters: NpcCreatureLibraryFilters,
): NpcCreatureCatalogRecord[] {
  return records.filter(
    (record) =>
      npcCreatureMatchesFulltext(record.definition, searchQuery) &&
      npcCreatureMatchesLibraryFilters(record.definition, filters),
  );
}

/** Stable Library sort: core → world → personal, then de-DE name, then id. */
const SCOPE_SORT_ORDER: readonly NpcCreatureScope[] = ['core', 'world', 'personal'];

export function compareNpcCreatureLibraryRecords(
  a: NpcCreatureCatalogRecord,
  b: NpcCreatureCatalogRecord,
): number {
  const scopeDelta =
    SCOPE_SORT_ORDER.indexOf(a.definition.scope) -
    SCOPE_SORT_ORDER.indexOf(b.definition.scope);
  if (scopeDelta !== 0) return scopeDelta;
  const nameDelta = a.definition.name.localeCompare(b.definition.name, 'de-DE');
  if (nameDelta !== 0) return nameDelta;
  return a.definition.id.localeCompare(b.definition.id);
}
