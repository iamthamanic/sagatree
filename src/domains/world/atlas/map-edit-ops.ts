/**
 * map-edit-ops — validated edit operations for the shared atlas document.
 * Location: src/domains/world/atlas/map-edit-ops.ts
 *
 * Renderer-agnostic: Canvas2D and Three.js both apply the same ops to UnifiedCanvasDoc.
 */

import {
  applyHeightBrush,
  clearAtlasHeightfield,
  emptyAtlasHeightfield,
  parseAtlasHeightfield,
  serializeAtlasHeightfield,
  type AtlasHeightBrushStroke,
  type AtlasHeightfield,
} from './atlas-heightfield';
import {
  bboxFromPoints,
  pointInPolygon,
  translatePolygon,
  validateClosedPolygon,
} from './canvas-polygon';
import type {
  UnifiedCanvasDoc,
  UnifiedCanvasDoor,
  UnifiedCanvasObject,
  UnifiedCanvasRoom,
  UnifiedCanvasStroke,
  UnifiedCanvasWall,
} from './unified-canvas-doc';
import { rotateRoomRect, wallPointAt } from './unified-canvas-doc';

export type MapTransform = {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
  readonly angle?: number;
  readonly size?: number;
  readonly height?: number;
};

export type MapEditOperation =
  | { readonly op: 'add_object'; readonly object: UnifiedCanvasObject }
  | { readonly op: 'move_object'; readonly id: string; readonly x: number; readonly y: number; readonly z?: number }
  | { readonly op: 'transform_object'; readonly id: string; readonly patch: Partial<MapTransform> }
  | { readonly op: 'remove_object'; readonly id: string }
  | { readonly op: 'add_room'; readonly room: UnifiedCanvasRoom }
  | { readonly op: 'move_room'; readonly id: string; readonly x: number; readonly y: number }
  | { readonly op: 'resize_room'; readonly id: string; readonly w: number; readonly h: number }
  | { readonly op: 'remove_room'; readonly id: string }
  | { readonly op: 'add_wall'; readonly wall: UnifiedCanvasWall }
  | { readonly op: 'move_wall'; readonly id: string; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
  | { readonly op: 'remove_wall'; readonly id: string }
  | { readonly op: 'add_door'; readonly door: UnifiedCanvasDoor }
  | { readonly op: 'move_door'; readonly id: string; readonly t: number }
  | { readonly op: 'remove_door'; readonly id: string }
  | { readonly op: 'rotate_room'; readonly id: string; readonly angleRad: number }
  | { readonly op: 'add_stroke'; readonly stroke: UnifiedCanvasStroke }
  | {
      readonly op: 'append_stroke_point';
      readonly id: string;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly op: 'move_stroke_point';
      readonly id: string;
      readonly index: number;
      readonly x: number;
      readonly y: number;
    }
  | { readonly op: 'remove_stroke'; readonly id: string }
  | {
      readonly op: 'set_room_points';
      readonly id: string;
      readonly points: readonly (readonly [number, number])[];
    }
  | {
      readonly op: 'move_room_vertex';
      readonly id: string;
      readonly index: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly op: 'replace_scene';
      readonly rooms: readonly UnifiedCanvasRoom[];
      readonly walls: readonly UnifiedCanvasWall[];
      readonly objects?: readonly UnifiedCanvasObject[];
    }
  | { readonly op: 'ensure_heightfield'; readonly heightfield?: AtlasHeightfield }
  | { readonly op: 'paint_heightfield'; readonly stroke: AtlasHeightBrushStroke }
  | { readonly op: 'clear_heightfield' }
  | { readonly op: 'set_heightfield'; readonly heightfield: AtlasHeightfield | null };

/** UI brush radius (pixels-ish) clamped for world strokes (ATL2-C01). */
export const ATLAS_BRUSH_UI_MIN = 8;
export const ATLAS_BRUSH_UI_MAX = 120;

export function clampAtlasBrushUi(brushUi: number): number {
  if (!finite(brushUi)) return 45;
  return Math.min(ATLAS_BRUSH_UI_MAX, Math.max(ATLAS_BRUSH_UI_MIN, Math.round(brushUi)));
}

function finite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

export function applyMapEdit(doc: UnifiedCanvasDoc, edit: MapEditOperation): UnifiedCanvasDoc {
  switch (edit.op) {
    case 'add_object':
      return { ...doc, objects: [...doc.objects, edit.object], demoSeed: false };
    case 'move_object': {
      if (!finite(edit.x) || !finite(edit.y)) return doc;
      return {
        ...doc,
        objects: doc.objects.map((o) =>
          o.id === edit.id
            ? {
                ...o,
                x: edit.x,
                y: edit.y,
                ...(finite(edit.z) ? { z: edit.z } : {}),
              }
            : o,
        ),
        demoSeed: false,
      };
    }
    case 'transform_object': {
      return {
        ...doc,
        objects: doc.objects.map((o) => {
          if (o.id !== edit.id) return o;
          const next = { ...o };
          if (finite(edit.patch.x)) next.x = edit.patch.x;
          if (finite(edit.patch.y)) next.y = edit.patch.y;
          if (finite(edit.patch.z)) next.z = edit.patch.z;
          if (finite(edit.patch.angle)) next.angle = edit.patch.angle;
          if (finite(edit.patch.size) && edit.patch.size! > 0) next.size = edit.patch.size!;
          if (finite(edit.patch.height) && edit.patch.height! > 0) next.height = edit.patch.height;
          return next;
        }),
        demoSeed: false,
      };
    }
    case 'remove_object':
      return { ...doc, objects: doc.objects.filter((o) => o.id !== edit.id), demoSeed: false };
    case 'add_room':
      return { ...doc, rooms: [...doc.rooms, edit.room], demoSeed: false };
    case 'move_room': {
      if (!finite(edit.x) || !finite(edit.y)) return doc;
      return {
        ...doc,
        rooms: doc.rooms.map((r) => {
          if (r.id !== edit.id) return r;
          const dx = edit.x - r.x;
          const dy = edit.y - r.y;
          if (r.points && r.points.length >= 3) {
            return {
              ...r,
              x: edit.x,
              y: edit.y,
              points: translatePolygon(r.points, dx, dy),
            };
          }
          return { ...r, x: edit.x, y: edit.y };
        }),
        demoSeed: false,
      };
    }
    case 'resize_room': {
      if (!finite(edit.w) || !finite(edit.h) || edit.w <= 0 || edit.h <= 0) return doc;
      return {
        ...doc,
        rooms: doc.rooms.map((r) => (r.id === edit.id ? { ...r, w: edit.w, h: edit.h } : r)),
        demoSeed: false,
      };
    }
    case 'remove_room':
      return { ...doc, rooms: doc.rooms.filter((r) => r.id !== edit.id), demoSeed: false };
    case 'add_wall':
      return { ...doc, walls: [...doc.walls, edit.wall], demoSeed: false };
    case 'move_wall': {
      if (![edit.x1, edit.y1, edit.x2, edit.y2].every(finite)) return doc;
      return {
        ...doc,
        walls: doc.walls.map((w) =>
          w.id === edit.id
            ? { ...w, x1: edit.x1, y1: edit.y1, x2: edit.x2, y2: edit.y2 }
            : w,
        ),
        demoSeed: false,
      };
    }
    case 'remove_wall':
      return {
        ...doc,
        walls: doc.walls.filter((w) => w.id !== edit.id),
        doors: (doc.doors ?? []).filter((d) => d.wallId !== edit.id),
        demoSeed: false,
      };
    case 'add_door': {
      const wallOk = doc.walls.some((w) => w.id === edit.door.wallId);
      if (!wallOk) return doc;
      if (!(edit.door.t >= 0 && edit.door.t <= 1) || !(edit.door.width > 0)) return doc;
      return {
        ...doc,
        doors: [...(doc.doors ?? []), edit.door],
        demoSeed: false,
      };
    }
    case 'move_door': {
      if (!(edit.t >= 0 && edit.t <= 1)) return doc;
      return {
        ...doc,
        doors: (doc.doors ?? []).map((d) => (d.id === edit.id ? { ...d, t: edit.t } : d)),
        demoSeed: false,
      };
    }
    case 'remove_door':
      return {
        ...doc,
        doors: (doc.doors ?? []).filter((d) => d.id !== edit.id),
        demoSeed: false,
      };
    case 'rotate_room': {
      if (!finite(edit.angleRad)) return doc;
      return {
        ...doc,
        rooms: doc.rooms.map((r) => (r.id === edit.id ? rotateRoomRect(r, edit.angleRad) : r)),
        demoSeed: false,
      };
    }
    case 'add_stroke':
      return { ...doc, strokes: [...doc.strokes, edit.stroke], demoSeed: false };
    case 'append_stroke_point': {
      if (!finite(edit.x) || !finite(edit.y)) return doc;
      return {
        ...doc,
        strokes: doc.strokes.map((s) =>
          s.id === edit.id
            ? { ...s, points: [...s.points, [edit.x, edit.y] as const] }
            : s,
        ),
        demoSeed: false,
      };
    }
    case 'move_stroke_point': {
      if (!finite(edit.x) || !finite(edit.y) || edit.index < 0) return doc;
      return {
        ...doc,
        strokes: doc.strokes.map((s) => {
          if (s.id !== edit.id || edit.index >= s.points.length) return s;
          const points = s.points.map((pt, i) =>
            i === edit.index ? ([edit.x, edit.y] as const) : pt,
          );
          return { ...s, points };
        }),
        demoSeed: false,
      };
    }
    case 'remove_stroke':
      return { ...doc, strokes: doc.strokes.filter((s) => s.id !== edit.id), demoSeed: false };
    case 'set_room_points': {
      const validated = validateClosedPolygon(edit.points);
      if (!validated.ok) return doc;
      const box = bboxFromPoints(validated.points);
      if (!box) return doc;
      return {
        ...doc,
        rooms: doc.rooms.map((r) =>
          r.id === edit.id
            ? {
                ...r,
                x: box.x,
                y: box.y,
                w: box.w,
                h: box.h,
                points: validated.points,
              }
            : r,
        ),
        demoSeed: false,
      };
    }
    case 'move_room_vertex': {
      if (!finite(edit.x) || !finite(edit.y) || edit.index < 0) return doc;
      return {
        ...doc,
        rooms: doc.rooms.map((r) => {
          if (r.id !== edit.id || !r.points || edit.index >= r.points.length) return r;
          const nextPts = r.points.map((pt, i) =>
            i === edit.index ? ([edit.x, edit.y] as const) : pt,
          );
          const validated = validateClosedPolygon(nextPts);
          if (!validated.ok) return r;
          const box = bboxFromPoints(validated.points);
          if (!box) return r;
          return {
            ...r,
            x: box.x,
            y: box.y,
            w: box.w,
            h: box.h,
            points: validated.points,
          };
        }),
        demoSeed: false,
      };
    }
    case 'replace_scene':
      return {
        ...doc,
        rooms: [...edit.rooms],
        walls: [...edit.walls],
        objects: edit.objects ? [...edit.objects] : doc.objects,
        // Wall identity changes → drop dangling doors (ATL2-C02).
        doors: [],
        demoSeed: false,
      };
    case 'ensure_heightfield': {
      if (doc.heightfield) return doc;
      const hf = edit.heightfield
        ? parseAtlasHeightfield(edit.heightfield) ?? emptyAtlasHeightfield()
        : emptyAtlasHeightfield();
      return { ...doc, heightfield: hf, demoSeed: false };
    }
    case 'paint_heightfield': {
      const base = doc.heightfield ?? emptyAtlasHeightfield();
      const next = applyHeightBrush(base, edit.stroke);
      return { ...doc, heightfield: next, demoSeed: false };
    }
    case 'clear_heightfield': {
      if (!doc.heightfield) return doc;
      return { ...doc, heightfield: clearAtlasHeightfield(doc.heightfield), demoSeed: false };
    }
    case 'set_heightfield': {
      if (edit.heightfield == null) {
        return { ...doc, heightfield: null, demoSeed: false };
      }
      const parsed = parseAtlasHeightfield(serializeAtlasHeightfield(edit.heightfield));
      if (!parsed) return doc;
      return { ...doc, heightfield: parsed, demoSeed: false };
    }
    default:
      return doc;
  }
}

export function applyMapEdits(doc: UnifiedCanvasDoc, edits: readonly MapEditOperation[]): UnifiedCanvasDoc {
  return edits.reduce((acc, edit) => applyMapEdit(acc, edit), doc);
}

/** Hit-test objects in world XY (top-down). Prefer last (topmost) match. */
export function pickObjectAt(
  doc: UnifiedCanvasDoc,
  x: number,
  y: number,
): UnifiedCanvasObject | null {
  for (let i = doc.objects.length - 1; i >= 0; i -= 1) {
    const o = doc.objects[i];
    const half = o.size / 2;
    if (x >= o.x - half && x <= o.x + half && y >= o.y - half && y <= o.y + half) return o;
  }
  return null;
}

export function pickRoomAt(doc: UnifiedCanvasDoc, x: number, y: number): UnifiedCanvasRoom | null {
  for (let i = doc.rooms.length - 1; i >= 0; i -= 1) {
    const r = doc.rooms[i];
    if (r.points && r.points.length >= 3) {
      if (pointInPolygon(x, y, r.points)) return r;
      continue;
    }
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}

function distPointToSegment2(
  x: number,
  y: number,
  a: readonly [number, number],
  b: readonly [number, number],
): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const len2 = abx * abx + aby * aby;
  if (!(len2 > 0)) {
    const dx = x - a[0];
    const dy = y - a[1];
    return dx * dx + dy * dy;
  }
  let t = ((x - a[0]) * abx + (y - a[1]) * aby) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const px = a[0] + t * abx;
  const py = a[1] + t * aby;
  const dx = x - px;
  const dy = y - py;
  return dx * dx + dy * dy;
}

/** Hit-test strokes by distance to polyline segments (half-width floor). */
export function pickStrokeAt(
  doc: UnifiedCanvasDoc,
  x: number,
  y: number,
  minRadius = 0,
): UnifiedCanvasStroke | null {
  for (let i = doc.strokes.length - 1; i >= 0; i -= 1) {
    const s = doc.strokes[i];
    const r = Math.max(s.width * 0.5, minRadius);
    const r2 = r * r;
    const pts = s.points;
    if (pts.length === 0) continue;
    if (pts.length === 1) {
      const q = pts[0];
      if ((q[0] - x) ** 2 + (q[1] - y) ** 2 <= r2) return s;
      continue;
    }
    for (let j = 0; j < pts.length - 1; j += 1) {
      if (distPointToSegment2(x, y, pts[j], pts[j + 1]) <= r2) return s;
    }
  }
  return null;
}

/** Nearest polygon vertex index within threshold, or -1. */
export function pickRoomVertexAt(
  room: UnifiedCanvasRoom,
  x: number,
  y: number,
  threshold: number,
): number {
  if (!room.points || !(threshold > 0)) return -1;
  let best = -1;
  let bestDist = threshold;
  for (let i = 0; i < room.points.length; i += 1) {
    const d = Math.hypot(room.points[i][0] - x, room.points[i][1] - y);
    if (d <= bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Hit-test walls by segment distance (ATL2-C02). */
export function pickWallAt(
  doc: UnifiedCanvasDoc,
  x: number,
  y: number,
  minRadius = 0,
): UnifiedCanvasWall | null {
  for (let i = doc.walls.length - 1; i >= 0; i -= 1) {
    const w = doc.walls[i];
    const r = Math.max(w.width * 0.5, minRadius);
    if (distPointToSegment2(x, y, [w.x1, w.y1], [w.x2, w.y2]) <= r * r) return w;
  }
  return null;
}

/** Parametric t of closest point on wall, clamped to [0,1]. */
export function wallParamAt(wall: UnifiedCanvasWall, x: number, y: number): number {
  const abx = wall.x2 - wall.x1;
  const aby = wall.y2 - wall.y1;
  const len2 = abx * abx + aby * aby;
  if (!(len2 > 0)) return 0;
  const t = ((x - wall.x1) * abx + (y - wall.y1) * aby) / len2;
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

export function pickDoorAt(
  doc: UnifiedCanvasDoc,
  x: number,
  y: number,
  minRadius = 0,
): UnifiedCanvasDoor | null {
  const doors = doc.doors ?? [];
  for (let i = doors.length - 1; i >= 0; i -= 1) {
    const d = doors[i];
    const wall = doc.walls.find((w) => w.id === d.wallId);
    if (!wall) continue;
    const [px, py] = wallPointAt(wall, d.t);
    const r = Math.max(d.width * 0.5, minRadius);
    if ((px - x) ** 2 + (py - y) ** 2 <= r * r) return d;
  }
  return null;
}

/**
 * Snap a free point to nearby wall endpoints or room corners (ATL2-C02).
 */
export function snapStructurePoint(
  doc: UnifiedCanvasDoc,
  point: readonly [number, number],
  threshold: number,
): readonly [number, number] {
  if (!(threshold > 0)) return point;
  const candidates: [number, number][] = [];
  for (const w of doc.walls) {
    candidates.push([w.x1, w.y1], [w.x2, w.y2]);
  }
  for (const r of doc.rooms) {
    if (r.points && r.points.length >= 3) {
      for (const p of r.points) candidates.push([p[0], p[1]]);
    } else {
      candidates.push(
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x + r.w, r.y + r.h],
        [r.x, r.y + r.h],
      );
    }
  }
  let best = point;
  let bestDist = threshold;
  for (const c of candidates) {
    const d = Math.hypot(point[0] - c[0], point[1] - c[1]);
    if (d <= bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

/** Which wall endpoint is near the point: 1, 2, or 0. */
export function pickWallEndpoint(
  wall: UnifiedCanvasWall,
  x: number,
  y: number,
  threshold: number,
): 0 | 1 | 2 {
  if (!(threshold > 0)) return 0;
  const d1 = Math.hypot(wall.x1 - x, wall.y1 - y);
  const d2 = Math.hypot(wall.x2 - x, wall.y2 - y);
  if (d1 <= threshold && d1 <= d2) return 1;
  if (d2 <= threshold) return 2;
  return 0;
}
