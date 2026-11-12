/**
 * atlas-canonical-features — ATL2-B01 canonical feature catalog + classifiers.
 * Location: src/domains/world/atlas/atlas-canonical-features.ts
 *
 * Additive over UnifiedCanvasDoc V1 wire. Does not rewrite stored documents.
 * Pure domain — no React / Host HTTP.
 */

import type { AtlasFeatureOwner } from './map-frame';
import type {
  UnifiedCanvasDoc,
  UnifiedCanvasMaterial,
  UnifiedCanvasObject,
  UnifiedCanvasRoom,
  UnifiedCanvasStampType,
  UnifiedCanvasStroke,
  UnifiedCanvasWall,
} from './unified-canvas-doc';

/** Wire format remains V1 until B02 adapter; catalog is V2 semantic overlay. */
export const ATLAS_CANONICAL_CATALOG_VERSION = 'atl2-b01-catalog-v1' as const;
export const ATLAS_WIRE_FORMAT_DECISION = 'retain-sagatree-unified-atlas-v1' as const;

export type AtlasCanonicalFeatureKind =
  | 'terrain_area'
  | 'political_area'
  | 'path_way'
  | 'path_river'
  | 'building_footprint'
  | 'floor_plan_room'
  | 'wall'
  | 'door'
  | 'prop_object'
  | 'heightfield'
  | 'layer_toggle'
  | 'raster_reference'
  | 'world_node_ref'
  | 'legacy_area_ambiguous';

export type AtlasFeatureAuthority =
  | AtlasFeatureOwner
  | 'view'
  | 'atmospheric'
  | 'hierarchy'
  | 'unresolved';

export type AtlasCanonicalFeatureRef = {
  readonly kind: AtlasCanonicalFeatureKind;
  readonly id: string;
  readonly authority: AtlasFeatureAuthority;
  /** V1 storage slot this classification was derived from. */
  readonly v1Slot: 'stroke' | 'room' | 'wall' | 'object' | 'layer' | 'meta' | 'hierarchy';
  readonly secret?: boolean;
};

export type AtlasMigrationDisposition =
  | 'keep'
  | 'classify_only'
  | 'review_queue'
  | 'reject_parse'
  | 'deferred_ticket';

export type AtlasMigrationMatrixRow = {
  readonly source: string;
  readonly disposition: AtlasMigrationDisposition;
  readonly notes: string;
};

/** Drawn map geometry vs hierarchy identity — hard product rule (#1196 Design §3). */
export const DRAWN_ROOM_VS_WORLD_NODE = {
  drawnKind: 'floor_plan_room' as const,
  hierarchyKind: 'world_node_ref' as const,
  autoCreateWorldNodeFromDrawnRoom: false,
} as const;

export const ATLAS_FEATURE_AUTHORITY: Readonly<
  Record<AtlasCanonicalFeatureKind, AtlasFeatureAuthority>
> = {
  terrain_area: 'terrain',
  political_area: 'political',
  path_way: 'terrain',
  path_river: 'terrain',
  building_footprint: 'terrain',
  floor_plan_room: 'room_geometry',
  wall: 'room_geometry',
  door: 'room_geometry',
  prop_object: 'room_geometry',
  heightfield: 'terrain',
  layer_toggle: 'view',
  raster_reference: 'atmospheric',
  world_node_ref: 'hierarchy',
  legacy_area_ambiguous: 'unresolved',
};

export const ATLAS_REQUIRED_EDIT_OPS: readonly string[] = [
  'add_object',
  'move_object',
  'transform_object',
  'remove_object',
  'add_room',
  'move_room',
  'resize_room',
  'remove_room',
  'add_wall',
  'move_wall',
  'remove_wall',
  'replace_scene',
] as const;

export const ATLAS_DEFERRED_EDIT_OPS: readonly string[] = [
  'add_door',
  'add_political_area',
  'paint_heightfield',
  'link_geometry_to_world_node',
] as const;

