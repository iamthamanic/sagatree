/**
 * dornhain-golden-hierarchy — Golden child-map seeds + canvases (Steps 5+6).
 * Location: src/domains/world/atlas/dornhain-golden-hierarchy.ts
 *
 * Pure domain — no React / Host. Naming placeholders until PM freeze:
 * Kontinent Westmark / Land Westmark under Donalu.
 */
import {
  mergeMapFrameIntoGeneratorMeta,
  type ParentSpatialAnchor,
} from './map-frame';
import {
  emptyUnifiedCanvasDoc,
  roomFromPolygon,
  type UnifiedCanvasDoc,
  type UnifiedCanvasMaterial,
  type UnifiedCanvasObject,
  type UnifiedCanvasRoom,
  type UnifiedCanvasStroke,
} from './unified-canvas-doc';
import { DEFAULT_ATLAS_BOUNDS, type WorldAtlasMapKind } from './world-atlas.types';

export const DORNHAIN_WORLD_MAP_SEED = 'dornhain.unified.v4' as const;

export type DornhainGoldenMapSpec = {
  readonly seedKey: string;
  readonly placeSeedKey: string;
  readonly title: string;
  readonly kind: WorldAtlasMapKind;
  /** Parent Golden map seed; null = world root (`dornhain.unified.v4`). */
  readonly parentMapSeedKey: string | null;
  readonly parentAnchor: Omit<ParentSpatialAnchor, 'parentMapId' | 'metersPerUnit' | 'rotationRad'> & {
    readonly rotationRad?: number;
  };
  readonly buildCanvas: () => UnifiedCanvasDoc;
};

function rectRoom(
  id: string,
  material: UnifiedCanvasMaterial,
  x: number,
  y: number,
  w: number,
  h: number,
): UnifiedCanvasRoom {
  return { id, material, x, y, w, h };
}

function stroke(
  id: string,
  material: UnifiedCanvasMaterial,
  width: number,
  points: readonly (readonly [number, number])[],
): UnifiedCanvasStroke {
  return { id, material, width, points };
}

function stamp(
  id: string,
  type: UnifiedCanvasObject['type'],
  x: number,
  y: number,
  size: number,
): UnifiedCanvasObject {
  return { id, type, x, y, size };
}

function mustPoly(
  id: string,
  material: UnifiedCanvasMaterial,
  points: readonly (readonly [number, number])[],
): UnifiedCanvasRoom {
  const room = roomFromPolygon(id, material, points);
  if (!room) {
    throw new Error(`Golden polygon invalid: ${id}`);
  }
  return room;
}

function baseDoc(rooms: UnifiedCanvasRoom[], strokes: UnifiedCanvasStroke[] = [], objects: UnifiedCanvasObject[] = []): UnifiedCanvasDoc {
  const empty = emptyUnifiedCanvasDoc(false);
  return {
    ...empty,
    rooms: [rectRoom('g.ocean', 'wasser', 0, 0, 1000, 1000), ...rooms],
    strokes,
    objects,
  };
}

export function buildGoldenContinentCanvas(): UnifiedCanvasDoc {
  return baseDoc(
    [
      mustPoly('g.land.westmark', 'gras', [
        [120, 180],
        [280, 120],
        [520, 140],
        [700, 260],
        [740, 480],
        [620, 700],
        [360, 760],
        [160, 620],
        [100, 400],
      ]),
      rectRoom('g.country.westmark', 'erde', 320, 300, 220, 200),
    ],
    [
      stroke('g.ridge', 'stein', 14, [
        [200, 220],
        [340, 300],
        [480, 280],
        [620, 360],
      ]),
      stroke('g.river', 'wasser', 10, [
        [260, 160],
        [300, 320],
        [280, 520],
        [340, 700],
      ]),
    ],
    [stamp('g.forest', 'tanne', 420, 420, 0.7)],
  );
}

export function buildGoldenCountryCanvas(): UnifiedCanvasDoc {
  return baseDoc(
    [rectRoom('g.country.core', 'gras', 180, 180, 640, 640)],
    [
      stroke('g.whisper', 'pflaster', 10, [
        [220, 520],
        [360, 500],
        [520, 480],
        [700, 460],
      ]),
    ],
    [
      stamp('g.pin.dornhain', 'haus', 360, 510, 0.55),
      stamp('g.pin.road', 'fels', 420, 480, 0.35),
      stamp('g.pin.keep', 'turm', 560, 360, 0.4),
    ],
  );
}

export function buildGoldenDornhainCanvas(): UnifiedCanvasDoc {
  return baseDoc(
    [
      rectRoom('g.town.plaza', 'pflaster', 300, 420, 180, 140),
      rectRoom('g.town.block-a', 'stein', 220, 380, 90, 80),
      rectRoom('g.town.block-b', 'holz', 460, 400, 100, 90),
    ],
    [
      stroke('g.street', 'pflaster', 12, [
        [240, 500],
        [360, 500],
        [480, 480],
      ]),
    ],
    [
      stamp('g.tavern', 'haus', 328, 528, 0.6),
      stamp('g.market', 'haus', 378, 488, 0.5),
      stamp('g.watch', 'turm', 452, 430, 0.45),
      stamp('g.crypt', 'fels', 406, 462, 0.55),
      stamp('g.oak-a', 'baum', 280, 460, 0.55),
      stamp('g.oak-b', 'baum', 500, 520, 0.5),
      stamp('g.pine-a', 'tanne', 250, 540, 0.48),
      stamp('g.outcrop', 'fels', 430, 540, 0.4),
    ],
  );
}

