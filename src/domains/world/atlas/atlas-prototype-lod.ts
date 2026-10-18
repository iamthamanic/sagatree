/**
 * atlas-prototype-lod — Port of HTML Unified Atlas v3 level / LOD / layer model.
 * Location: src/domains/world/atlas/atlas-prototype-lod.ts
 *
 * Pure domain: same camera-stage logic as the offline WebGL prototype, mapped onto
 * the product 1000² canvas (Dornhain anchors). No React / Supabase.
 */

import type { AtlasPoint, AtlasRect } from '../map/atlas-camera';
import { DORNHAIN_SETTLEMENT_FOCUS, DORNHAIN_WORLD_ANCHOR } from './dornhain-unified-starter';

/** Prototype stage ids (HTML `levels[].id`). */
export type AtlasPrototypeLevelId = 'world' | 'region' | 'city' | 'dungeon' | 'room';

export type AtlasPrototypeLevel = {
  readonly id: AtlasPrototypeLevelId;
  readonly label: string;
  readonly sub: string;
  readonly tag: string;
  readonly glyph: string;
  /** Camera focus center (world X / canvas Y). */
  readonly x: number;
  readonly y: number;
  /** Half-height of the view in world units (HTML `span`). */
  readonly span: number;
};

/**
 * Product stages — same hierarchy as the HTML prototype, Dornhain-centred (not Eldoria).
 * Spans scaled for DEFAULT_ATLAS_BOUNDS 0…1000.
 */
export const ATLAS_PROTOTYPE_LEVELS: readonly AtlasPrototypeLevel[] = [
  {
    id: 'world',
    label: 'Welt',
    sub: 'Weltkarte',
    tag: 'WELT',
    glyph: '◎',
    x: 500,
    y: 500,
    span: 520,
  },
  {
    id: 'region',
    label: 'Donalu',
    sub: 'Länder & Regionen',
    tag: 'REGION',
    glyph: '◇',
    x: DORNHAIN_WORLD_ANCHOR.x,
    y: DORNHAIN_WORLD_ANCHOR.y - 20,
    span: 160,
  },
  {
    id: 'city',
    label: 'Dornhain',
    sub: 'Stadt & Gebäude',
    tag: 'STADT',
    glyph: '⌂',
    x: DORNHAIN_WORLD_ANCHOR.x,
    y: DORNHAIN_WORLD_ANCHOR.y,
    span: 90,
  },
  {
    id: 'dungeon',
    label: 'Krypta',
    sub: 'Gewölbe & Dungeon',
    tag: 'DUNGEON',
    glyph: '♜',
    x: DORNHAIN_SETTLEMENT_FOCUS.x + DORNHAIN_SETTLEMENT_FOCUS.width * 0.72,
    y: DORNHAIN_SETTLEMENT_FOCUS.y + DORNHAIN_SETTLEMENT_FOCUS.height * 0.22,
    span: 28,
  },
  {
    id: 'room',
    label: 'Kryptaraum',
    sub: 'Räume & Objekte',
    tag: 'RAUM',
    glyph: '▧',
    x: DORNHAIN_SETTLEMENT_FOCUS.x + DORNHAIN_SETTLEMENT_FOCUS.width * 0.72,
    y: DORNHAIN_SETTLEMENT_FOCUS.y + DORNHAIN_SETTLEMENT_FOCUS.height * 0.22,
    span: 10,
  },
];

/** Layer toggles as in the HTML prototype (mapped onto UnifiedCanvas layer ids). */
export const ATLAS_PROTOTYPE_LAYER_LABELS: readonly {
  readonly id: string;
  readonly label: string;
  /** Unified canvas layer key this toggle drives. */
  readonly canvasLayer: string;
}[] = [
  { id: 'world', label: 'Weltkarte', canvasLayer: 'terrain' },
  { id: 'region', label: 'Regionen', canvasLayer: 'region' },
  { id: 'city', label: 'Stadt & Dächer', canvasLayer: 'city' },
  { id: 'dungeon', label: 'Dungeon', canvasLayer: 'interior' },
  { id: 'stamps', label: '3D-Objekte', canvasLayer: 'objects' },
  { id: 'grid', label: 'Kampfgrid', canvasLayer: 'grid' },
];

export type AtlasLodVisibility = {
  readonly mapWorld: boolean;
  readonly mapRegion: boolean;
  readonly mapCity: boolean;
  readonly mapDungeon: boolean;
  readonly stampsWorld: boolean;
  readonly stampsRegion: boolean;
  readonly stampsCity: boolean;
  readonly stampsDungeon: boolean;
  readonly stampsRoom: boolean;
  readonly grid: boolean;
};

function inside(
  x: number,
  y: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
): boolean {
  return Math.abs(x - cx) <= w / 2 && Math.abs(y - cy) <= h / 2;
}

/**
 * Convert product camera scale → prototype-style span (half visible height in world units).
 * HTML: `unit = 2 * span / stageHeight` ↔ `span = stageHeight / (2 * pixelsPerUnit)`.
 */
export function atlasSpanFromScale(pixelsPerUnit: number, viewportHeight: number): number {
  if (!(pixelsPerUnit > 0) || !(viewportHeight > 0)) return 520;
  return viewportHeight / (2 * pixelsPerUnit);
}

/** Fit rect for a prototype stage (for goTo / atlasFitCamera). */
export function atlasPrototypeLevelRect(level: AtlasPrototypeLevel): AtlasRect {
  const h = level.span * 2;
  const w = h * 1.35;
  return {
    x: level.x - w / 2,
    y: level.y - h / 2,
    width: w,
    height: h,
  };
}

/**
 * HTML `levelFromView` — finest stage under the camera.
 * Thresholds mirror the prototype (scaled for 1000² product canvas).
 */