export const ATLAS_MIGRATION_MATRIX: readonly AtlasMigrationMatrixRow[] = [
  {
    source: 'valid V1 UnifiedCanvasDoc',
    disposition: 'classify_only',
    notes: 'Keep wire; classify in memory; no silent rewrite',
  },
  {
    source: 'empty / missing unifiedCanvas',
    disposition: 'keep',
    notes: 'Caller emptyUnifiedCanvasDoc; do not invent coasts',
  },
  {
    source: 'rooms[] without owner hint',
    disposition: 'review_queue',
    notes: 'legacy_area_ambiguous — never auto political_area',
  },
  {
    source: 'stroke material wasser',
    disposition: 'classify_only',
    notes: 'path_river',
  },
  {
    source: 'stroke other materials',
    disposition: 'classify_only',
    notes: 'path_way',
  },
  {
    source: 'walls[]',
    disposition: 'classify_only',
    notes: 'wall',
  },
  {
    source: 'objects haus/turm',
    disposition: 'classify_only',
    notes: 'building_footprint stamp — still not WorldNode',
  },
  {
    source: 'objects other / secret',
    disposition: 'classify_only',
    notes: 'prop_object; preserve secret',
  },
  {
    source: 'layers.* toggles',
    disposition: 'keep',
    notes: 'view only — not world fact',
  },
  {
    source: 'basemap / azgaar storage path',
    disposition: 'classify_only',
    notes: 'raster_reference',
  },
  {
    source: 'legacy WebGL localStorage',
    disposition: 'deferred_ticket',
    notes: 'B04 read/import only; never SoT',
  },
  {
    source: 'unknown format string',
    disposition: 'reject_parse',
    notes: 'Existing parseUnifiedCanvasDoc returns null',
  },
  {
    source: 'WorldNode hierarchy rows',
    disposition: 'keep',
    notes: 'Out of B01 geometry rewrite; world_node_ref only by explicit link',
  },
] as const;

const BUILDING_STAMPS: ReadonlySet<UnifiedCanvasStampType> = new Set(['haus', 'turm']);

const TERRAIN_MATERIALS: ReadonlySet<UnifiedCanvasMaterial> = new Set([
  'gras',
  'erde',
  'sand',
  'wasser',
  'stein',
  'holz',
  'pflaster',
]);

export function isAtlasFeatureId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertAtlasFeatureId(id: string): void {
  if (!isAtlasFeatureId(id)) {
    throw new Error('Atlas feature id must be a non-empty string');
  }
}

/**
 * Classify a V1 stroke without mutating it.
 */
export function classifyStroke(stroke: UnifiedCanvasStroke): AtlasCanonicalFeatureRef {
  assertAtlasFeatureId(stroke.id);
  const kind: AtlasCanonicalFeatureKind =
    stroke.material === 'wasser' ? 'path_river' : 'path_way';
  return {
    kind,
    id: stroke.id,
    authority: ATLAS_FEATURE_AUTHORITY[kind],
    v1Slot: 'stroke',
  };
}

/**
 * Classify a V1 room polygon/AABB.
 * Without an explicit owner hint, ambiguous polygons stay unresolved (no political invent).
 */
export function classifyRoom(
  room: UnifiedCanvasRoom,
  hint?: AtlasFeatureOwner | null,
): AtlasCanonicalFeatureRef {
  assertAtlasFeatureId(room.id);
  // Material alone never invents political borders. Without an explicit owner
  // hint the area stays unresolved for B02 review — no silent reclassification.
  let kind: AtlasCanonicalFeatureKind;
  if (hint === 'political') {
    kind = 'political_area';
  } else if (hint === 'room_geometry') {
    kind = 'floor_plan_room';
  } else if (hint === 'terrain') {
    kind = TERRAIN_MATERIALS.has(room.material) ? 'terrain_area' : 'legacy_area_ambiguous';
  } else {
    kind = 'legacy_area_ambiguous';
  }
  return {
    kind,
    id: room.id,
    authority: ATLAS_FEATURE_AUTHORITY[kind],
    v1Slot: 'room',
    ...(room.secret === true ? { secret: true } : {}),
  };
}

