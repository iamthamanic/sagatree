/**
 * atlas-spatial-world-bridge — SCM-03: Pure domain bridge between Multi-Map Docs and SpatialWorldModel.
 * Location: src/domains/world/atlas/atlas-spatial-world-bridge.ts
 *
 * Pure domain — NO React, NO Three.js, NO Host SDK (BR-005).
 *
 * Translates between the persisted multi-map representation (`AtlasWorldSpaceNode` +
 * `UnifiedCanvasDoc`) and the single authoritative `SpatialWorldModel`, using SWS-01
 * `localToWorld` / `worldToLocal` so every edit & propagation lands cleanly back in
 * the affected maps' local coordinates and `ParentSpatialAnchor` frames.
 */
import {
  buildCalibratedDefaultWorld,
  type CalibratedDefaultWorldBundle,
} from './atlas-default-world';
import {
  boundsFromPoints,
  rectPointsFromBounds,
  type SpatialBounds2D,
  type SpatialEntityNode,
  type SpatialPoint2D,
  type SpatialStructureRole,
  type SpatialWorldModel,
} from './atlas-spatial-containment';
import type { WorldOperationPlan } from './atlas-spatial-propagation';
import {
  isAtlasWorldError,
  localToWorld,
  worldToLocal,
  type AtlasWorldSpaceNode,
} from './atlas-world-space';
import type { ParentSpatialAnchor } from './map-frame';
import {
  roomFromPolygon,
  type UnifiedCanvasDoc,
  type UnifiedCanvasObject,
  type UnifiedCanvasRoom,
  type UnifiedCanvasStroke,
} from './unified-canvas-doc';
import { DEFAULT_ATLAS_BOUNDS, type WorldAtlasBounds } from './world-atlas.types';

export type SpatialMapSourceInput = {
  readonly mapId: string;
  readonly title: string;
  readonly role: SpatialStructureRole;
  readonly parentMapId: string | null;
  readonly parentAnchor: ParentSpatialAnchor | null;
  readonly bounds?: WorldAtlasBounds;
  readonly doc: UnifiedCanvasDoc;
};