export function atlasPrototypeLevelFromView(
  center: AtlasPoint,
  pixelsPerUnit: number,
  viewportHeight: number,
): AtlasPrototypeLevelId {
  const s = atlasSpanFromScale(pixelsPerUnit, viewportHeight);
  const { x, y } = center;
  const dungeon = ATLAS_PROTOTYPE_LEVELS.find((l) => l.id === 'dungeon')!;
  const city = ATLAS_PROTOTYPE_LEVELS.find((l) => l.id === 'city')!;
  const region = ATLAS_PROTOTYPE_LEVELS.find((l) => l.id === 'region')!;

  if (s < 12 && inside(x, y, dungeon.x, dungeon.y, 40, 32)) return 'room';
  if (s < 40 && inside(x, y, dungeon.x, dungeon.y, 48, 40)) return 'dungeon';
  if (s < 120 && inside(x, y, city.x, city.y, 160, 140)) return 'city';
  if (s < 280 && inside(x, y, region.x, region.y, 320, 260)) return 'region';
  return 'world';
}

/** HTML `applyLod` — which map / stamp layers are visible at the current span. */
export function atlasPrototypeApplyLod(
  pixelsPerUnit: number,
  viewportHeight: number,
  layers: Readonly<Record<string, boolean>>,
): AtlasLodVisibility {
  const s = atlasSpanFromScale(pixelsPerUnit, viewportHeight);
  const on = (key: string, fallback = true): boolean =>
    layers[key] !== undefined ? Boolean(layers[key]) : fallback;

  return {
    mapWorld: on('terrain') && s >= 40,
    mapRegion: on('region') && s < 280 && s >= 40,
    mapCity: on('city') && s < 140 && s >= 40,
    mapDungeon: on('interior') && s < 45,
    stampsWorld: on('objects') && s > 160,
    stampsRegion: on('objects') && s < 280 && s > 70,
    stampsCity: on('objects') && s < 140 && s > 35,
    stampsDungeon: on('objects') && s < 50,
    stampsRoom: on('objects') && s < 18,
    grid: on('grid') && s < 30,
  };
}

/** Brush world size by active stage (HTML `brushSizeWorld`). */
export function atlasPrototypeBrushSize(
  level: AtlasPrototypeLevelId,
  brushUi = 35,
): number {
  const base: Record<AtlasPrototypeLevelId, number> = {
    world: 28,
    region: 9,
    city: 1.6,
    dungeon: 0.35,
    room: 0.16,
  };
  return (base[level] ?? 9) * (brushUi / 35);
}

/** Stamp scale by stage. */
export function atlasPrototypeStampSize(
  level: AtlasPrototypeLevelId,
  objectSize = 1,
): number {
  const base: Record<AtlasPrototypeLevelId, number> = {
    world: 25,
    region: 11,
    city: 3,
    dungeon: 0.8,
    room: 0.35,
  };
  return (base[level] ?? 5) * objectSize;
}

/** Next finer stage for double-click drill-down. */
export function atlasPrototypeNextLevel(
  current: AtlasPrototypeLevelId,
): AtlasPrototypeLevelId {
  const idx = ATLAS_PROTOTYPE_LEVELS.findIndex((l) => l.id === current);
  if (idx < 0 || idx >= ATLAS_PROTOTYPE_LEVELS.length - 1) return current;
  return ATLAS_PROTOTYPE_LEVELS[idx + 1]!.id;
}

export type AtlasPrototypeHotspot = {
  readonly id: string;
  readonly targetLevel: AtlasPrototypeLevelId;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  /** Show when span is between max (zoomed out) and min (zoomed in). */
  readonly spanMax: number;
  readonly spanMin: number;
};

/** HTML hotspots: Nordreich → Dornhain → Dungeon, product labels. */
export const ATLAS_PROTOTYPE_HOTSPOTS: readonly AtlasPrototypeHotspot[] = [
  {
    id: 'region',
    targetLevel: 'region',
    label: '◆ Donalu',
    x: DORNHAIN_WORLD_ANCHOR.x,
    y: DORNHAIN_WORLD_ANCHOR.y - 20,
    spanMax: 400,
    spanMin: 140,
  },
  {
    id: 'city',
    targetLevel: 'city',
    label: '◆ Dornhain',
    x: DORNHAIN_WORLD_ANCHOR.x,
    y: DORNHAIN_WORLD_ANCHOR.y,
    spanMax: 160,
    spanMin: 50,
  },
  {
    id: 'dungeon',
    targetLevel: 'dungeon',
    label: '◆ Krypta',
    x: DORNHAIN_SETTLEMENT_FOCUS.x + DORNHAIN_SETTLEMENT_FOCUS.width * 0.72,
    y: DORNHAIN_SETTLEMENT_FOCUS.y + DORNHAIN_SETTLEMENT_FOCUS.height * 0.22,
    spanMax: 70,
    spanMin: 16,
  },
];

export function atlasPrototypeHotspotVisible(
  hotspot: AtlasPrototypeHotspot,
  pixelsPerUnit: number,
  viewportHeight: number,
): boolean {
  const s = atlasSpanFromScale(pixelsPerUnit, viewportHeight);
  return s < hotspot.spanMax && s > hotspot.spanMin;
}

/** Whether a canvas room/object id should paint under current LOD. */
export function atlasPrototypeContentVisible(
  id: string,
  lod: AtlasLodVisibility,
): boolean {
  if (id.startsWith('s.')) return lod.mapCity || lod.mapDungeon;
  if (id.startsWith('d.') || id.startsWith('room.')) return lod.mapDungeon;
  if (id.startsWith('w.')) return lod.mapWorld || lod.mapRegion;
  return true;
}
