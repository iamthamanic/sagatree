/**
 * map-edit-ops — validated edit operations for the shared atlas document.
 * Location: src/domains/world/atlas/map-edit-ops.ts
 *
 * Renderer-agnostic: Canvas2D and Three.js both apply the same ops to UnifiedCanvasDoc.
 */

import type {
  UnifiedCanvasDoc,
  UnifiedCanvasObject,
  UnifiedCanvasRoom,
  UnifiedCanvasWall,
} from './unified-canvas-doc';

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
  | {
      readonly op: 'replace_scene';
      readonly rooms: readonly UnifiedCanvasRoom[];
      readonly walls: readonly UnifiedCanvasWall[];
      readonly objects?: readonly UnifiedCanvasObject[];
    };

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
        rooms: doc.rooms.map((r) => (r.id === edit.id ? { ...r, x: edit.x, y: edit.y } : r)),
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
      return { ...doc, walls: doc.walls.filter((w) => w.id !== edit.id), demoSeed: false };
    case 'replace_scene':
      return {
        ...doc,
        rooms: [...edit.rooms],
        walls: [...edit.walls],
        objects: edit.objects ? [...edit.objects] : doc.objects,
        demoSeed: false,
      };
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
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}
