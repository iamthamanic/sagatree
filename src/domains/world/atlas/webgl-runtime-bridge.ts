/**
 * webgl-runtime-bridge — Sync WebGL prototype state via generator_meta (#721 / #749).
 * Location: src/domains/world/atlas/webgl-runtime-bridge.ts
 *
 * Product maps must not use localStorage as world SoT. Runtime state is stored
 * under generator_meta.webglRuntimeV3 alongside UnifiedCanvasDoc.
 * Bidirectional projection: WebGL props/walls/strokes ↔ UnifiedCanvasDoc.
 */
import {
  extractUnifiedCanvasFromGeneratorMeta,
  mergeUnifiedCanvasIntoGeneratorMeta,
  type UnifiedCanvasDoc,
  type UnifiedCanvasMaterial,
  type UnifiedCanvasObject,
  type UnifiedCanvasRoom,
  type UnifiedCanvasStampType,
  type UnifiedCanvasStroke,
  type UnifiedCanvasWall,
} from './unified-canvas-doc';

export const WEBGL_RUNTIME_META_KEY = 'webglRuntimeV3' as const;
export const LEGACY_WEBGL_LOCAL_STORAGE_KEY = 'sagatree-atlas-webgl-v3' as const;

export type WebglRuntimeState = {
  readonly props: readonly unknown[];
  readonly strokes: readonly unknown[];
  readonly walls: readonly unknown[];
  readonly rooms?: readonly unknown[];
  readonly layers: Readonly<Record<string, unknown>>;
  readonly [key: string]: unknown;
};

const PROP_TYPE_TO_STAMP: Readonly<Record<string, UnifiedCanvasStampType>> = {
  tree: 'baum',
  pine: 'tanne',
  house: 'haus',
  rock: 'fels',
  crate: 'kiste',
  table: 'tisch',
  torch: 'lampe',
  crystal: 'fels',
  pillar: 'turm',
};

/** Reverse of PROP_TYPE_TO_STAMP (unique stamp → canonical WebGL prop type). */
export const STAMP_TO_PROP: Readonly<Record<UnifiedCanvasStampType, string>> = {
  baum: 'tree',
  tanne: 'pine',
  haus: 'house',
  fels: 'rock',
  kiste: 'crate',
  tisch: 'table',
  lampe: 'torch',
  turm: 'pillar',
  stuhl: 'crate',
  fass: 'crate',
  bett: 'table',
  teppich: 'crate',
};

const MATERIAL_TO_WEBGL: Readonly<Record<UnifiedCanvasMaterial, string>> = {
  gras: 'grass',
  erde: 'earth',
  sand: 'sand',
  wasser: 'water',
  stein: 'stone',
  holz: 'wood',
  pflaster: 'stone',
};

const WEBGL_TO_MATERIAL: Readonly<Record<string, UnifiedCanvasMaterial>> = {
  grass: 'gras',
  earth: 'erde',
  sand: 'sand',
  water: 'wasser',
  stone: 'stein',
  wood: 'holz',
};

const DEFAULT_WEBGL_LAYERS: Readonly<Record<string, unknown>> = {
  world: true,
  region: true,
  city: true,
  dungeon: true,
  stamps: true,
  grid: false,
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

function isFiniteNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function readPoint2(raw: unknown): readonly [number, number] | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const x = raw[0];
  const y = raw[1];
  if (!isFiniteNum(x) || !isFiniteNum(y)) return null;
  return [x, y];
}

export function emptyWebglRuntime(): WebglRuntimeState {
  return {
    props: [],
    strokes: [],
    walls: [],
    rooms: [],
    layers: { ...DEFAULT_WEBGL_LAYERS },
  };
}

export function parseWebglRuntimeState(raw: unknown): WebglRuntimeState | null {
  if (!isRecord(raw)) return null;
  if (!Array.isArray(raw.props) || !Array.isArray(raw.strokes) || !Array.isArray(raw.walls)) {
    return null;
  }
  if (!isRecord(raw.layers)) return null;
  const out: WebglRuntimeState = {
    props: raw.props,
    strokes: raw.strokes,
    walls: raw.walls,
    layers: raw.layers,
  };
  if (Array.isArray(raw.rooms)) {
    return { ...out, rooms: raw.rooms, ...pickExtraRuntimeFields(raw) };
  }
  return { ...out, ...pickExtraRuntimeFields(raw) };
}

