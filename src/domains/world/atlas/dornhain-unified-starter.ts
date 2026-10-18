/**
 * dornhain-unified-starter — Canonical Unified Canvas for Dornhain / Donalu world.
 * Location: src/domains/world/atlas/dornhain-unified-starter.ts
 *
 * v3: Root is a blank planetary ocean. Continents/settlements are authored later.
 * Pure domain — no React / Supabase.
 */

import {
  defaultUnifiedCanvasLayers,
  UNIFIED_CANVAS_FORMAT,
  type UnifiedCanvasDoc,
  type UnifiedCanvasRoom,
} from './unified-canvas-doc';

/** Canvas space matches DEFAULT_ATLAS_BOUNDS (0…1000). */
export const DORNHAIN_STARTER_CANVAS = 1000;
/** @deprecated Prefer DORNHAIN_STARTER_CANVAS — kept for settlement grid helpers. */
export const DORNHAIN_STARTER_GRID = 24;

/** Seed key written into generator_meta — bumping forces DB / client re-seed of starter. */
export const DORNHAIN_UNIFIED_SEED = 'dornhain.unified.v3';

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

/**
 * Canonical Donalu / Dornhain **world** canvas — ocean only until the GM paints land.
 */
export function buildDornhainUnifiedCanvasDoc(): UnifiedCanvasDoc {
  return {
    format: UNIFIED_CANVAS_FORMAT,
    layers: defaultUnifiedCanvasLayers(),
    strokes: [],
    objects: [],
    rooms: [land('w.ocean', 'wasser', 0, 0, DORNHAIN_STARTER_CANVAS, DORNHAIN_STARTER_CANVAS)],
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
 * Detect outdated starter (v1 town / v2 continents) so clients can upgrade in place.
 */
export function shouldUpgradeDornhainUnifiedToWorld(
  generatorMeta: Readonly<Record<string, unknown>> | null | undefined,
  doc: UnifiedCanvasDoc | null,
): boolean {
  const seed = typeof generatorMeta?.seed === 'string' ? generatorMeta.seed : '';
  if (seed === DORNHAIN_UNIFIED_SEED) return false;
  if (seed === 'dornhain.unified.v1' || seed === 'dornhain.unified.v2') return true;
  if (!doc || doc.demoSeed !== false) return false;
  const ids = new Set(doc.rooms.map((r) => r.id));
  return ids.has('r.grass') && ids.has('r.city-tavern');
}
