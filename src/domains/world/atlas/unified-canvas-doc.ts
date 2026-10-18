/**
 * unified-canvas-doc — persistable Unified Atlas canvas document (#702).
 * Location: src/domains/world/atlas/unified-canvas-doc.ts
 *
 * Stored under world_atlas_maps.generator_meta.unifiedCanvas.
 * Pure domain — no React / Supabase.
 */

export const UNIFIED_CANVAS_FORMAT = 'sagatree-unified-atlas-v1' as const;
export const UNIFIED_CANVAS_META_KEY = 'unifiedCanvas' as const;
/** Client soft cap before upsert (JSON text). RPC layers cap is separate. */
export const UNIFIED_CANVAS_MAX_BYTES = 1_000_000;

export type UnifiedCanvasTool =
  | 'hand'
  | 'select'
  | 'brush'
  | 'road'
  | 'room'
  | 'wall'
  | 'stamp'
  | 'erase';

export type UnifiedCanvasMaterial =
  | 'gras'
  | 'erde'
  | 'sand'
  | 'wasser'
  | 'stein'
  | 'holz'
  | 'pflaster';

export type UnifiedCanvasStampType =
  | 'baum'
  | 'tanne'
  | 'fels'
  | 'haus'
  | 'turm'
  | 'tisch'
  | 'stuhl'
  | 'fass'
  | 'bett'
  | 'kiste'
  | 'lampe'
  | 'teppich';

export type UnifiedCanvasLayerId =
  | 'terrain'
  | 'roads'
  | 'region'
  | 'city'
  | 'interior'
  | 'drawings'
  | 'objects'
  | 'grid';

export type UnifiedCanvasStroke = {
  readonly id: string;
  readonly material: UnifiedCanvasMaterial;
  readonly width: number;
  readonly points: readonly (readonly [number, number])[];
};

export type UnifiedCanvasObject = {
  readonly id: string;
  readonly type: UnifiedCanvasStampType;
  readonly x: number;
  readonly y: number;
  /** Optional elevation for 3D/2.5D views (world units). */
  readonly z?: number;
  readonly size: number;
  readonly angle?: number;
  /** Optional extruded height for 3D building/prop representation. */
  readonly height?: number;
};

export type UnifiedCanvasRoom = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly material: UnifiedCanvasMaterial;
};

export type UnifiedCanvasWall = {
  readonly id: string;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly width: number;
};

export type UnifiedCanvasLayersVisible = Readonly<Record<UnifiedCanvasLayerId, boolean>>;

export type UnifiedCanvasDoc = {
  readonly format: typeof UNIFIED_CANVAS_FORMAT;
  readonly layers: UnifiedCanvasLayersVisible;
  readonly strokes: readonly UnifiedCanvasStroke[];
  readonly objects: readonly UnifiedCanvasObject[];
  readonly rooms: readonly UnifiedCanvasRoom[];
  readonly walls: readonly UnifiedCanvasWall[];
  readonly demoSeed?: boolean;
};

const MATERIALS: ReadonlySet<string> = new Set([
  'gras',
  'erde',
  'sand',
  'wasser',
  'stein',
  'holz',
  'pflaster',
]);

const STAMPS: ReadonlySet<string> = new Set([
  'baum',
  'tanne',
  'fels',
  'haus',
  'turm',
  'tisch',
  'stuhl',
  'fass',
  'bett',
  'kiste',
  'lampe',
  'teppich',
]);

export function defaultUnifiedCanvasLayers(): UnifiedCanvasLayersVisible {
  return {
    terrain: true,
    roads: true,
    region: true,
    city: true,
    interior: true,
    drawings: true,
    objects: true,
    grid: false,
  };
}

export function emptyUnifiedCanvasDoc(demoSeed = true): UnifiedCanvasDoc {
  return {
    format: UNIFIED_CANVAS_FORMAT,
    layers: defaultUnifiedCanvasLayers(),
    strokes: [],
    objects: [],
    rooms: [],
    walls: [],
    demoSeed,
  };
}

function isFiniteNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function parsePoints(raw: unknown): readonly (readonly [number, number])[] | null {
  if (!Array.isArray(raw)) return null;
  const out: [number, number][] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2 || !isFiniteNum(p[0]) || !isFiniteNum(p[1])) return null;
    out.push([p[0], p[1]]);
  }
  return out;
}

/**
 * Parse generator_meta.unifiedCanvas or a full meta object.
 * Returns null when absent or invalid (caller uses empty demo seed).
 */