/** Preserve non-geometry runtime keys (placeNames, worlds, …). */
function pickExtraRuntimeFields(raw: Record<string, unknown>): Record<string, unknown> {
  const skip = new Set(['props', 'strokes', 'walls', 'rooms', 'layers']);
  const extra: Record<string, unknown> = {};
  for (const key of Object.keys(raw)) {
    if (skip.has(key)) continue;
    extra[key] = raw[key];
  }
  return extra;
}

export function extractWebglRuntimeFromGeneratorMeta(
  meta: Readonly<Record<string, unknown>> | null | undefined,
): WebglRuntimeState | null {
  if (!meta || typeof meta !== 'object') return null;
  return parseWebglRuntimeState(meta[WEBGL_RUNTIME_META_KEY]);
}

export function mergeWebglRuntimeIntoGeneratorMeta(
  meta: Readonly<Record<string, unknown>> | null | undefined,
  runtime: WebglRuntimeState,
  canvasDoc?: UnifiedCanvasDoc | null,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(meta ?? {}) };
  base[WEBGL_RUNTIME_META_KEY] = runtime;
  if (canvasDoc) {
    return mergeUnifiedCanvasIntoGeneratorMeta(base, canvasDoc);
  }
  return base;
}

/** Prefer unified canvas doc; fall back to empty product doc when only runtime exists. */
export function resolveProductCanvasDoc(
  meta: Readonly<Record<string, unknown>> | null | undefined,
  fallback: UnifiedCanvasDoc,
): UnifiedCanvasDoc {
  return extractUnifiedCanvasFromGeneratorMeta(meta) ?? fallback;
}

/**
 * One-shot read of historical prototype local JSON (non-secret).
 * Does not write; caller decides whether to merge into generator_meta.
 */
export function readLegacyWebglLocalStorage(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof localStorage !== 'undefined'
    ? localStorage
    : null,
): WebglRuntimeState | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(LEGACY_WEBGL_LOCAL_STORAGE_KEY);
    if (!text) return null;
    return parseWebglRuntimeState(JSON.parse(text));
  } catch {
    return null;
  }
}

function projectPropsToObjects(props: readonly unknown[]): UnifiedCanvasObject[] {
  const objects: UnifiedCanvasObject[] = [];
  for (const raw of props) {
    if (!isRecord(raw)) continue;
    if (typeof raw.id !== 'string') continue;
    if (!isFiniteNum(raw.x) || !isFiniteNum(raw.z)) continue;
    const stamp = PROP_TYPE_TO_STAMP[String(raw.type ?? '')];
    if (!stamp) continue;
    const size = isFiniteNum(raw.size) ? raw.size : 1;
    const angle = isFiniteNum(raw.rotation) ? raw.rotation : 0;
    objects.push({ id: raw.id, type: stamp, x: raw.x, y: raw.z, size, angle });
  }
  return objects;
}

function projectWallsToCanvas(walls: readonly unknown[]): UnifiedCanvasWall[] {
  const out: UnifiedCanvasWall[] = [];
  for (const raw of walls) {
    if (!isRecord(raw)) continue;
    if (typeof raw.id !== 'string') continue;
    const start = readPoint2(raw.start);
    const end = readPoint2(raw.end);
    if (!start || !end) continue;
    const width = isFiniteNum(raw.width) ? raw.width : 1;
    out.push({
      id: raw.id,
      x1: start[0],
      y1: start[1],
      x2: end[0],
      y2: end[1],
      width,
    });
  }
  return out;
}

function projectStrokesToCanvas(strokes: readonly unknown[]): UnifiedCanvasStroke[] {
  const out: UnifiedCanvasStroke[] = [];
  for (const raw of strokes) {
    if (!isRecord(raw)) continue;
    if (typeof raw.id !== 'string') continue;
    if (!Array.isArray(raw.points)) continue;
    const points: [number, number][] = [];
    for (const p of raw.points) {
      const pt = readPoint2(p);
      if (!pt) {
        points.length = 0;
        break;
      }
      points.push([pt[0], pt[1]]);
    }
    if (points.length === 0) continue;
    const materialKey = String(raw.material ?? 'grass');
    const material = WEBGL_TO_MATERIAL[materialKey] ?? 'gras';
    const width = isFiniteNum(raw.size)
      ? raw.size
      : isFiniteNum(raw.width)
        ? raw.width
        : 1;
    out.push({ id: raw.id, material, width, points });
  }
  return out;
}

