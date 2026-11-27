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

export const SPATIAL_ARCHIVE_META_KEY = 'spatialArchive' as const;

export type SpatialArchivedEntityRecord = {
  readonly entityId: string;
  readonly featureId: string;
  readonly kind: 'map_frame' | 'object' | 'room';
  readonly archivedByEntityId: string;
  readonly object?: UnifiedCanvasObject;
  readonly room?: UnifiedCanvasRoom;
};

export type SpatialArchiveMeta = readonly SpatialArchivedEntityRecord[];

export function extractSpatialArchiveFromGeneratorMeta(
  meta: Readonly<Record<string, unknown>> | null | undefined,
): SpatialArchiveMeta {
  if (!meta) return [];
  const raw = meta[SPATIAL_ARCHIVE_META_KEY];
  if (!Array.isArray(raw)) return [];
  const out: SpatialArchivedEntityRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    if (
      typeof rec.entityId !== 'string' ||
      typeof rec.featureId !== 'string' ||
      typeof rec.archivedByEntityId !== 'string' ||
      (rec.kind !== 'map_frame' && rec.kind !== 'object' && rec.kind !== 'room')
    ) {
      continue;
    }
    out.push({
      entityId: rec.entityId,
      featureId: rec.featureId,
      kind: rec.kind,
      archivedByEntityId: rec.archivedByEntityId,
      ...(rec.kind === 'object' && rec.object && typeof rec.object === 'object'
        ? { object: rec.object as UnifiedCanvasObject }
        : {}),
      ...(rec.kind === 'room' && rec.room && typeof rec.room === 'object'
        ? { room: rec.room as UnifiedCanvasRoom }
        : {}),
    });
  }
  return out;
}

export function mergeSpatialArchiveIntoGeneratorMeta(
  meta: Readonly<Record<string, unknown>> | null | undefined,
  archive: SpatialArchiveMeta,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(meta ?? {}) };
  if (archive.length === 0) {
    delete next[SPATIAL_ARCHIVE_META_KEY];
  } else {
    next[SPATIAL_ARCHIVE_META_KEY] = archive;
  }
  return next;
}

export type SpatialMapSourceInput = {
  readonly mapId: string;
  readonly title: string;
  readonly role: SpatialStructureRole;
  readonly parentMapId: string | null;
  readonly parentAnchor: ParentSpatialAnchor | null;
  readonly bounds?: WorldAtlasBounds;
  readonly doc: UnifiedCanvasDoc;
  readonly spatialArchive?: SpatialArchiveMeta;
};