/**
 * Golden / world-scale rooms: treat as terrain_area without political promotion.
 * Interior maps should pass hint `'room_geometry'`.
 */
export function classifyRoomForMapScale(
  room: UnifiedCanvasRoom,
  scale: 'world' | 'interior' | 'unknown',
): AtlasCanonicalFeatureRef {
  if (scale === 'interior') return classifyRoom(room, 'room_geometry');
  if (scale === 'world') return classifyRoom(room, 'terrain');
  return classifyRoom(room, null);
}

export function classifyWall(wall: UnifiedCanvasWall): AtlasCanonicalFeatureRef {
  assertAtlasFeatureId(wall.id);
  return {
    kind: 'wall',
    id: wall.id,
    authority: ATLAS_FEATURE_AUTHORITY.wall,
    v1Slot: 'wall',
  };
}

export function classifyObject(object: UnifiedCanvasObject): AtlasCanonicalFeatureRef {
  assertAtlasFeatureId(object.id);
  const kind: AtlasCanonicalFeatureKind = BUILDING_STAMPS.has(object.type)
    ? 'building_footprint'
    : 'prop_object';
  return {
    kind,
    id: object.id,
    authority: ATLAS_FEATURE_AUTHORITY[kind],
    v1Slot: 'object',
    ...(object.secret === true ? { secret: true } : {}),
  };
}

export type AtlasCanonicalDocClassification = {
  readonly catalogVersion: typeof ATLAS_CANONICAL_CATALOG_VERSION;
  readonly wireDecision: typeof ATLAS_WIRE_FORMAT_DECISION;
  readonly features: readonly AtlasCanonicalFeatureRef[];
  readonly counts: Readonly<Record<AtlasCanonicalFeatureKind, number>>;
};

function emptyCounts(): Record<AtlasCanonicalFeatureKind, number> {
  return {
    terrain_area: 0,
    political_area: 0,
    path_way: 0,
    path_river: 0,
    building_footprint: 0,
    floor_plan_room: 0,
    wall: 0,
    door: 0,
    prop_object: 0,
    heightfield: 0,
    layer_toggle: 0,
    raster_reference: 0,
    world_node_ref: 0,
    legacy_area_ambiguous: 0,
  };
}

/**
 * Classify an entire V1 document. Does not mutate `doc`.
 * `scale` defaults to `world` for Golden/coast-heavy docs; callers with interior
 * primary maps should pass `interior`.
 */
export function classifyUnifiedCanvasDoc(
  doc: UnifiedCanvasDoc,
  scale: 'world' | 'interior' | 'unknown' = 'world',
): AtlasCanonicalDocClassification {
  const features: AtlasCanonicalFeatureRef[] = [];
  for (const stroke of doc.strokes) features.push(classifyStroke(stroke));
  for (const room of doc.rooms) features.push(classifyRoomForMapScale(room, scale));
  for (const wall of doc.walls) features.push(classifyWall(wall));
  for (const object of doc.objects) features.push(classifyObject(object));

  for (const layerId of Object.keys(doc.layers)) {
    features.push({
      kind: 'layer_toggle',
      id: `layer:${layerId}`,
      authority: 'view',
      v1Slot: 'layer',
    });
  }

  const counts = emptyCounts();
  for (const f of features) counts[f.kind] += 1;

  return {
    catalogVersion: ATLAS_CANONICAL_CATALOG_VERSION,
    wireDecision: ATLAS_WIRE_FORMAT_DECISION,
    features,
    counts,
  };
}

/**
 * True when classification invents no political areas and keeps secrets.
 */
export function classificationRespectsLegacySafety(
  classified: AtlasCanonicalDocClassification,
  source: UnifiedCanvasDoc,
): boolean {
  if (classified.counts.political_area > 0) return false;
  const secretIds = new Set(
    source.objects.filter((o) => o.secret === true).map((o) => o.id),
  );
  for (const f of classified.features) {
    if (secretIds.has(f.id) && f.secret !== true) return false;
  }
  return true;
}
