/**
 * atlas-product-geometry-plan — ATL2-D02 canonical UnifiedCanvasDoc → 3D mesh plan.
 * Location: src/domains/world/atlas/atlas-product-geometry-plan.ts
 *
 * Pure domain — no React / Host. Productive 3D target is custom WebGL
 * (ATL2-D01); this plan is the SoT projection for areas/paths/walls/doors/
 * rooms/props/building footprints. Does not duplicate persisted geometry.
 */

import { heightfieldContentFingerprint } from './atlas-heightfield';
import { triangulatePolygon } from './canvas-polygon';
import { wallPointAt, type UnifiedCanvasDoc, type UnifiedCanvasDoor, type UnifiedCanvasWall } from './unified-canvas-doc';
import { classifyUnifiedCanvasDoc, type AtlasCanonicalFeatureKind } from './atlas-canonical-features';

export type AtlasProductGeometryKind =
  | 'area'
  | 'path'
  | 'wall'
  | 'door'
  | 'room'
  | 'prop'
  | 'building_footprint';

export type AtlasProductGeometryPrimitive =
  | {
      readonly kind: 'area' | 'room';
      readonly id: string;
      readonly canonicalKind: AtlasCanonicalFeatureKind | null;
      readonly triangles: readonly (readonly [number, number, number])[];
      readonly points: readonly (readonly [number, number])[];
      readonly elevation: number;
    }
  | {
      readonly kind: 'path';
      readonly id: string;
      readonly canonicalKind: AtlasCanonicalFeatureKind | null;
      readonly points: readonly (readonly [number, number])[];
      readonly width: number;
    }
  | {
      readonly kind: 'wall';
      readonly id: string;
      readonly canonicalKind: 'wall';
      readonly start: readonly [number, number];
      readonly end: readonly [number, number];
      readonly width: number;
      readonly doorIds: readonly string[];
    }
  | {
      readonly kind: 'door';
      readonly id: string;
      readonly canonicalKind: 'door';
      readonly wallId: string;
      readonly t: number;
      readonly width: number;
      readonly position: readonly [number, number];
      readonly tangent: readonly [number, number];
      readonly normal: readonly [number, number];
    }
  | {
      readonly kind: 'prop' | 'building_footprint';
      readonly id: string;
      readonly canonicalKind: AtlasCanonicalFeatureKind | null;
      readonly x: number;
      readonly y: number;
      readonly size: number;
      readonly elevation: number;
      readonly height: number;
      readonly stamp: string;
    };

export type AtlasProductGeometryPlan = {
  readonly format: 'atl2-product-geometry-plan-v1';
  readonly primitives: readonly AtlasProductGeometryPrimitive[];
  readonly counts: Readonly<Record<AtlasProductGeometryKind, number>>;
  /** Stable fingerprint for runtime scene-diff (skip rebuild when unchanged). */
  readonly contentFingerprint: string;
};

function emptyCounts(): Record<AtlasProductGeometryKind, number> {
  return {
    area: 0,
    path: 0,
    wall: 0,
    door: 0,
    room: 0,
    prop: 0,
    building_footprint: 0,
  };
}

function doorPlacement(
  wall: UnifiedCanvasWall,
  door: UnifiedCanvasDoor,
): {
  readonly position: readonly [number, number];
  readonly tangent: readonly [number, number];
  readonly normal: readonly [number, number];
} | null {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;
  const len = Math.hypot(dx, dy);
  if (!(len > 1e-6)) return null;
  const tx = dx / len;
  const ty = dy / len;
  const position = wallPointAt(wall, door.t);
  return {
    position,
    tangent: [tx, ty],
    normal: [-ty, tx],
  };
}

/**
 * Build a render plan from the canonical canvas doc.
 * Classification is advisory for kind labels; wire slots remain authoritative.
 */
