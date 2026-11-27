/**
 * dornhain-unified-starter — Canonical Unified Canvas for Donalu / Dornhain world.
 * Location: src/domains/world/atlas/dornhain-unified-starter.ts
 *
 * SWS Bottom-Up calibrated default world (replaces legacy hand-drawn v4 world canvas).
 * Root ocean + continents (`w.west-core`, `w.east-core`) + rivers (`w.river-w`, `w.river-e`)
 * + settlement pins (`w.loc.dornhain`, `s.obj.tavern`, `s.obj.crypt` secret) are all
 * derived bottom-up from child maps via `buildCalibratedDefaultWorld()`.
 * Pure domain — no React / Host.
 */
import {
  ATLAS_DEFAULT_WORLD_ROOT_METERS_PER_UNIT,
  buildCalibratedDefaultWorld,
} from './atlas-default-world';
import type { UnifiedCanvasDoc } from './unified-canvas-doc';

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

/** Dornhain settlement anchor on the Nordreich map (calibrated Bottom-Up reference). */
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
 * Canonical Donalu / Dornhain **Bottom-Up Calibrated** world canvas.
 * Derived strictly from Westmark & Ostmark (no independent hand-drawn contradictions).
 * Contains `w.ocean`, `w.west-core`, `w.east-core`, `w.river-w`, `w.loc.dornhain`,
 * `s.obj.tavern`, and `s.obj.crypt` / `s.crypt` (`secret: true`).
 */
export function buildDornhainUnifiedCanvasDoc(): UnifiedCanvasDoc {
  return buildCalibratedDefaultWorld().rootDoc;
}

/** True when a room/object belongs to settlement LOD (hidden at planet zoom). */
export function isSettlementLodId(id: string): boolean {
  return id.startsWith('s.');
}

/** generator_meta envelope for world_atlas_maps (calibrated from Day 1). */
export function buildDornhainUnifiedGeneratorMeta(): Record<string, unknown> {
  return {
    engine: 'unified_canvas',
    sagaSlug: 'dornhain.whisper',
    seed: DORNHAIN_UNIFIED_SEED,
    scale: 'world',
    mapStatus: 'ready',
    nativeTag: 'SagaTree Native',
    golden: true,
    worldSpace: {
      calibrated: true,
      metersPerUnit: ATLAS_DEFAULT_WORLD_ROOT_METERS_PER_UNIT,
      derivation: 'bottom-up',
    },
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
