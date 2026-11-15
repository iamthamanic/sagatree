/**
 * dornhain-golden-hierarchy — Golden child-map seeds + canvases (Steps 5+6).
 * Location: src/domains/world/atlas/dornhain-golden-hierarchy.ts
 *
 * Pure domain — no React / Host. Naming placeholders until PM freeze:
 * Kontinent Westmark / Land Westmark under Donalu.
 *
 * ATL3-V01 round 2 (#1295, Ben 2026-11-15): Dornhain carries a canonical
 * heightfield (hills around the town, never under rooms/stamps) and the Krypta
 * is a committed Dungeon-Forge crypt (seed 1425, theme ancient). Both change
 * the G04 / V01 data fingerprints deliberately. Host mirror:
 * `server/src/bootstrap/dornhain-golden-hierarchy-seed.ts` (parity self-test).
 */
import {
  ATLAS_HEIGHTFIELD_FORMAT,
  ATLAS_HEIGHTFIELD_VERSION,
  type AtlasHeightfield,
} from './atlas-heightfield';
import {
  buildDungeonGeneratorMeta,
  generateDungeon,
  mergeDungeonMetaIntoGeneratorMeta,
  type DungeonGenerateParams,
  type DungeonGeneratorMeta,
} from './dungeon-generator';
import { rasterizeDungeonGenerateResult } from './dungeon-grid';
import { commitDungeonFeaturesToDoc, dungeonCommitPayloadFromResults } from './dungeon-forge-workflow';
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
  /** Committed Dungeon-Forge meta (`generatorMeta.dungeon`) for forge-built Golden maps. */
  readonly buildDungeonMeta?: () => DungeonGeneratorMeta;
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

/**
 * Golden Dornhain hills (canonical terrain, ATL3-V01 D-GEO-03). Compact smooth
 * bumps over a submerged base (-4): only the hill tops rise above the map sheet
 * (y ≈ -0.5), so rooms, streets and stamps stay on flat ground (self-test checks
 * clearance). Mirrored 1:1 in the Host seed.
 */
export const GOLDEN_DORNHAIN_HILLS: readonly {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly peak: number;
}[] = [
  { id: 'hill.north', x: 360, z: 300, radius: 110, peak: 28 },
  { id: 'hill.north-east', x: 490, z: 285, radius: 90, peak: 22 },
  { id: 'hill.east', x: 650, z: 520, radius: 80, peak: 16 },
  { id: 'hill.south-west', x: 210, z: 650, radius: 80, peak: 12 },
];

const GOLDEN_DORNHAIN_HF = {
  originX: 100,
  originZ: 180,
  cellSize: 20,
  cols: 41,
  rows: 33,
  base: -4,
  waterLevel: -3,
} as const;

export function buildGoldenDornhainHeightfield(): AtlasHeightfield {
  const f = GOLDEN_DORNHAIN_HF;
  const heights: number[] = [];
  for (let row = 0; row < f.rows; row += 1) {
    for (let col = 0; col < f.cols; col += 1) {
      const x = f.originX + col * f.cellSize;
      const z = f.originZ + row * f.cellSize;
      let h: number = f.base;
      for (const hill of GOLDEN_DORNHAIN_HILLS) {
        const d2 = ((x - hill.x) ** 2 + (z - hill.z) ** 2) / hill.radius ** 2;
        const s = Math.max(0, 1 - d2);
        h = Math.max(h, f.base + (hill.peak - f.base) * s * s);
      }
      heights.push(Math.round(h * 10) / 10);
    }
  }
  return {
    format: ATLAS_HEIGHTFIELD_FORMAT,
    version: ATLAS_HEIGHTFIELD_VERSION,
    assetRef: { kind: 'inline', version: ATLAS_HEIGHTFIELD_VERSION },
    originX: f.originX,
    originZ: f.originZ,
    cellSize: f.cellSize,
    cols: f.cols,
    rows: f.rows,
    heights,
    waterLevel: f.waterLevel,
  };
}

export function buildGoldenDornhainCanvas(): UnifiedCanvasDoc {
  const doc = baseDoc(
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
  return { ...doc, heightfield: buildGoldenDornhainHeightfield() };
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

/**
 * Golden Krypta = committed Dungeon-Forge crypt (ATL3-V01 decision 4). Same
 * generate → rasterize → commit path as the product forge; layout centred in
 * the 0–1000 frame. Forge stamp sizes scale with `unitScale` (1.2 cells), which
 * is far beyond the product stamp scale at Golden size — the two committed
 * objects are normalised to the previous Golden stamp sizes (lamp 0.35,
 * chest 0.5; height in cells). Geometry/IDs stay untouched forge output.
 */
export const GOLDEN_KRYPTA_FORGE_PARAMS: DungeonGenerateParams = {
  seed: 1425,
  roomCount: 5,
  loopChance: 0.18,
  themeKey: 'ancient',
  originX: 464,
  originY: 545,
  unitScale: 18,
};

const GOLDEN_KRYPTA_STAMP_SIZE: Readonly<Record<string, number>> = { lampe: 0.35, kiste: 0.5 };

function forgeGoldenKrypta() {
  const generate = generateDungeon(GOLDEN_KRYPTA_FORGE_PARAMS);
  const raster = rasterizeDungeonGenerateResult(generate);
  const payload = dungeonCommitPayloadFromResults(generate, raster);
  if (!payload || generate.seed !== GOLDEN_KRYPTA_FORGE_PARAMS.seed) {
    throw new Error('Golden Krypta forge failed — seed/params no longer produce a valid crypt');
  }
  const unit = GOLDEN_KRYPTA_FORGE_PARAMS.unitScale ?? 1;
  const objects = payload.objects.map((o) => ({
    ...o,
    size: GOLDEN_KRYPTA_STAMP_SIZE[o.type] ?? o.size / unit,
    ...(typeof o.height === 'number' ? { height: o.height / unit } : {}),
  }));
  return { generate, payload: { ...payload, objects } };
}

export function buildGoldenCryptCanvas(): UnifiedCanvasDoc {
  const { payload } = forgeGoldenKrypta();
  return commitDungeonFeaturesToDoc(emptyUnifiedCanvasDoc(false), payload, true);
}

/** `generatorMeta.dungeon` of the committed Golden Krypta (confirmed forge run). */
export function buildGoldenCryptDungeonMeta(): DungeonGeneratorMeta {
  return buildDungeonGeneratorMeta(forgeGoldenKrypta().generate, true);
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
    buildDungeonMeta: buildGoldenCryptDungeonMeta,
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
  const base: Record<string, unknown> = {
    engine: 'unified_canvas',
    seed: spec.seedKey,
    golden: true,
    placeSeedKey: spec.placeSeedKey,
    scale: spec.kind,
    unifiedCanvas: canvas,
    bounds: DEFAULT_ATLAS_BOUNDS,
  };
  return mergeMapFrameIntoGeneratorMeta(
    spec.buildDungeonMeta ? mergeDungeonMetaIntoGeneratorMeta(base, spec.buildDungeonMeta()) : base,
    { status: 'ready', parentAnchor: anchor },
  );
}