export function buildAtlasProductGeometryPlan(
  doc: UnifiedCanvasDoc,
  options?: { readonly mapScale?: 'world' | 'settlement' | 'interior' },
): AtlasProductGeometryPlan {
  const mapScale = options?.mapScale ?? 'world';
  const classifyScale = mapScale === 'interior' ? 'interior' : 'world';
  const classified = classifyUnifiedCanvasDoc(doc, { scale: classifyScale });
  const byId = new Map(classified.features.map((f) => [f.id, f.kind] as const));
  const wallsById = new Map(doc.walls.map((w) => [w.id, w] as const));
  const doorsByWall = new Map<string, string[]>();
  for (const d of doc.doors ?? []) {
    const list = doorsByWall.get(d.wallId) ?? [];
    list.push(d.id);
    doorsByWall.set(d.wallId, list);
  }

  const primitives: AtlasProductGeometryPrimitive[] = [];
  const counts = emptyCounts();

  for (const room of doc.rooms) {
    const canonicalKind = byId.get(room.id) ?? null;
    const isInteriorRoom =
      canonicalKind === 'floor_plan_room' || mapScale === 'interior';
    const points =
      room.points && room.points.length >= 3
        ? room.points.map((p) => [p[0], p[1]] as const)
        : ([
            [room.x, room.y],
            [room.x + room.w, room.y],
            [room.x + room.w, room.y + room.h],
            [room.x, room.y + room.h],
          ] as const);
    const triangles = triangulatePolygon(points) ?? [];
    const kind: 'area' | 'room' = isInteriorRoom ? 'room' : 'area';
    primitives.push({
      kind,
      id: room.id,
      canonicalKind,
      triangles,
      points,
      elevation: 0,
    });
    counts[kind] += 1;
  }

  for (const stroke of doc.strokes) {
    primitives.push({
      kind: 'path',
      id: stroke.id,
      canonicalKind: byId.get(stroke.id) ?? null,
      points: stroke.points.map((p) => [p[0], p[1]] as const),
      width: stroke.width,
    });
    counts.path += 1;
  }

  for (const wall of doc.walls) {
    primitives.push({
      kind: 'wall',
      id: wall.id,
      canonicalKind: 'wall',
      start: [wall.x1, wall.y1],
      end: [wall.x2, wall.y2],
      width: wall.width,
      doorIds: doorsByWall.get(wall.id) ?? [],
    });
    counts.wall += 1;
  }

  for (const door of doc.doors ?? []) {
    const wall = wallsById.get(door.wallId);
    if (!wall) continue;
    const place = doorPlacement(wall, door);
    if (!place) continue;
    primitives.push({
      kind: 'door',
      id: door.id,
      canonicalKind: 'door',
      wallId: door.wallId,
      t: door.t,
      width: door.width,
      position: place.position,
      tangent: place.tangent,
      normal: place.normal,
    });
    counts.door += 1;
  }

  for (const obj of doc.objects) {
    const canonicalKind = byId.get(obj.id) ?? null;
    const isFootprint =
      canonicalKind === 'building_footprint' || obj.type === 'haus' || obj.type === 'turm';
    const kind: 'prop' | 'building_footprint' = isFootprint ? 'building_footprint' : 'prop';
    primitives.push({
      kind,
      id: obj.id,
      canonicalKind,
      x: obj.x,
      y: obj.y,
      size: obj.size,
      elevation: typeof obj.z === 'number' && Number.isFinite(obj.z) ? obj.z : 0,
      height: typeof obj.height === 'number' && obj.height > 0 ? obj.height : 1,
      stamp: obj.type,
    });
    counts[kind] += 1;
  }

  const contentFingerprint = [
    `r${doc.rooms.length}`,
    `s${doc.strokes.length}`,
    `w${doc.walls.length}`,
    `d${(doc.doors ?? []).length}`,
    `o${doc.objects.length}`,
    heightfieldContentFingerprint(doc.heightfield),
    ...primitives.map((p) => {
      if (p.kind === 'door') {
        return `door:${p.id}:${p.wallId}:${p.t.toFixed(4)}:${p.width}`;
      }
      if (p.kind === 'wall') {
        return `wall:${p.id}:${p.start.join(',')}:${p.end.join(',')}:${p.width}:doors=${p.doorIds.join('+')}`;
      }
      if (p.kind === 'path') {
        return `path:${p.id}:${p.points.length}:${p.width}`;
      }
      if (p.kind === 'area' || p.kind === 'room') {
        return `${p.kind}:${p.id}:tris=${p.triangles.length}`;
      }
      if (p.kind === 'prop' || p.kind === 'building_footprint') {
        return `${p.kind}:${p.id}:${p.x},${p.y}:${p.size}:${p.elevation}:${p.height}:${p.stamp}`;
      }
      return `${p.kind}:${p.id}`;
    }),
  ].join('|');

  return {
    format: 'atl2-product-geometry-plan-v1',
    primitives,
    counts,
    contentFingerprint,
  };
}

/** Door openings that must appear in the productive WebGL seed. */
export function planDoorSeeds(
  doc: UnifiedCanvasDoc,
): readonly {
  readonly id: string;
  readonly wallId: string;
  readonly t: number;
  readonly width: number;
  readonly x: number;
  readonly z: number;
  readonly tx: number;
  readonly tz: number;
  readonly nx: number;
  readonly nz: number;
}[] {
  const wallsById = new Map(doc.walls.map((w) => [w.id, w] as const));
  const out: {
    id: string;
    wallId: string;
    t: number;
    width: number;
    x: number;
    z: number;
    tx: number;
    tz: number;
    nx: number;
    nz: number;
  }[] = [];
  for (const door of doc.doors ?? []) {
    const wall = wallsById.get(door.wallId);
    if (!wall) continue;
    const place = doorPlacement(wall, door);
    if (!place) continue;
    out.push({
      id: door.id,
      wallId: door.wallId,
      t: door.t,
      width: door.width,
      x: place.position[0],
      z: place.position[1],
      tx: place.tangent[0],
      tz: place.tangent[1],
      nx: place.normal[0],
      nz: place.normal[1],
    });
  }
  return out;
}