export function buildGoldenTavernCanvas(): UnifiedCanvasDoc {
  const empty = emptyUnifiedCanvasDoc(false);
  return {
    ...empty,
    rooms: [
      rectRoom('g.tav.common', 'holz', 200, 200, 400, 320),
      rectRoom('g.tav.bar', 'stein', 220, 220, 140, 80),
    ],
    walls: [
      { id: 'g.tav.w1', x1: 200, y1: 200, x2: 600, y2: 200, width: 8 },
      { id: 'g.tav.w2', x1: 200, y1: 200, x2: 200, y2: 520, width: 8 },
      { id: 'g.tav.w3', x1: 600, y1: 200, x2: 600, y2: 520, width: 8 },
      { id: 'g.tav.w4', x1: 200, y1: 520, x2: 600, y2: 520, width: 8 },
    ],
    objects: [
      stamp('g.tav.table', 'tisch', 360, 360, 0.7),
      stamp('g.tav.chair-a', 'stuhl', 320, 340, 0.4),
      stamp('g.tav.chair-b', 'stuhl', 400, 340, 0.4),
      stamp('g.tav.barrel', 'fass', 260, 280, 0.45),
    ],
  };
}

export function buildGoldenCryptCanvas(): UnifiedCanvasDoc {
  const empty = emptyUnifiedCanvasDoc(false);
  return {
    ...empty,
    rooms: [
      rectRoom('g.crypt.hall', 'stein', 240, 240, 360, 280),
      rectRoom('g.crypt.vault', 'erde', 320, 560, 200, 160),
    ],
    walls: [
      { id: 'g.crypt.w1', x1: 240, y1: 240, x2: 600, y2: 240, width: 10 },
      { id: 'g.crypt.w2', x1: 240, y1: 240, x2: 240, y2: 520, width: 10 },
      { id: 'g.crypt.w3', x1: 600, y1: 240, x2: 600, y2: 520, width: 10 },
    ],
    objects: [
      stamp('g.crypt.relic', 'kiste', 400, 360, 0.5),
      stamp('g.crypt.lamp', 'lampe', 300, 300, 0.35),
    ],
  };
}

/** Ordered parent→child so reset can upsert without forward refs. */
export const DORNHAIN_GOLDEN_MAPS: readonly DornhainGoldenMapSpec[] = [
  {
    seedKey: 'dornhain.map.continent.westmark',
    placeSeedKey: 'continent.westmark',
    title: 'Kontinent Westmark',
    kind: 'region',
    parentMapSeedKey: null,
    parentAnchor: { centerX: 260, centerY: 420, extentX: 160, extentY: 220 },
    buildCanvas: buildGoldenContinentCanvas,
  },
  {
    seedKey: 'dornhain.map.country.westmark',
    placeSeedKey: 'country.westmark',
    title: 'Land Westmark',
    kind: 'region',
    parentMapSeedKey: 'dornhain.map.continent.westmark',
    parentAnchor: { centerX: 430, centerY: 400, extentX: 110, extentY: 100 },
    buildCanvas: buildGoldenCountryCanvas,
  },
  {
    seedKey: 'dornhain.map.place.dornhain',
    placeSeedKey: 'place.dornhain',
    title: 'Dornhain',
    kind: 'settlement',
    parentMapSeedKey: 'dornhain.map.country.westmark',
    parentAnchor: { centerX: 360, centerY: 510, extentX: 55, extentY: 55 },
    buildCanvas: buildGoldenDornhainCanvas,
  },
  {
    seedKey: 'dornhain.map.loc.tavern',
    placeSeedKey: 'loc.tavern',
    title: 'Taverne Zum Flüstern',
    kind: 'scene',
    parentMapSeedKey: 'dornhain.map.place.dornhain',
    parentAnchor: { centerX: 328, centerY: 528, extentX: 24, extentY: 24 },
    buildCanvas: buildGoldenTavernCanvas,
  },
  {
    seedKey: 'dornhain.map.loc.crypt',
    placeSeedKey: 'loc.crypt',
    title: 'Krypta unter dem Hügel',
    kind: 'scene',
    parentMapSeedKey: 'dornhain.map.place.dornhain',
    parentAnchor: { centerX: 406, centerY: 462, extentX: 28, extentY: 28 },
    buildCanvas: buildGoldenCryptCanvas,
  },
];

export function isDornhainGoldenMapSeed(seed: string | null | undefined): boolean {
  if (!seed) return false;
  if (seed === DORNHAIN_WORLD_MAP_SEED) return true;
  return DORNHAIN_GOLDEN_MAPS.some((m) => m.seedKey === seed);
}

export function buildDornhainGoldenChildGeneratorMeta(
  spec: DornhainGoldenMapSpec,
  parentMapId: string,
): Record<string, unknown> {
  const canvas = spec.buildCanvas();
  const anchor: ParentSpatialAnchor = {
    parentMapId,
    centerX: spec.parentAnchor.centerX,
    centerY: spec.parentAnchor.centerY,
    extentX: spec.parentAnchor.extentX,
    extentY: spec.parentAnchor.extentY,
    rotationRad: spec.parentAnchor.rotationRad ?? 0,
    metersPerUnit: null,
  };
  return mergeMapFrameIntoGeneratorMeta(
    {
      engine: 'unified_canvas',
      seed: spec.seedKey,
      golden: true,
      placeSeedKey: spec.placeSeedKey,
      scale: spec.kind,
      unifiedCanvas: canvas,
      bounds: DEFAULT_ATLAS_BOUNDS,
    },
    { status: 'ready', parentAnchor: anchor },
  );
}