function projectRoomsToCanvas(rooms: readonly unknown[]): UnifiedCanvasRoom[] {
  const out: UnifiedCanvasRoom[] = [];
  for (const raw of rooms) {
    if (!isRecord(raw)) continue;
    if (typeof raw.id !== 'string') continue;
    const start = readPoint2(raw.start);
    const end = readPoint2(raw.end);
    if (!start || !end) continue;
    const x = Math.min(start[0], end[0]);
    const y = Math.min(start[1], end[1]);
    const w = Math.abs(end[0] - start[0]);
    const h = Math.abs(end[1] - start[1]);
    if (!(w > 0) || !(h > 0)) continue;
    const materialKey = String(raw.material ?? 'stone');
    const material = WEBGL_TO_MATERIAL[materialKey] ?? 'stein';
    out.push({ id: raw.id, x, y, w, h, material });
  }
  return out;
}

/**
 * Project WebGL geometry into UnifiedCanvasDoc (authoritative from WebGL direction).
 * Empty props → empty objects (no ghost merge). Same for walls/strokes/rooms.
 */
export function syncWebglPropsIntoCanvasDoc(
  doc: UnifiedCanvasDoc,
  runtime: WebglRuntimeState,
): UnifiedCanvasDoc {
  return {
    ...doc,
    objects: projectPropsToObjects(runtime.props),
    walls: projectWallsToCanvas(runtime.walls),
    strokes: projectStrokesToCanvas(runtime.strokes),
    rooms: projectRoomsToCanvas(runtime.rooms ?? []),
    demoSeed: false,
  };
}

function objectsToProps(objects: readonly UnifiedCanvasObject[]): unknown[] {
  const props: Record<string, unknown>[] = [];
  for (const o of objects) {
    const type = STAMP_TO_PROP[o.type];
    if (!type) continue;
    props.push({
      id: o.id,
      type,
      x: o.x,
      z: o.y,
      size: o.size,
      rotation: typeof o.angle === 'number' && Number.isFinite(o.angle) ? o.angle : 0,
      level: 'world',
    });
  }
  return props;
}

function wallsToWebgl(walls: readonly UnifiedCanvasWall[]): unknown[] {
  return walls.map((w) => ({
    id: w.id,
    level: 'world',
    start: [w.x1, w.y1],
    end: [w.x2, w.y2],
    width: w.width,
  }));
}

function strokesToWebgl(strokes: readonly UnifiedCanvasStroke[]): unknown[] {
  return strokes.map((s) => ({
    id: s.id,
    level: 'world',
    material: MATERIAL_TO_WEBGL[s.material] ?? 'grass',
    size: s.width,
    points: s.points.map((p) => [p[0], p[1]]),
  }));
}

function roomsToWebgl(rooms: readonly UnifiedCanvasRoom[]): unknown[] {
  return rooms.map((r) => ({
    id: r.id,
    level: 'world',
    start: [r.x, r.y],
    end: [r.x + r.w, r.y + r.h],
    material: MATERIAL_TO_WEBGL[r.material] ?? 'stone',
  }));
}

/**
 * Rebuild WebGL runtime geometry from UnifiedCanvasDoc (authoritative from 2D direction).
 * Preserves non-prop fields (layers, placeNames, …) from prior runtime.
 */
export function syncCanvasDocIntoWebglRuntime(
  runtime: WebglRuntimeState,
  doc: UnifiedCanvasDoc,
): WebglRuntimeState {
  return {
    ...runtime,
    props: objectsToProps(doc.objects),
    walls: wallsToWebgl(doc.walls),
    strokes: strokesToWebgl(doc.strokes),
    rooms: roomsToWebgl(doc.rooms),
    layers: runtime.layers ?? DEFAULT_WEBGL_LAYERS,
  };
}