export type ProjectedMapMutation = {
  readonly mapId: string;
  readonly nextDoc: UnifiedCanvasDoc;
  readonly nextParentAnchor?: ParentSpatialAnchor | null;
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function projectLocalRectToWorldBounds(
  mapNodes: Readonly<Record<string, AtlasWorldSpaceNode>>,
  mapId: string,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): SpatialBounds2D | null {
  const pts: SpatialPoint2D[] = [];
  for (const [lx, ly] of [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ] as const) {
    const w = localToWorld(mapNodes, mapId, { x: lx, y: ly });
    if (isAtlasWorldError(w)) return null;
    pts.push([w.value.x, w.value.y]);
  }
  return boundsFromPoints(pts);
}

function roleForStampType(type: UnifiedCanvasObject['type']): SpatialStructureRole {
  if (type === 'haus' || type === 'turm') return 'building';
  if (type === 'fels') return 'mountain';
  if (type === 'baum' || type === 'tanne') return 'forest';
  return 'prop';
}

function roleForStroke(stroke: UnifiedCanvasStroke): SpatialStructureRole {
  if (stroke.material === 'wasser') return 'river';
  return 'road';
}

/**
 * Construct a valid `SpatialWorldModel` from a hierarchy of maps + `UnifiedCanvasDoc`s.
 * Every map frame becomes a carrier entity in World Space, and its non-derived objects
 * and strokes become child entities (CONTAINED / CARVED / FLOWING) inside that carrier.
 */
export function buildSpatialWorldFromMapSources(
  sources: readonly SpatialMapSourceInput[],
): SpatialWorldModel | null {
  const rootSource = sources.find((s) => s.parentMapId === null);
  if (!rootSource) return null;

  const mapNodes: Record<string, AtlasWorldSpaceNode> = {};
  for (const s of sources) {
    mapNodes[s.mapId] = {
      id: s.mapId,
      parentAnchor: s.parentAnchor,
      bounds: s.bounds ?? DEFAULT_ATLAS_BOUNDS,
    };
  }

  const entities: Record<string, SpatialEntityNode> = {};
  const mapEntityId = (mapId: string) => `map:${mapId}`;

  // 1. Register each map frame as a spatial container entity
  for (const s of sources) {
    const b = s.bounds ?? DEFAULT_ATLAS_BOUNDS;
    const worldBounds = projectLocalRectToWorldBounds(mapNodes, s.mapId, b.minX, b.minY, b.maxX, b.maxY);
    if (!worldBounds) continue;
    const id = mapEntityId(s.mapId);
    entities[id] = {
      id,
      mapId: s.mapId,
      featureId: '__map_frame__',
      labelDe: s.title,
      role: s.role,
      carrierId: s.parentMapId ? mapEntityId(s.parentMapId) : null,
      boundsWorld: worldBounds,
      polygonWorld: rectPointsFromBounds(worldBounds),
      status: 'active',
    };
  }

  // 2. Register canonical objects & strokes per map (skipping `der.*` derived mirrors)
  for (const s of sources) {
    const carrierId = mapEntityId(s.mapId);
    const carrier = entities[carrierId];
    if (!carrier) continue;

    for (const obj of s.doc.objects) {
      if (obj.id.startsWith('der.')) continue;
      const half = Math.max(4, (obj.size || 0.5) * 18);
      const rawWorld = projectLocalRectToWorldBounds(
        mapNodes,
        s.mapId,
        obj.x - half,
        obj.y - half,
        obj.x + half,
        obj.y + half,
      );
      if (!rawWorld) continue;
      // Clamp footprint into carrier bounds for initial seed sanity
      const clamped: SpatialBounds2D = {
        minX: Math.max(carrier.boundsWorld.minX, Math.min(carrier.boundsWorld.maxX, rawWorld.minX)),
        minY: Math.max(carrier.boundsWorld.minY, Math.min(carrier.boundsWorld.maxY, rawWorld.minY)),
        maxX: Math.max(carrier.boundsWorld.minX, Math.min(carrier.boundsWorld.maxX, rawWorld.maxX)),
        maxY: Math.max(carrier.boundsWorld.minY, Math.min(carrier.boundsWorld.maxY, rawWorld.maxY)),
      };
      const entityId = `obj:${s.mapId}:${obj.id}`;
      entities[entityId] = {
        id: entityId,
        mapId: s.mapId,
        featureId: obj.id,
        labelDe: `${obj.type} (${obj.id})`,
        role: roleForStampType(obj.type),
        carrierId,
        boundsWorld: {
          minX: Math.min(clamped.minX, clamped.maxX),
          minY: Math.min(clamped.minY, clamped.maxY),
          maxX: Math.max(clamped.minX, clamped.maxX),
          maxY: Math.max(clamped.minY, clamped.maxY),
        },
        status: 'active',
      };
    }

    for (const stroke of s.doc.strokes) {
      if (stroke.id.startsWith('der.') || stroke.points.length < 2) continue;
      const worldPts: SpatialPoint2D[] = [];
      for (const [lx, ly] of stroke.points) {
        const w = localToWorld(mapNodes, s.mapId, { x: lx, y: ly });
        if (!isAtlasWorldError(w)) worldPts.push([w.value.x, w.value.y]);
      }
      if (worldPts.length < 2) continue;
      const wb = boundsFromPoints(worldPts);
      if (!wb) continue;
      const entityId = `stroke:${s.mapId}:${stroke.id}`;
      entities[entityId] = {
        id: entityId,
        mapId: s.mapId,
        featureId: stroke.id,
        labelDe: stroke.material === 'wasser' ? `Fluss (${stroke.id})` : `Straße (${stroke.id})`,
        role: roleForStroke(stroke),
        relation: 'FLOWING',
        carrierId,
        boundsWorld: wb,
        polylineWorld: worldPts,
        clippedSegmentsWorld: [worldPts],
        status: 'active',
      };
    }
  }

  return {
    rootTopographyId: mapEntityId(rootSource.mapId),
    entities,
    mapNodes,
  };
}

function roleForDefaultMapSeed(seedKey: string, kind: string): SpatialStructureRole {
  if (seedKey.includes('continent')) return 'continent';
  if (seedKey.includes('country')) return 'country';
  if (seedKey.includes('place')) return 'settlement';
  if (seedKey.includes('tavern') || kind === 'building') return 'building';
  if (seedKey.includes('taproom') || seedKey.includes('room')) return 'room';
  if (seedKey.includes('crypt') || seedKey.includes('mine') || seedKey.includes('vault') || seedKey.includes('fort')) {
    return 'dungeon';
  }
  return 'landmass';
}

/** Build a ready-to-use `SpatialWorldModel` directly from the calibrated Default World bundle. */
export function buildSpatialWorldFromDefaultWorld(
  bundle: CalibratedDefaultWorldBundle = buildCalibratedDefaultWorld(),
): SpatialWorldModel {
  const sources: SpatialMapSourceInput[] = [
    {
      mapId: bundle.rootSeedKey,
      title: 'Welt (Donalu)',
      role: 'world',
      parentMapId: null,
      parentAnchor: null,
      doc: bundle.rootDoc,
    },
  ];
  for (const m of bundle.maps) {
    const parentId = m.parentMapSeedKey ?? bundle.rootSeedKey;
    sources.push({
      mapId: m.seedKey,
      title: m.title,
      role: roleForDefaultMapSeed(m.seedKey, m.kind),
      parentMapId: parentId,
      parentAnchor: {
        parentMapId: parentId,
        centerX: m.parentAnchor.centerX,
        centerY: m.parentAnchor.centerY,
        extentX: m.parentAnchor.extentX,
        extentY: m.parentAnchor.extentY,
        rotationRad: m.parentAnchor.rotationRad,
        metersPerUnit: m.parentAnchor.metersPerUnit,
      },
      doc: m.buildCanvas(),
    });
  }
  const built = buildSpatialWorldFromMapSources(sources);
  if (!built) {
    throw new Error('buildSpatialWorldFromDefaultWorld: root missing');
  }
  return built;
}

/**
 * Project an executed `WorldOperationPlan` onto the affected per-map `UnifiedCanvasDoc`s
 * and `ParentSpatialAnchor`s so the persistence adapter (`WorldAtlasWorkbench`) and
 * dumb renderer (`AtlasThreeMultiMapGraph`) stay strictly decoupled from SCM rules.
 */
export function projectSpatialOperationToMapUpdates(input: {
  readonly world: SpatialWorldModel;
  readonly plan: WorldOperationPlan;
  readonly docsByMapId: Readonly<Record<string, UnifiedCanvasDoc>>;
  readonly mapNodes: Readonly<Record<string, AtlasWorldSpaceNode>>;
}): readonly ProjectedMapMutation[] {
  const { world, plan, docsByMapId, mapNodes } = input;
  const docCopies = new Map<string, UnifiedCanvasDoc>();
  const anchorUpdates = new Map<string, ParentSpatialAnchor>();

  const getDoc = (mapId: string): UnifiedCanvasDoc | null => {
    const cached = docCopies.get(mapId);
    if (cached) return cached;
    const base = docsByMapId[mapId];
    if (!base) return null;
    docCopies.set(mapId, base);
    return base;
  };

  for (const ch of plan.changes) {
    const entity = world.entities[ch.entityId];
    if (!entity) continue;

    // Map frame growth → recompute ParentSpatialAnchor in parent's local coordinates (SWS-01)
    if (entity.featureId === '__map_frame__') {
      const node = mapNodes[entity.mapId];
      if (node?.parentAnchor) {
        const pMin = worldToLocal(mapNodes, node.parentAnchor.parentMapId, {
          x: entity.boundsWorld.minX,
          y: entity.boundsWorld.minY,
        });
        const pMax = worldToLocal(mapNodes, node.parentAnchor.parentMapId, {
          x: entity.boundsWorld.maxX,
          y: entity.boundsWorld.maxY,
        });
        if (!isAtlasWorldError(pMin) && !isAtlasWorldError(pMax)) {
          const minX = Math.min(pMin.value.x, pMax.value.x);
          const maxX = Math.max(pMin.value.x, pMax.value.x);
          const minY = Math.min(pMin.value.y, pMax.value.y);
          const maxY = Math.max(pMin.value.y, pMax.value.y);
          const extX = Math.max(1, (maxX - minX) / 2);
          const extY = Math.max(1, (maxY - minY) / 2);
          const uniformExt =
            Math.abs(node.parentAnchor.rotationRad) > 1e-9 ? Math.max(extX, extY) : null;
          anchorUpdates.set(entity.mapId, {
            ...node.parentAnchor,
            centerX: round3((minX + maxX) / 2),
            centerY: round3((minY + maxY) / 2),
            extentX: round3(uniformExt ?? extX),
            extentY: round3(uniformExt ?? extY),
          });
        }
      }
      // Ensure the map is included in output mutations even if only its anchor grew
      getDoc(entity.mapId);
      continue;
    }

    const curDoc = getDoc(entity.mapId);
    if (!curDoc) continue;

    // Object update / soft-archive
    const objIdx = curDoc.objects.findIndex((o) => o.id === entity.featureId);
    if (objIdx >= 0) {
      if (entity.status === 'archived') {
        docCopies.set(entity.mapId, {
          ...curDoc,
          objects: curDoc.objects.filter((o) => o.id !== entity.featureId),
        });
      } else {
        const cx = (entity.boundsWorld.minX + entity.boundsWorld.maxX) / 2;
        const cy = (entity.boundsWorld.minY + entity.boundsWorld.maxY) / 2;
        const localCenter = worldToLocal(mapNodes, entity.mapId, { x: cx, y: cy });
        if (!isAtlasWorldError(localCenter)) {
          const prevObj = curDoc.objects[objIdx]!;
          const nextObjects = [...curDoc.objects];
          nextObjects[objIdx] = {
            ...prevObj,
            x: round3(localCenter.value.x),
            y: round3(localCenter.value.y),
          };
          docCopies.set(entity.mapId, { ...curDoc, objects: nextObjects });
        }
      }
      continue;
    }

    // Stroke (FLOWING) update
    const strokeIdx = curDoc.strokes.findIndex((st) => st.id === entity.featureId);
    if (strokeIdx >= 0 && entity.polylineWorld && entity.polylineWorld.length >= 2) {
      const localPts: [number, number][] = [];
      for (const [wx, wy] of entity.polylineWorld) {
        const lp = worldToLocal(mapNodes, entity.mapId, { x: wx, y: wy });
        if (!isAtlasWorldError(lp)) localPts.push([round3(lp.value.x), round3(lp.value.y)]);
      }
      if (localPts.length >= 2) {
        const prevStroke = curDoc.strokes[strokeIdx]!;
        const nextStrokes = [...curDoc.strokes];
        nextStrokes[strokeIdx] = { ...prevStroke, points: localPts };
        docCopies.set(entity.mapId, { ...curDoc, strokes: nextStrokes });
      }
      continue;
    }

    // Room polygon update / soft-archive
    const roomIdx = curDoc.rooms.findIndex((r) => r.id === entity.featureId);
    if (roomIdx >= 0) {
      if (entity.status === 'archived') {
        docCopies.set(entity.mapId, {
          ...curDoc,
          rooms: curDoc.rooms.filter((r) => r.id !== entity.featureId),
        });
      } else if (entity.polygonWorld && entity.polygonWorld.length >= 3) {
        const localPts: [number, number][] = [];
        for (const [wx, wy] of entity.polygonWorld) {
          const lp = worldToLocal(mapNodes, entity.mapId, { x: wx, y: wy });
          if (!isAtlasWorldError(lp)) localPts.push([round3(lp.value.x), round3(lp.value.y)]);
        }
        const prevRoom: UnifiedCanvasRoom = curDoc.rooms[roomIdx]!;
        const rebuilt = roomFromPolygon(prevRoom.id, prevRoom.material, localPts);
        if (rebuilt) {
          const nextRooms = [...curDoc.rooms];
          nextRooms[roomIdx] = prevRoom.secret ? { ...rebuilt, secret: true } : rebuilt;
          docCopies.set(entity.mapId, { ...curDoc, rooms: nextRooms });
        }
      }
    }
  }

  const out: ProjectedMapMutation[] = [];
  const allMapIds = new Set<string>([...docCopies.keys(), ...anchorUpdates.keys()]);
  for (const mapId of allMapIds) {
    const nextDoc = docCopies.get(mapId) ?? docsByMapId[mapId];
    if (!nextDoc && !anchorUpdates.has(mapId)) continue;
    out.push({
      mapId,
      nextDoc: nextDoc ?? {
        format: 'sagatree-unified-atlas-v1',
        layers: { terrain: true, roads: true, region: true, city: true, interior: true, drawings: true, objects: true, grid: false },
        strokes: [],
        objects: [],
        rooms: [],
        walls: [],
      },
      ...(anchorUpdates.has(mapId) ? { nextParentAnchor: anchorUpdates.get(mapId) } : {}),
    });
  }
  return out;
}
