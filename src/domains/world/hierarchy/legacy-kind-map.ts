/**
 * legacy-kind-map — Compat readers for old place/map/prototype kinds (#714).
 * Location: src/domains/world/hierarchy/legacy-kind-map.ts
 *
 * Never silently invent political parents. Ambiguous rows → needs-review.
 */
import type { WorldAtlasMapKind } from '../atlas/world-atlas.types';
import type { WorldPlaceKind } from '../places/world-place.types';
import type { WorldNodeKind } from './world-node.types';

/** How a legacy/ui kind relates to the canonical WorldNodeKind contract. */
export type KindMappingStatus =
  | 'canonical'
  | 'compat-alias'
  | 'needs-review'
  | 'ui-only'
  | 'map-only'
  | 'world-root';

export type KindMappingRow = {
  readonly source: 'place' | 'map' | 'prototype-nav';
  readonly legacy: string;
  readonly status: KindMappingStatus;
  /** Present when status is canonical or compat-alias. */
  readonly nodeKind: WorldNodeKind | null;
  readonly notes: string;
};

const PLACE_ROWS: readonly KindMappingRow[] = [
  {
    source: 'place',
    legacy: 'continent',
    status: 'canonical',
    nodeKind: 'continent',
    notes: 'Direct match',
  },
  {
    source: 'place',
    legacy: 'realm',
    status: 'compat-alias',
    nodeKind: 'country',
    notes: 'Political polity → country',
  },
  {
    source: 'place',
    legacy: 'region',
    status: 'needs-review',
    nodeKind: null,
    notes: 'May be cartographic feature or country; never auto-map',
  },
  {
    source: 'place',
    legacy: 'settlement',
    status: 'compat-alias',
    nodeKind: 'place',
    notes: 'Add place subtype city|village when known',
  },
  {
    source: 'place',
    legacy: 'district',
    status: 'needs-review',
    nodeKind: null,
    notes: 'May be place subtype or map feature',
  },
  {
    source: 'place',
    legacy: 'site',
    status: 'needs-review',
    nodeKind: null,
    notes: 'Outdoor site vs building entrance — review queue',
  },
  {
    source: 'place',
    legacy: 'building',
    status: 'canonical',
    nodeKind: 'building',
    notes: 'Direct match',
  },
  {
    source: 'place',
    legacy: 'interior',
    status: 'needs-review',
    nodeKind: null,
    notes: 'Often room; confirm before promote',
  },
  {
    source: 'place',
    legacy: 'dungeon',
    status: 'needs-review',
    nodeKind: null,
    notes: 'Usually building.dungeon subtype, not a hierarchy level',
  },
  {
    source: 'place',
    legacy: 'area',
    status: 'compat-alias',
    nodeKind: 'place',
    notes: 'Natural/wilderness-like place; subtype when known',
  },
] as const;

const MAP_ROWS: readonly KindMappingRow[] = [
  {
    source: 'map',
    legacy: 'world',
    status: 'world-root',
    nodeKind: null,
    notes: 'Primary map of WorldProfile root',
  },
  {
    source: 'map',
    legacy: 'region',
    status: 'map-only',
    nodeKind: null,
    notes: 'Legacy cartographic kind; prefer detail under adapter',
  },
  {
    source: 'map',
    legacy: 'settlement',
    status: 'map-only',
    nodeKind: null,
    notes: 'Legacy detail map kind',
  },
  {
    source: 'map',
    legacy: 'scene',
    status: 'map-only',
    nodeKind: null,
    notes: 'Legacy interior/battlemap kind',
  },
  {
    source: 'map',
    legacy: 'legacy_tiles',
    status: 'map-only',
    nodeKind: null,
    notes: 'Tile editor path; keep readable',
  },
] as const;

/** Prototype NAV_FILTERS / navKind strings (DE machine ids in runtime). */
const PROTOTYPE_ROWS: readonly KindMappingRow[] = [
  {
    source: 'prototype-nav',
    legacy: 'world',
    status: 'world-root',
    nodeKind: null,
    notes: 'UI root category',
  },
  {
    source: 'prototype-nav',
    legacy: 'kontinent',
    status: 'ui-only',
    nodeKind: 'continent',
    notes: 'DE nav id → continent',
  },
  {
    source: 'prototype-nav',
    legacy: 'land',
    status: 'ui-only',
    nodeKind: 'country',
    notes: 'DE nav id → country (political)',
  },
  {
    source: 'prototype-nav',
    legacy: 'ort',
    status: 'ui-only',
    nodeKind: 'place',
    notes: 'DE nav id → place',
  },
  {
    source: 'prototype-nav',
    legacy: 'gebaeude',
    status: 'ui-only',
    nodeKind: 'building',
    notes: 'DE nav id → building',
  },
  {
    source: 'prototype-nav',
    legacy: 'raum',
    status: 'ui-only',
    nodeKind: 'room',
    notes: 'DE nav id → room',
  },
] as const;

export const ALL_KIND_MAPPINGS: readonly KindMappingRow[] = [
  ...PLACE_ROWS,
  ...MAP_ROWS,
  ...PROTOTYPE_ROWS,
];

export function mappingForPlaceKind(kind: WorldPlaceKind | string): KindMappingRow {
  const hit = PLACE_ROWS.find((r) => r.legacy === kind);
  if (hit) return hit;
  return {
    source: 'place',
    legacy: String(kind),
    status: 'needs-review',
    nodeKind: null,
    notes: 'Unknown place kind',
  };
}

export function mappingForMapKind(kind: WorldAtlasMapKind | string): KindMappingRow {
  const hit = MAP_ROWS.find((r) => r.legacy === kind);
  if (hit) return hit;
  return {
    source: 'map',
    legacy: String(kind),
    status: 'needs-review',
    nodeKind: null,
    notes: 'Unknown map kind',
  };
}

export function mappingForPrototypeNavKind(kind: string): KindMappingRow {
  const hit = PROTOTYPE_ROWS.find((r) => r.legacy === kind);
  if (hit) return hit;
  return {
    source: 'prototype-nav',
    legacy: kind,
    status: 'needs-review',
    nodeKind: null,
    notes: 'Unknown prototype nav kind',
  };
}

/**
 * Best-effort node kind for a legacy place kind when status is canonical/compat-alias.
 * Returns null for needs-review / unknown — callers must not invent.
 */
export function tryNodeKindFromPlaceKind(kind: WorldPlaceKind | string): WorldNodeKind | null {
  const row = mappingForPlaceKind(kind);
  if (row.status === 'canonical' || row.status === 'compat-alias') return row.nodeKind;
  return null;
}

/** Recommended primary-map cartographic kind for a node (compat era). */
export function recommendedLegacyMapKind(nodeKind: WorldNodeKind): WorldAtlasMapKind {
  if (nodeKind === 'continent' || nodeKind === 'country') return 'region';
  if (nodeKind === 'place') return 'settlement';
  return 'scene';
}
