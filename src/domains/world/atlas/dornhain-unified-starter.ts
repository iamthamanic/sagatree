/**
 * dornhain-unified-starter — Canonical Unified Canvas for Dornhain / Donalu world.
 * Location: src/domains/world/atlas/dornhain-unified-starter.ts
 *
 * v4 Golden: planetary ocean + continents + Dornhain pin + settlement LOD (`s.*`).
 * Editable product seed (`demoSeed: false`) — not Eldoria demo.
 * Pure domain — no React / Supabase.
 */

import {
  defaultUnifiedCanvasLayers,
  UNIFIED_CANVAS_FORMAT,
  type UnifiedCanvasDoc,
  type UnifiedCanvasObject,
  type UnifiedCanvasRoom,
  type UnifiedCanvasStroke,
} from './unified-canvas-doc';

/** Canvas space matches DEFAULT_ATLAS_BOUNDS (0…1000). */
export const DORNHAIN_STARTER_CANVAS = 1000;
/** @deprecated Prefer DORNHAIN_STARTER_CANVAS — kept for settlement grid helpers. */
export const DORNHAIN_STARTER_GRID = 24;

/** Seed key written into generator_meta — bumping forces DB / client re-seed of starter. */
export const DORNHAIN_UNIFIED_SEED = 'dornhain.unified.v4';

/** Prior product seeds that may auto-upgrade when the canvas is still blank. */
export const DORNHAIN_UNIFIED_LEGACY_SEEDS = [
  'dornhain.unified.v1',
  'dornhain.unified.v2',
  'dornhain.unified.v3',
] as const;

/** Dornhain settlement anchor on the world map (for places / future LOD). */
export const DORNHAIN_WORLD_ANCHOR = { x: 360, y: 510 } as const;

/** Focus rect used for zoom-into-Dornhain / LOD. */
export const DORNHAIN_SETTLEMENT_FOCUS = {
  x: 280,
  y: 430,
  width: 160,
  height: 160,
} as const;

/** Canonical display title for the root world layer. */
export const DORNHAIN_WORLD_LAYER_TITLE = 'Welt';

function land(
  id: string,
  material: UnifiedCanvasRoom['material'],
  x: number,
  y: number,
  w: number,
  h: number,
): UnifiedCanvasRoom {
  return { id, material, x, y, w, h };
}

function stroke(
  id: string,
  material: UnifiedCanvasStroke['material'],
  width: number,
  points: readonly (readonly [number, number])[],
): UnifiedCanvasStroke {
  return { id, material, width, points };
}

function obj(
  id: string,
  type: UnifiedCanvasObject['type'],
  x: number,
  y: number,
  size: number,
  height?: number,
): UnifiedCanvasObject {
  return height === undefined
    ? { id, type, x, y, size }
    : { id, type, x, y, size, height };
}

/**
 * True when the doc is still the blank planetary ocean starter (v3).
 * User strokes/objects/extra rooms mean authored content — do not auto-clobber.
 */
export function isBlankDornhainOceanDoc(doc: UnifiedCanvasDoc | null | undefined): boolean {
  if (!doc || doc.demoSeed !== false) return false;
  if (doc.strokes.length > 0 || doc.objects.length > 0 || doc.walls.length > 0) return false;
  if (doc.rooms.length !== 1) return false;
  const only = doc.rooms[0];
  return (
    only.id === 'w.ocean' &&
    only.material === 'wasser' &&
    only.x === 0 &&
    only.y === 0 &&
    only.w === DORNHAIN_STARTER_CANVAS &&
    only.h === DORNHAIN_STARTER_CANVAS
  );
}

/**
 * Canonical Donalu / Dornhain **Golden** world canvas — editable reference geography.
 */