export type ProjectedMapMutation = {
  readonly mapId: string;
  readonly nextDoc: UnifiedCanvasDoc;
  readonly nextParentAnchor?: ParentSpatialAnchor | null;
  readonly nextSpatialArchive?: SpatialArchiveMeta;
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

function mapDepthInNodes(
  mapNodes: Readonly<Record<string, AtlasWorldSpaceNode>>,
  mapId: string,
): number {
  let depth = 0;
  let cur = mapNodes[mapId];
  const seen = new Set<string>();
  while (cur?.parentAnchor) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    depth += 1;
    cur = mapNodes[cur.parentAnchor.parentMapId];
  }
  return depth;
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

  // 1. Register each map frame as a spatial container entity (preserving persisted soft-archive state)
  for (const s of sources) {
    const b = s.bounds ?? DEFAULT_ATLAS_BOUNDS;
    const worldBounds = projectLocalRectToWorldBounds(mapNodes, s.mapId, b.minX, b.minY, b.maxX, b.maxY);
    if (!worldBounds) continue;
    const id = mapEntityId(s.mapId);
    const frameArchive = s.spatialArchive?.find((rec) => rec.kind === 'map_frame');
    entities[id] = {
      id,
      mapId: s.mapId,
      featureId: '__map_frame__',
      labelDe: s.title,
      role: s.role,
      carrierId: s.parentMapId ? mapEntityId(s.parentMapId) : null,
      boundsWorld: worldBounds,
      polygonWorld: rectPointsFromBounds(worldBounds),
      status: frameArchive ? 'archived' : 'active',
      ...(frameArchive ? { archivedByEntityId: frameArchive.archivedByEntityId } : {}),
    };
  }

  const registerObjectEntity = (
    s: SpatialMapSourceInput,
    carrierId: string,
    carrier: SpatialEntityNode,
    obj: UnifiedCanvasObject,
    archivedByEntityId?: string,
  ): void => {
    if (obj.id.startsWith('der.')) return;
    const half = Math.max(4, (obj.size || 0.5) * 18);
    const rawWorld = projectLocalRectToWorldBounds(
      mapNodes,
      s.mapId,
      obj.x - half,
      obj.y - half,
      obj.x + half,
      obj.y + half,
    );
    if (!rawWorld) return;
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
      status: archivedByEntityId ? 'archived' : 'active',
      ...(archivedByEntityId ? { archivedByEntityId } : {}),
    };
  };

  // 2. Register canonical objects & strokes per map (skipping `der.*` derived mirrors)
  for (const s of sources) {
    const carrierId = mapEntityId(s.mapId);
    const carrier = entities[carrierId];
    if (!carrier) continue;

    const activeObjectIds = new Set<string>();
    for (const obj of s.doc.objects) {
      if (obj.id.startsWith('der.')) continue;
      activeObjectIds.add(obj.id);
      registerObjectEntity(s, carrierId, carrier, obj);
    }

    // Rehydrate persisted soft-archived objects and rooms so restore survives reload.
    for (const rec of s.spatialArchive ?? []) {
      if (rec.kind === 'object' && rec.object && !activeObjectIds.has(rec.featureId)) {
        registerObjectEntity(s, carrierId, carrier, rec.object, rec.archivedByEntityId);
      } else if (rec.kind === 'room' && rec.room) {
        const alreadyActive = s.doc.rooms.some((r) => r.id === rec.featureId);
        if (!alreadyActive) {
          const room = rec.room;
          const rawWorld = projectLocalRectToWorldBounds(
            mapNodes,
            s.mapId,
            room.x,
            room.y,
            room.x + room.w,
            room.y + room.h,
          );
          if (rawWorld) {
            const entityId = `room:${s.mapId}:${room.id}`;
            entities[entityId] = {
              id: entityId,
              mapId: s.mapId,
              featureId: room.id,
              labelDe: `Raum (${room.id})`,
              role: 'room',
              carrierId,
              boundsWorld: rawWorld,
              polygonWorld: rectPointsFromBounds(rawWorld),
              status: 'archived',
              archivedByEntityId: rec.archivedByEntityId,
            };
          }
        }
      }
    }

    // Group clipped freeland stroke segments (`<baseId>#clip<i>`) under their base entity id.
    const strokeGroups = new Map<
      string,
      { primary: UnifiedCanvasStroke; segments: SpatialPoint2D[][] }
    >();
    for (const stroke of s.doc.strokes) {
      if (stroke.id.startsWith('der.') || stroke.points.length < 2) continue;
      const worldPts: SpatialPoint2D[] = [];
      for (const [lx, ly] of stroke.points) {
        const w = localToWorld(mapNodes, s.mapId, { x: lx, y: ly });
        if (!isAtlasWorldError(w)) worldPts.push([w.value.x, w.value.y]);
      }
      if (worldPts.length < 2) continue;
      const clipIdx = stroke.id.indexOf('#clip');
      const baseId = clipIdx > 0 ? stroke.id.slice(0, clipIdx) : stroke.id;
      const group = strokeGroups.get(baseId);
      if (group) {
        group.segments.push(worldPts);
      } else {
        strokeGroups.set(baseId, { primary: stroke, segments: [worldPts] });
      }
    }
    for (const [baseId, group] of strokeGroups) {
      const allPts: SpatialPoint2D[] = [];
      for (const seg of group.segments) allPts.push(...seg);
      const wb = boundsFromPoints(allPts);
      if (!wb) continue;
      const entityId = `stroke:${s.mapId}:${baseId}`;
      entities[entityId] = {
        id: entityId,
        mapId: s.mapId,
        featureId: baseId,
        labelDe:
          group.primary.material === 'wasser' ? `Fluss (${baseId})` : `Straße (${baseId})`,
        role: roleForStroke(group.primary),
        relation: 'freeland',
        carrierId,
        boundsWorld: wb,
        polylineWorld: group.segments[0]!,
        clippedSegmentsWorld: group.segments,
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
  readonly spatialArchiveByMapId?: Readonly<Record<string, SpatialArchiveMeta>>;
}): readonly ProjectedMapMutation[] {
  const { world, plan, docsByMapId, mapNodes, spatialArchiveByMapId } = input;
  const docCopies = new Map<string, UnifiedCanvasDoc>();
  const anchorUpdates = new Map<string, ParentSpatialAnchor>();
  const archiveCopies = new Map<string, SpatialArchivedEntityRecord[]>();
  // Mutable working copy updated top-down so child map frames & objects inside a grown
  // parent project into the parent's NEW coordinate frame (never the stale pre-grow frame).
  const effectiveMapNodes: Record<string, AtlasWorldSpaceNode> = { ...mapNodes };

  const getDoc = (mapId: string): UnifiedCanvasDoc | null => {
    const cached = docCopies.get(mapId);
    if (cached) return cached;
    const base = docsByMapId[mapId];
    if (!base) return null;
    docCopies.set(mapId, base);
    return base;
  };

  const getArchive = (mapId: string): SpatialArchivedEntityRecord[] => {
    const cached = archiveCopies.get(mapId);
    if (cached) return cached;
    const base = [...(spatialArchiveByMapId?.[mapId] ?? [])];
    archiveCopies.set(mapId, base);
    return base;
  };

  // Pass 1 (Top-Down): Update all `__map_frame__` ParentSpatialAnchors from shallowest
  // ancestor to deepest child so every descendant projects against its parent's updated anchor.
  const frameChanges = plan.changes
    .filter((ch) => world.entities[ch.entityId]?.featureId === '__map_frame__')
    .sort((a, b) => mapDepthInNodes(mapNodes, a.mapId) - mapDepthInNodes(mapNodes, b.mapId));

  for (const ch of frameChanges) {
    const entity = world.entities[ch.entityId];
    if (!entity) continue;
    const node = effectiveMapNodes[entity.mapId];
    if (node?.parentAnchor) {
      const parentId = node.parentAnchor.parentMapId;
      const parentBounds = effectiveMapNodes[parentId]?.bounds ?? DEFAULT_ATLAS_BOUNDS;
      const pMin = worldToLocal(effectiveMapNodes, parentId, {
        x: entity.boundsWorld.minX,
        y: entity.boundsWorld.minY,
      });
      const pMax = worldToLocal(effectiveMapNodes, parentId, {
        x: entity.boundsWorld.maxX,
        y: entity.boundsWorld.maxY,
      });
      if (!isAtlasWorldError(pMin) && !isAtlasWorldError(pMax)) {
        const minX = Math.max(parentBounds.minX, Math.min(parentBounds.maxX, Math.min(pMin.value.x, pMax.value.x)));
        const maxX = Math.max(minX, Math.min(parentBounds.maxX, Math.max(pMin.value.x, pMax.value.x)));
        const minY = Math.max(parentBounds.minY, Math.min(parentBounds.maxY, Math.min(pMin.value.y, pMax.value.y)));
        const maxY = Math.max(minY, Math.min(parentBounds.maxY, Math.max(pMin.value.y, pMax.value.y)));
        const cx = round6((minX + maxX) / 2);
        const cy = round6((minY + maxY) / 2);
        const maxAllowedX = Math.max(1e-3, Math.floor(Math.min(cx - parentBounds.minX, parentBounds.maxX - cx) * 1_000_000) / 1_000_000);
        const maxAllowedY = Math.max(1e-3, Math.floor(Math.min(cy - parentBounds.minY, parentBounds.maxY - cy) * 1_000_000) / 1_000_000);
        const extX = Math.max(1, Math.min(round6((maxX - minX) / 2), maxAllowedX));
        const extY = Math.max(1, Math.min(round6((maxY - minY) / 2), maxAllowedY));
        const uniformExt =
          Math.abs(node.parentAnchor.rotationRad) > 1e-9
            ? Math.min(Math.max(extX, extY), maxAllowedX, maxAllowedY)
            : null;
        const nextAnchor: ParentSpatialAnchor = {
          ...node.parentAnchor,
          centerX: cx,
          centerY: cy,
          extentX: round6(uniformExt ?? extX),
          extentY: round6(uniformExt ?? extY),
        };
        anchorUpdates.set(entity.mapId, nextAnchor);
        effectiveMapNodes[entity.mapId] = {
          ...node,
          parentAnchor: nextAnchor,
        };
      }
    }
    // Persist soft-archive marker for map frames so archive/restore survives reload.
    if (entity.status === 'archived') {
      const arch = getArchive(entity.mapId).filter((r) => r.kind !== 'map_frame');
      arch.push({
        entityId: entity.id,
        featureId: '__map_frame__',
        kind: 'map_frame',
        archivedByEntityId: entity.archivedByEntityId ?? plan.targetEntityId,
      });
      archiveCopies.set(entity.mapId, arch);
    } else if (
      spatialArchiveByMapId?.[entity.mapId]?.some((r) => r.kind === 'map_frame') ||
      archiveCopies.get(entity.mapId)?.some((r) => r.kind === 'map_frame')
    ) {
      archiveCopies.set(
        entity.mapId,
        getArchive(entity.mapId).filter((r) => r.kind !== 'map_frame'),
      );
    }
    // Ensure the map is included in output mutations even if only its anchor or archive status changed
    getDoc(entity.mapId);
  }

  // Pass 2: Project non-frame features (objects, strokes, rooms) using `effectiveMapNodes`.
  for (const ch of plan.changes) {
    const entity = world.entities[ch.entityId];
    if (!entity || entity.featureId === '__map_frame__') continue;

    const curDoc = getDoc(entity.mapId);
    if (!curDoc) continue;

    // Object update / soft-archive / restore
    const objIdx = curDoc.objects.findIndex((o) => o.id === entity.featureId);
    const archivedObjRec = getArchive(entity.mapId).find(
      (r) => r.kind === 'object' && r.featureId === entity.featureId,
    );
    if (objIdx >= 0 || archivedObjRec?.object) {
      if (entity.status === 'archived') {
        if (objIdx >= 0) {
          const prevObj = curDoc.objects[objIdx]!;
          const arch = getArchive(entity.mapId).filter(
            (r) => !(r.kind === 'object' && r.featureId === entity.featureId),
          );
          arch.push({
            entityId: entity.id,
            featureId: entity.featureId,
            kind: 'object',
            archivedByEntityId: entity.archivedByEntityId ?? plan.targetEntityId,
            object: prevObj,
          });
          archiveCopies.set(entity.mapId, arch);
          docCopies.set(entity.mapId, {
            ...curDoc,
            objects: curDoc.objects.filter((o) => o.id !== entity.featureId),
          });
        }
      } else {
        const cx = (entity.boundsWorld.minX + entity.boundsWorld.maxX) / 2;
        const cy = (entity.boundsWorld.minY + entity.boundsWorld.maxY) / 2;
        const localCenter = worldToLocal(effectiveMapNodes, entity.mapId, { x: cx, y: cy });
        if (objIdx >= 0) {
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
        } else if (archivedObjRec?.object) {
          const restoredObj: UnifiedCanvasObject = !isAtlasWorldError(localCenter)
            ? {
                ...archivedObjRec.object,
                x: round3(localCenter.value.x),
                y: round3(localCenter.value.y),
              }
            : archivedObjRec.object;
          docCopies.set(entity.mapId, {
            ...curDoc,
            objects: [...curDoc.objects, restoredObj],
          });
        }
        if (archivedObjRec) {
          archiveCopies.set(
            entity.mapId,
            getArchive(entity.mapId).filter(
              (r) => !(r.kind === 'object' && r.featureId === entity.featureId),
            ),
          );
        }
      }
      continue;
    }

    // Stroke (freeland) update — persist every clipped segment (ID suffix `#clip<i>`)
    const strokeIdx = curDoc.strokes.findIndex((st) => st.id === entity.featureId);
    const polylineWorld = entity.polylineWorld;
    if (strokeIdx >= 0 && polylineWorld && polylineWorld.length >= 2) {
      const segments =
        entity.clippedSegmentsWorld && entity.clippedSegmentsWorld.length > 0
          ? entity.clippedSegmentsWorld
          : [polylineWorld];
      const localSegments: [number, number][][] = [];
      for (const segment of segments) {
        const localPts: [number, number][] = [];
        for (const [wx, wy] of segment) {
          const lp = worldToLocal(effectiveMapNodes, entity.mapId, { x: wx, y: wy });
          if (!isAtlasWorldError(lp)) localPts.push([round3(lp.value.x), round3(lp.value.y)]);
        }
        if (localPts.length >= 2) localSegments.push(localPts);
      }
      if (localSegments.length > 0) {
        const prevStroke = curDoc.strokes[strokeIdx]!;
        const clipPrefix = `${entity.featureId}#clip`;
        const insertAt = curDoc.strokes
          .slice(0, strokeIdx)
          .filter((st) => st.id !== entity.featureId && !st.id.startsWith(clipPrefix)).length;
        const nextStrokes = curDoc.strokes.filter(
          (st) => st.id !== entity.featureId && !st.id.startsWith(clipPrefix),
        );
        nextStrokes.splice(
          insertAt,
          0,
          ...localSegments.map((points, i) => ({
            ...prevStroke,
            id: i === 0 ? entity.featureId : `${entity.featureId}#clip${i}`,
            points,
          })),
        );
        docCopies.set(entity.mapId, { ...curDoc, strokes: nextStrokes });
      }
      continue;
    }

    // Room polygon update / soft-archive / restore
    const roomIdx = curDoc.rooms.findIndex((r) => r.id === entity.featureId);
    const archivedRoomRec = getArchive(entity.mapId).find(
      (r) => r.kind === 'room' && r.featureId === entity.featureId,
    );
    if (roomIdx >= 0 || archivedRoomRec?.room) {
      if (entity.status === 'archived') {
        if (roomIdx >= 0) {
          const prevRoom = curDoc.rooms[roomIdx]!;
          const arch = getArchive(entity.mapId).filter(
            (r) => !(r.kind === 'room' && r.featureId === entity.featureId),
          );
          arch.push({
            entityId: entity.id,
            featureId: entity.featureId,
            kind: 'room',
            archivedByEntityId: entity.archivedByEntityId ?? plan.targetEntityId,
            room: prevRoom,
          });
          archiveCopies.set(entity.mapId, arch);
          docCopies.set(entity.mapId, {
            ...curDoc,
            rooms: curDoc.rooms.filter((r) => r.id !== entity.featureId),
          });
        }
      } else {
        const baseRoom: UnifiedCanvasRoom =
          roomIdx >= 0 ? curDoc.rooms[roomIdx]! : archivedRoomRec!.room!;
        let nextRoom: UnifiedCanvasRoom = baseRoom;
        if (entity.polygonWorld && entity.polygonWorld.length >= 3) {
          const localPts: [number, number][] = [];
          for (const [wx, wy] of entity.polygonWorld) {
            const lp = worldToLocal(effectiveMapNodes, entity.mapId, { x: wx, y: wy });
            if (!isAtlasWorldError(lp)) localPts.push([round3(lp.value.x), round3(lp.value.y)]);
          }
          const rebuilt = roomFromPolygon(baseRoom.id, baseRoom.material, localPts);
          if (rebuilt) {
            nextRoom = baseRoom.secret ? { ...rebuilt, secret: true } : rebuilt;
          }
        }
        if (roomIdx >= 0) {
          const nextRooms = [...curDoc.rooms];
          nextRooms[roomIdx] = nextRoom;
          docCopies.set(entity.mapId, { ...curDoc, rooms: nextRooms });
        } else {
          docCopies.set(entity.mapId, { ...curDoc, rooms: [...curDoc.rooms, nextRoom] });
        }
        if (archivedRoomRec) {
          archiveCopies.set(
            entity.mapId,
            getArchive(entity.mapId).filter(
              (r) => !(r.kind === 'room' && r.featureId === entity.featureId),
            ),
          );
        }
      }
    }
  }

  const out: ProjectedMapMutation[] = [];
  const allMapIds = new Set<string>([
    ...docCopies.keys(),
    ...anchorUpdates.keys(),
    ...archiveCopies.keys(),
  ]);
  for (const mapId of allMapIds) {
    const nextDoc = docCopies.get(mapId) ?? docsByMapId[mapId];
    if (!nextDoc && !anchorUpdates.has(mapId) && !archiveCopies.has(mapId)) continue;
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
      ...(archiveCopies.has(mapId) ? { nextSpatialArchive: archiveCopies.get(mapId) } : {}),
    });
  }
  return out;
}