export function parseUnifiedCanvasDoc(raw: unknown): UnifiedCanvasDoc | null {
  if (raw == null || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const docRaw =
    root.format === UNIFIED_CANVAS_FORMAT
      ? root
      : typeof root[UNIFIED_CANVAS_META_KEY] === 'object' && root[UNIFIED_CANVAS_META_KEY] != null
        ? (root[UNIFIED_CANVAS_META_KEY] as Record<string, unknown>)
        : null;
  if (!docRaw || docRaw.format !== UNIFIED_CANVAS_FORMAT) return null;
  if (!Array.isArray(docRaw.strokes) || !Array.isArray(docRaw.objects)) return null;
  if (!Array.isArray(docRaw.rooms) || !Array.isArray(docRaw.walls)) return null;

  const layersIn =
    docRaw.layers && typeof docRaw.layers === 'object'
      ? (docRaw.layers as Record<string, unknown>)
      : {};
  const baseLayers = defaultUnifiedCanvasLayers();
  const layers: UnifiedCanvasLayersVisible = {
    terrain: typeof layersIn.terrain === 'boolean' ? layersIn.terrain : baseLayers.terrain,
    roads: typeof layersIn.roads === 'boolean' ? layersIn.roads : baseLayers.roads,
    region: typeof layersIn.region === 'boolean' ? layersIn.region : baseLayers.region,
    city: typeof layersIn.city === 'boolean' ? layersIn.city : baseLayers.city,
    interior: typeof layersIn.interior === 'boolean' ? layersIn.interior : baseLayers.interior,
    drawings: typeof layersIn.drawings === 'boolean' ? layersIn.drawings : baseLayers.drawings,
    objects: typeof layersIn.objects === 'boolean' ? layersIn.objects : baseLayers.objects,
    grid: typeof layersIn.grid === 'boolean' ? layersIn.grid : baseLayers.grid,
  };

  const strokes: UnifiedCanvasStroke[] = [];
  for (const s of docRaw.strokes) {
    if (!s || typeof s !== 'object') return null;
    const row = s as Record<string, unknown>;
    if (typeof row.id !== 'string' || !MATERIALS.has(String(row.material))) return null;
    if (!isFiniteNum(row.width)) return null;
    const points = parsePoints(row.points);
    if (!points) return null;
    strokes.push({
      id: row.id,
      material: row.material as UnifiedCanvasMaterial,
      width: row.width,
      points,
    });
  }

  const objects: UnifiedCanvasObject[] = [];
  for (const o of docRaw.objects) {
    if (!o || typeof o !== 'object') return null;
    const row = o as Record<string, unknown>;
    if (typeof row.id !== 'string' || !STAMPS.has(String(row.type))) return null;
    if (!isFiniteNum(row.x) || !isFiniteNum(row.y) || !isFiniteNum(row.size)) return null;
    objects.push({
      id: row.id,
      type: row.type as UnifiedCanvasStampType,
      x: row.x,
      y: row.y,
      size: row.size,
      angle: isFiniteNum(row.angle) ? row.angle : 0,
      ...(isFiniteNum(row.z) ? { z: row.z } : {}),
      ...(isFiniteNum(row.height) && row.height > 0 ? { height: row.height } : {}),
    });
  }

  const rooms: UnifiedCanvasRoom[] = [];
  for (const r of docRaw.rooms) {
    if (!r || typeof r !== 'object') return null;
    const row = r as Record<string, unknown>;
    if (typeof row.id !== 'string' || !MATERIALS.has(String(row.material))) return null;
    if (![row.x, row.y, row.w, row.h].every(isFiniteNum)) return null;
    rooms.push({
      id: row.id,
      x: row.x as number,
      y: row.y as number,
      w: row.w as number,
      h: row.h as number,
      material: row.material as UnifiedCanvasMaterial,
    });
  }

  const walls: UnifiedCanvasWall[] = [];
  for (const w of docRaw.walls) {
    if (!w || typeof w !== 'object') return null;
    const row = w as Record<string, unknown>;
    if (typeof row.id !== 'string') return null;
    if (![row.x1, row.y1, row.x2, row.y2, row.width].every(isFiniteNum)) return null;
    walls.push({
      id: row.id,
      x1: row.x1 as number,
      y1: row.y1 as number,
      x2: row.x2 as number,
      y2: row.y2 as number,
      width: row.width as number,
    });
  }

  return {
    format: UNIFIED_CANVAS_FORMAT,
    layers,
    strokes,
    objects,
    rooms,
    walls,
    demoSeed: docRaw.demoSeed === false ? false : true,
  };
}

export function serializeUnifiedCanvasDoc(doc: UnifiedCanvasDoc): UnifiedCanvasDoc {
  return {
    format: UNIFIED_CANVAS_FORMAT,
    layers: { ...doc.layers },
    strokes: doc.strokes.map((s) => ({
      id: s.id,
      material: s.material,
      width: s.width,
      points: s.points.map((p) => [p[0], p[1]] as const),
    })),
    objects: doc.objects.map((o) => ({
      id: o.id,
      type: o.type,
      x: o.x,
      y: o.y,
      size: o.size,
      angle: o.angle ?? 0,
      ...(typeof o.z === 'number' && Number.isFinite(o.z) ? { z: o.z } : {}),
      ...(typeof o.height === 'number' && Number.isFinite(o.height) && o.height > 0
        ? { height: o.height }
        : {}),
    })),
    rooms: [...doc.rooms],
    walls: [...doc.walls],
    demoSeed: doc.demoSeed !== false,
  };
}

export function unifiedCanvasDocByteLength(doc: UnifiedCanvasDoc): number {
  return new TextEncoder().encode(JSON.stringify(serializeUnifiedCanvasDoc(doc))).length;
}

export function assertUnifiedCanvasDocSize(doc: UnifiedCanvasDoc): void {
  const n = unifiedCanvasDocByteLength(doc);
  if (n > UNIFIED_CANVAS_MAX_BYTES) {
    throw new Error(
      `Atlas-Zeichnung zu groß (${Math.round(n / 1024)} KB). Bitte Details reduzieren (max. ${Math.round(UNIFIED_CANVAS_MAX_BYTES / 1024)} KB).`,
    );
  }
}

export function mergeUnifiedCanvasIntoGeneratorMeta(
  existing: Readonly<Record<string, unknown>>,
  doc: UnifiedCanvasDoc,
): Record<string, unknown> {
  assertUnifiedCanvasDocSize(doc);
  return {
    ...existing,
    engine: existing.engine ?? 'unified_canvas',
    [UNIFIED_CANVAS_META_KEY]: serializeUnifiedCanvasDoc(doc),
  };
}

export function extractUnifiedCanvasFromGeneratorMeta(
  meta: Readonly<Record<string, unknown>> | null | undefined,
): UnifiedCanvasDoc | null {
  if (!meta) return null;
  return parseUnifiedCanvasDoc(meta);
}