export function buildDornhainUnifiedCanvasDoc(): UnifiedCanvasDoc {
  return {
    format: UNIFIED_CANVAS_FORMAT,
    layers: defaultUnifiedCanvasLayers(),
    strokes: [
      stroke('w.river-w', 'wasser', 10, [
        [220, 120],
        [240, 280],
        [210, 420],
        [250, 560],
        [200, 720],
      ]),
      stroke('w.river-e', 'wasser', 12, [
        [780, 80],
        [760, 220],
        [800, 400],
        [740, 580],
        [780, 760],
      ]),
      stroke('s.rd.plaza', 'pflaster', 9, [
        [330, 530],
        [350, 510],
        [370, 490],
      ]),
      stroke('w.rd.whisper', 'pflaster', 8, [
        [360, 510],
        [420, 480],
        [520, 460],
        [640, 440],
      ]),
    ],
    objects: [
      obj('w.loc.dornhain', 'haus', 360, 510, 0.42, 1.2),
      obj('w.loc.northkeep', 'turm', 220, 160, 0.36, 1.4),
      obj('w.loc.eastport', 'haus', 820, 480, 0.38, 1.1),
      obj('w.loc.southmarsh', 'fels', 180, 720, 0.34),
      obj('w.loc.highpass', 'fels', 700, 120, 0.32),
      obj('s.obj.tavern', 'haus', 328, 528, 0.55, 1.2),
      obj('s.obj.market', 'haus', 378, 488, 0.5, 1.1),
      obj('s.obj.woods', 'tanne', 410, 550, 0.65),
      obj('s.obj.crypt', 'fels', 406, 462, 0.55),
      obj('s.obj.tree-a', 'baum', 304, 460, 0.4),
      obj('s.obj.tree-b', 'tanne', 420, 500, 0.45),
    ],
    rooms: [
      land('w.ocean', 'wasser', 0, 0, DORNHAIN_STARTER_CANVAS, DORNHAIN_STARTER_CANVAS),
      land('w.west-core', 'gras', 60, 180, 380, 520),
      land('w.west-north', 'erde', 100, 90, 280, 160),
      land('w.west-south', 'sand', 80, 640, 300, 180),
      land('w.west-pen', 'gras', 300, 400, 140, 200),
      land('w.east-core', 'gras', 520, 140, 400, 560),
      land('w.east-north', 'stein', 580, 40, 300, 160),
      land('w.east-south', 'erde', 560, 640, 320, 220),
      land('w.east-bay', 'sand', 480, 360, 100, 140),
      land('w.isle-n', 'holz', 420, 30, 120, 90),
      land('w.isle-sw', 'gras', 40, 780, 100, 120),
      land('w.isle-se', 'sand', 860, 820, 110, 100),
      land('w.lake-w', 'wasser', 180, 320, 70, 50),
      land('w.lake-e', 'wasser', 700, 280, 90, 60),
      land('s.ground', 'gras', 280, 430, 160, 160),
      land('s.plaza', 'pflaster', 320, 480, 70, 60),
      land('s.tavern', 'erde', 310, 510, 36, 36),
      land('s.market', 'sand', 360, 470, 36, 36),
      land('s.woods', 'holz', 390, 530, 40, 40),
      land('s.crypt', 'stein', 390, 446, 32, 32),
    ],
    walls: [],
    demoSeed: false,
  };
}

/** True when a room/object belongs to settlement LOD (hidden at planet zoom). */
export function isSettlementLodId(id: string): boolean {
  return id.startsWith('s.');
}

/** generator_meta envelope for world_atlas_maps. */
export function buildDornhainUnifiedGeneratorMeta(): Record<string, unknown> {
  return {
    engine: 'unified_canvas',
    sagaSlug: 'dornhain.whisper',
    seed: DORNHAIN_UNIFIED_SEED,
    scale: 'world',
    nativeTag: 'SagaTree Native',
    golden: true,
    unifiedCanvas: buildDornhainUnifiedCanvasDoc(),
  };
}

/** Normalize legacy root titles to the product label „Welt“. */
export function normalizeDornhainWorldLayerTitle(title: string): string {
  const t = title.trim();
  if (
    t === DORNHAIN_WORLD_LAYER_TITLE ||
    t === 'Weltkarte' ||
    t.includes('Dornhain Übersicht') ||
    t.includes('Unified') ||
    t === 'Weltkarte (Unified)'
  ) {
    return DORNHAIN_WORLD_LAYER_TITLE;
  }
  return title;
}

/**
 * Detect outdated / blank starter so clients can upgrade in place to Golden v4.
 * Never clobbers authored (non-blank) canvases.
 */
export function shouldUpgradeDornhainUnifiedToWorld(
  generatorMeta: Readonly<Record<string, unknown>> | null | undefined,
  doc: UnifiedCanvasDoc | null,
): boolean {
  const seed = typeof generatorMeta?.seed === 'string' ? generatorMeta.seed : '';
  if (seed === DORNHAIN_UNIFIED_SEED) return false;
  if (seed === 'dornhain.unified.v1' || seed === 'dornhain.unified.v2') return true;
  if (seed === 'dornhain.unified.v3') return isBlankDornhainOceanDoc(doc);
  if (!doc || doc.demoSeed !== false) return false;
  const ids = new Set(doc.rooms.map((r) => r.id));
  return ids.has('r.grass') && ids.has('r.city-tavern');
}
