/**
 * atlas-default-world — Calibrated Bottom-Up Default World (Donalu, SWS-02/C1–C6).
 * Location: src/domains/world/atlas/atlas-default-world.ts
 *
 * Pure domain — no React / Three.js / Host / Node built-ins.
 *
 * Structure (Ben's fixed decisions, ADR-SWS-01 §4):
 *  - 1 World root (`Welt` / Donalu, calibrated 250 m/unit = 250 km × 250 km)
 *  - 2 Continents (Kontinent Westmark, Kontinent Ostmark; 100 m/unit)
 *  - 4 Countries (Nordreich, Südmark; Sonnenküste, Eisengrat; 25 m/unit)
 *  - 10 Places (2–3 per country; 1 m/unit = 1 km × 1 km)
 *  - 1 Deep Reference Place: Dornhain → Taverne Zum Flüstern (0.04 m/unit)
 *    → Schankraum (0.02 m/unit, Tisch/Stühle/Fass/Lampe)
 *  - 4 Procedural Dungeons via Dungeon-Forge (0.08 m/unit, direction = top-down)
 *
 * Strict Bottom-Up Geometry:
 *  - Finest maps (Schankraum, Taverne, 10 Orte) are authored first.
 *  - Länder derive settlement footprints, rivers, roads, landmarks from Orte.
 *  - Kontinente derive country landmasses, rivers, roads, landmarks from Länder.
 *  - Welt derives continents, rivers, roads, landmarks from Kontinente.
 *  - Zero overlapping sibling anchors, zero shear, calibrated from Day 1,
 *    existing UnifiedCanvasStampType IDs only.
 */
import type { WorldPlaceKind } from '../places/world-place.types';
import {
  ATLAS_GEOMETRY_STRUCTURE_DIRECTION,
  computeGeometryDerivedFingerprint,
  deriveCalibratedChildMetersPerUnit,
  deriveCoarseObjectFromChild,
  deriveCoarseRoomFromChild,
  deriveCoarseStrokeFromChild,
  findGeometryOwnershipConflicts,
  type AtlasDerivedGeometryRef,
  type AtlasGeometryOwner,
} from './atlas-geometry-ownership';
import {
  ATLAS_HEIGHTFIELD_FORMAT,
  ATLAS_HEIGHTFIELD_VERSION,
  type AtlasHeightfield,
} from './atlas-heightfield';
import {
  isAtlasWorldError,
  localToWorld,
  worldToLocal,
  type AtlasWorldSpaceNode,
} from './atlas-world-space';
import {
  commitDungeonFeaturesToDoc,
  dungeonCommitPayloadFromResults,
} from './dungeon-forge-workflow';
import {
  buildDungeonGeneratorMeta,
  generateDungeon,
  type DungeonGenerateParams,
  type DungeonGeneratorMeta,
} from './dungeon-generator';
import { rasterizeDungeonGenerateResult } from './dungeon-grid';
import {
  parentAnchorsOverlapAabb,
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

export const ATLAS_DEFAULT_WORLD_ROOT_SEED = 'dornhain.unified.v4' as const;
export const ATLAS_DEFAULT_WORLD_ROOT_METERS_PER_UNIT = 250 as const;

export type DefaultWorldMapSpec = {
  readonly seedKey: string;
  readonly placeSeedKey: string;
  readonly title: string;
  readonly kind: WorldAtlasMapKind;
  /** Parent map seed; null = world root (`dornhain.unified.v4`). */
  readonly parentMapSeedKey: string | null;
  readonly parentAnchor: {
    readonly centerX: number;
    readonly centerY: number;
    readonly extentX: number;
    readonly extentY: number;
    readonly rotationRad: number;
    readonly metersPerUnit: number;
  };
  readonly buildCanvas: () => UnifiedCanvasDoc;
  readonly buildDungeonMeta?: () => DungeonGeneratorMeta;
};

export type DefaultWorldPlaceSpec = {
  readonly seedKey: string;
  readonly name: string;
  readonly kind: WorldPlaceKind;
  readonly description: string;
  readonly sortOrder: number;
  readonly parentSeedKey: string | null;
  readonly anchor: { readonly x: number; readonly y: number } | null;
};

// ─── Primitives ──────────────────────────────────────────────────────────────

function rectRoom(
  id: string,
  material: UnifiedCanvasMaterial,
  x: number,
  y: number,
  w: number,
  h: number,
  secret = false,
): UnifiedCanvasRoom {
  return secret ? { id, material, x, y, w, h, secret: true } : { id, material, x, y, w, h };
}

function mustPoly(
  id: string,
  material: UnifiedCanvasMaterial,
  points: readonly (readonly [number, number])[],
  secret = false,
): UnifiedCanvasRoom {
  const room = roomFromPolygon(id, material, points);
  if (!room) throw new Error(`Default world polygon invalid: ${id}`);
  return secret ? { ...room, secret: true } : room;
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
  extra?: { readonly height?: number; readonly secret?: boolean },
): UnifiedCanvasObject {
  return {
    id,
    type,
    x,
    y,
    size,
    ...(extra?.height !== undefined ? { height: extra.height } : {}),
    ...(extra?.secret ? { secret: true } : {}),
  };
}

function baseOutdoorDoc(
  rooms: readonly UnifiedCanvasRoom[],
  strokes: readonly UnifiedCanvasStroke[] = [],
  objects: readonly UnifiedCanvasObject[] = [],
  heightfield?: AtlasHeightfield,
): UnifiedCanvasDoc {
  const empty = emptyUnifiedCanvasDoc(false);
  return {
    ...empty,
    rooms: [rectRoom('g.ocean', 'wasser', 0, 0, 1000, 1000), ...rooms],
    strokes: [...strokes],
    objects: [...objects],
    ...(heightfield ? { heightfield } : {}),
  };
}

function makeAnchor(
  parentMapId: string,
  centerX: number,
  centerY: number,
  extent: number,
  parentMetersPerUnit: number,
): ParentSpatialAnchor & { readonly metersPerUnit: number } {
  const metersPerUnit = deriveCalibratedChildMetersPerUnit(parentMetersPerUnit, {
    extentX: extent,
    extentY: extent,
  });
  if (metersPerUnit == null) {
    throw new Error(`Invalid calibration for anchor on ${parentMapId}`);
  }
  return {
    parentMapId,
    centerX,
    centerY,
    extentX: extent,
    extentY: extent,
    rotationRad: 0,
    metersPerUnit,
  };
}

// ─── Reference Ort Dornhain Heightfield + Canonical Layout (V01 preserved) ──

export const DEFAULT_DORNHAIN_HILLS: readonly {
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

const DORNHAIN_HF = {
  originX: 100,
  originZ: 180,
  cellSize: 20,
  cols: 41,
  rows: 33,
  base: -4,
  waterLevel: -3,
} as const;

export function buildDefaultDornhainHeightfield(): AtlasHeightfield {
  const f = DORNHAIN_HF;
  const heights: number[] = [];
  for (let row = 0; row < f.rows; row += 1) {
    for (let col = 0; col < f.cols; col += 1) {
      const x = f.originX + col * f.cellSize;
      const z = f.originZ + row * f.cellSize;
      let h: number = f.base;
      for (const hill of DEFAULT_DORNHAIN_HILLS) {
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

export const DEFAULT_KRYPTA_FORGE_PARAMS: DungeonGenerateParams = {
  seed: 1425,
  roomCount: 5,
  loopChance: 0.18,
  themeKey: 'ancient',
  originX: 464,
  originY: 545,
  unitScale: 18,
};

const EXTRA_DUNGEON_PARAMS = {
  felswachtMine: {
    seed: 2401,
    roomCount: 5,
    loopChance: 0.22,
    themeKey: 'frost',
    originX: 460,
    originY: 520,
    unitScale: 18,
  },
  moorbrueckVault: {
    seed: 3402,
    roomCount: 5,
    loopChance: 0.2,
    themeKey: 'verdant',
    originX: 470,
    originY: 530,
    unitScale: 18,
  },
  sturmpassFort: {
    seed: 4403,
    roomCount: 5,
    loopChance: 0.16,
    themeKey: 'grim',
    originX: 468,
    originY: 528,
    unitScale: 18,
  },
} as const satisfies Record<string, DungeonGenerateParams>;

function forgeDungeonCanvas(params: DungeonGenerateParams): {
  readonly doc: UnifiedCanvasDoc;
  readonly meta: DungeonGeneratorMeta;
} {
  const generate = generateDungeon(params);
  const raster = rasterizeDungeonGenerateResult(generate);
  const payload = dungeonCommitPayloadFromResults(generate, raster);
  if (!payload || generate.seed !== params.seed) {
    throw new Error(`Procedural dungeon forge failed for seed ${params.seed}`);
  }
  return {
    doc: commitDungeonFeaturesToDoc(emptyUnifiedCanvasDoc(false), payload, true),
    meta: buildDungeonGeneratorMeta(generate, true),
  };
}

// ─── Anchor Topology (Calibrated from Day 1, Zero Overlap, Zero Shear) ──────

const WORLD_MPU = ATLAS_DEFAULT_WORLD_ROOT_METERS_PER_UNIT; // 250 m/unit

const ANCHOR_WESTMARK = makeAnchor(ATLAS_DEFAULT_WORLD_ROOT_SEED, 270, 480, 200, WORLD_MPU); // 100 m/unit
const ANCHOR_OSTMARK = makeAnchor(ATLAS_DEFAULT_WORLD_ROOT_SEED, 730, 500, 200, WORLD_MPU); // 100 m/unit

const ANCHOR_NORDREICH = makeAnchor('dornhain.map.continent.westmark', 460, 320, 125, ANCHOR_WESTMARK.metersPerUnit); // 25 m/unit
const ANCHOR_SUEDMARK = makeAnchor('dornhain.map.continent.westmark', 500, 670, 125, ANCHOR_WESTMARK.metersPerUnit); // 25 m/unit
const ANCHOR_SONNENKUESTE = makeAnchor('dornhain.map.continent.ostmark', 340, 520, 125, ANCHOR_OSTMARK.metersPerUnit); // 25 m/unit
const ANCHOR_EISENGRAT = makeAnchor('dornhain.map.continent.ostmark', 680, 440, 125, ANCHOR_OSTMARK.metersPerUnit); // 25 m/unit

// 10 Places (1 m/unit = 1 km × 1 km)
const ANCHOR_DORNHAIN = makeAnchor('dornhain.map.country.westmark', 360, 510, 20, ANCHOR_NORDREICH.metersPerUnit);
const ANCHOR_FELSWACHT = makeAnchor('dornhain.map.country.westmark', 610, 310, 20, ANCHOR_NORDREICH.metersPerUnit);
const ANCHOR_SILBERFURT = makeAnchor('dornhain.map.country.westmark', 560, 620, 20, ANCHOR_NORDREICH.metersPerUnit);

const ANCHOR_WEIDENHAFEN = makeAnchor('dornhain.map.country.suedmark', 340, 560, 20, ANCHOR_SUEDMARK.metersPerUnit);
const ANCHOR_MOORBRUECK = makeAnchor('dornhain.map.country.suedmark', 620, 460, 20, ANCHOR_SUEDMARK.metersPerUnit);

const ANCHOR_AURELIA = makeAnchor('dornhain.map.country.sonnenkueste', 330, 480, 20, ANCHOR_SONNENKUESTE.metersPerUnit);
const ANCHOR_SALZKLIPPE = makeAnchor('dornhain.map.country.sonnenkueste', 590, 380, 20, ANCHOR_SONNENKUESTE.metersPerUnit);
const ANCHOR_KORNFELD = makeAnchor('dornhain.map.country.sonnenkueste', 520, 660, 20, ANCHOR_SONNENKUESTE.metersPerUnit);

const ANCHOR_SCHMIEDENTAL = makeAnchor('dornhain.map.country.eisengrat', 420, 460, 20, ANCHOR_EISENGRAT.metersPerUnit);
const ANCHOR_STURMPASS = makeAnchor('dornhain.map.country.eisengrat', 640, 560, 20, ANCHOR_EISENGRAT.metersPerUnit);

// Deep reference chain under Dornhain: Ort → Gebäude → Raum → Objekt
const ANCHOR_TAVERN = makeAnchor('dornhain.map.place.dornhain', 328, 528, 20, ANCHOR_DORNHAIN.metersPerUnit); // 0.04 m/unit
const ANCHOR_TAPROOM = makeAnchor('dornhain.map.loc.tavern', 400, 360, 250, ANCHOR_TAVERN.metersPerUnit); // 0.02 m/unit

// 4 Procedural Dungeons (top-down infill, 0.08 m/unit)
const ANCHOR_CRYPT = makeAnchor('dornhain.map.place.dornhain', 406, 462, 40, ANCHOR_DORNHAIN.metersPerUnit);
const ANCHOR_FELSWACHT_MINE = makeAnchor('dornhain.map.place.felswacht', 520, 420, 40, ANCHOR_FELSWACHT.metersPerUnit);
const ANCHOR_MOORBRUECK_VAULT = makeAnchor('dornhain.map.place.moorbrueck', 480, 540, 40, ANCHOR_MOORBRUECK.metersPerUnit);
const ANCHOR_STURMPASS_FORT = makeAnchor('dornhain.map.place.sturmpass', 500, 480, 40, ANCHOR_STURMPASS.metersPerUnit);

// ─── Level 6 & 5 (Finest Authoritative Interiors) ────────────────────────────

export function buildDefaultTaproomCanvas(): UnifiedCanvasDoc {
  const empty = emptyUnifiedCanvasDoc(false);
  return {
    ...empty,
    rooms: [
      rectRoom('g.room.taproom', 'holz', 140, 140, 720, 640),
      rectRoom('g.room.hearth', 'stein', 180, 180, 240, 140),
    ],
    walls: [
      { id: 'g.room.w1', x1: 140, y1: 140, x2: 860, y2: 140, width: 12 },
      { id: 'g.room.w2', x1: 140, y1: 140, x2: 140, y2: 780, width: 12 },
      { id: 'g.room.w3', x1: 860, y1: 140, x2: 860, y2: 780, width: 12 },
      { id: 'g.room.w4', x1: 140, y1: 780, x2: 860, y2: 780, width: 12 },
    ],
    doors: [{ id: 'g.room.d1', wallId: 'g.room.w4', t: 0.5, width: 72 }],
    objects: [
      stamp('g.tav.table', 'tisch', 480, 480, 0.72),
      stamp('g.tav.chair-a', 'stuhl', 410, 450, 0.42),
      stamp('g.tav.chair-b', 'stuhl', 550, 450, 0.42),
      stamp('g.tav.barrel', 'fass', 240, 320, 0.48),
      stamp('g.tav.lantern', 'lampe', 480, 360, 0.38),
      stamp('g.tav.rug', 'teppich', 480, 520, 0.9),
    ],
  };
}

export function buildDefaultTavernCanvas(): UnifiedCanvasDoc {
  const taproom = buildDefaultTaproomCanvas();
  const empty = emptyUnifiedCanvasDoc(false);
  const derivedRooms = taproom.rooms
    .map((r) => deriveCoarseRoomFromChild(ANCHOR_TAPROOM, r, `der.tav.${r.id}`))
    .filter((r): r is UnifiedCanvasRoom => r !== null);
  const derivedObjects = taproom.objects.map((o) =>
    deriveCoarseObjectFromChild(ANCHOR_TAPROOM, o, o.id),
  );
  return {
    ...empty,
    rooms: [
      rectRoom('g.tav.common', 'holz', 200, 200, 400, 320),
      rectRoom('g.tav.bar', 'stein', 220, 220, 140, 80),
      ...derivedRooms,
    ],
    walls: [
      { id: 'g.tav.w1', x1: 200, y1: 200, x2: 600, y2: 200, width: 8 },
      { id: 'g.tav.w2', x1: 200, y1: 200, x2: 200, y2: 520, width: 8 },
      { id: 'g.tav.w3', x1: 600, y1: 200, x2: 600, y2: 520, width: 8 },
      { id: 'g.tav.w4', x1: 200, y1: 520, x2: 600, y2: 520, width: 8 },
    ],
    objects: derivedObjects,
  };
}

// ─── Level 4: 10 Authoritative Places (Orte, 1 m/unit) ──────────────────────

export function buildDefaultDornhainCanvas(): UnifiedCanvasDoc {
  // Canonical Dornhain layout + heightfield preserved 1:1 for ATL3-V01 visual contract.
  return baseOutdoorDoc(
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
    buildDefaultDornhainHeightfield(),
  );
}

type PlaceBlueprint = {
  readonly seedKey: string;
  readonly placeSeedKey: string;
  readonly title: string;
  readonly description: string;
  readonly countrySeedKey: string;
  readonly countryPlaceSeedKey: string;
  readonly anchor: ParentSpatialAnchor & { readonly metersPerUnit: number };
  readonly groundMaterial: UnifiedCanvasMaterial;
  readonly riverPoints?: readonly (readonly [number, number])[];
  readonly roadPoints: readonly (readonly [number, number])[];
  readonly primaryStamp: UnifiedCanvasObject['type'];
  readonly sortOrder: number;
  readonly customBuild?: () => UnifiedCanvasDoc;
};

const PLACE_BLUEPRINTS: readonly PlaceBlueprint[] = [
  // Nordreich (3 Orte)
  {
    seedKey: 'dornhain.map.place.dornhain',
    placeSeedKey: 'place.dornhain',
    title: 'Dornhain',
    description: 'Stadt in Donalu — tiefer Referenz-Ort mit Taverne, Schankraum & Krypta.',
    countrySeedKey: 'dornhain.map.country.westmark',
    countryPlaceSeedKey: 'country.westmark',
    anchor: ANCHOR_DORNHAIN,
    groundMaterial: 'gras',
    roadPoints: [
      [240, 500],
      [360, 500],
      [480, 480],
    ],
    primaryStamp: 'haus',
    sortOrder: 10,
    customBuild: buildDefaultDornhainCanvas,
  },
  {
    seedKey: 'dornhain.map.place.felswacht',
    placeSeedKey: 'place.felswacht',
    title: 'Felswacht',
    description: 'Bergfestung im Norden Nordreichs über den Minen von Felswacht.',
    countrySeedKey: 'dornhain.map.country.westmark',
    countryPlaceSeedKey: 'country.westmark',
    anchor: ANCHOR_FELSWACHT,
    groundMaterial: 'stein',
    riverPoints: [
      [380, 120],
      [430, 440],
      [410, 860],
    ],
    roadPoints: [
      [220, 620],
      [480, 490],
      [740, 420],
    ],
    primaryStamp: 'turm',
    sortOrder: 50,
  },
  {
    seedKey: 'dornhain.map.place.silberfurt',
    placeSeedKey: 'place.silberfurt',
    title: 'Silberfurt',
    description: 'Flussübergang und Handelsfurt am Silberbach.',
    countrySeedKey: 'dornhain.map.country.westmark',
    countryPlaceSeedKey: 'country.westmark',
    anchor: ANCHOR_SILBERFURT,
    groundMaterial: 'gras',
    riverPoints: [
      [440, 100],
      [490, 500],
      [530, 900],
    ],
    roadPoints: [
      [180, 510],
      [500, 500],
      [820, 490],
    ],
    primaryStamp: 'haus',
    sortOrder: 60,
  },
  // Südmark (2 Orte)
  {
    seedKey: 'dornhain.map.place.weidenhafen',
    placeSeedKey: 'place.weidenhafen',
    title: 'Weidenhafen',
    description: 'Südlicher Küstenhafen der Südmark mit Werften und Lagerhäusern.',
    countrySeedKey: 'dornhain.map.country.suedmark',
    countryPlaceSeedKey: 'country.suedmark',
    anchor: ANCHOR_WEIDENHAFEN,
    groundMaterial: 'sand',
    riverPoints: [
      [540, 120],
      [480, 480],
      [360, 860],
    ],
    roadPoints: [
      [260, 460],
      [520, 470],
      [790, 440],
    ],
    primaryStamp: 'haus',
    sortOrder: 70,
  },
  {
    seedKey: 'dornhain.map.place.moorbrueck',
    placeSeedKey: 'place.moorbrueck',
    title: 'Moorbrück',
    description: 'Pfahlbausiedlung am Rand der nebligen Südmoore.',
    countrySeedKey: 'dornhain.map.country.suedmark',
    countryPlaceSeedKey: 'country.suedmark',
    anchor: ANCHOR_MOORBRUECK,
    groundMaterial: 'erde',
    riverPoints: [
      [460, 140],
      [510, 520],
      [470, 880],
    ],
    roadPoints: [
      [200, 500],
      [500, 510],
      [760, 540],
    ],
    primaryStamp: 'turm',
    sortOrder: 80,
  },
  // Sonnenküste (3 Orte)
  {
    seedKey: 'dornhain.map.place.aurelia',
    placeSeedKey: 'place.aurelia',
    title: 'Aurelia',
    description: 'Sonnige Hafen- und Handelsstadt an der Westbucht Ostmarks.',
    countrySeedKey: 'dornhain.map.country.sonnenkueste',
    countryPlaceSeedKey: 'country.sonnenkueste',
    anchor: ANCHOR_AURELIA,
    groundMaterial: 'sand',
    riverPoints: [
      [620, 160],
      [520, 500],
      [340, 820],
    ],
    roadPoints: [
      [280, 520],
      [520, 480],
      [810, 450],
    ],
    primaryStamp: 'haus',
    sortOrder: 90,
  },
  {
    seedKey: 'dornhain.map.place.salzklippe',
    placeSeedKey: 'place.salzklippe',
    title: 'Salzklippe',
    description: 'Steilküstenort der Salzsammler und Leuchtfeuerwärter.',
    countrySeedKey: 'dornhain.map.country.sonnenkueste',
    countryPlaceSeedKey: 'country.sonnenkueste',
    anchor: ANCHOR_SALZKLIPPE,
    groundMaterial: 'stein',
    roadPoints: [
      [220, 560],
      [500, 500],
      [760, 460],
    ],
    primaryStamp: 'turm',
    sortOrder: 100,
  },
  {
    seedKey: 'dornhain.map.place.kornfeld',
    placeSeedKey: 'place.kornfeld',
    title: 'Kornfeld',
    description: 'Fruchtbare Bauernsiedlung in den sanften Hügeln der Sonnenküste.',
    countrySeedKey: 'dornhain.map.country.sonnenkueste',
    countryPlaceSeedKey: 'country.sonnenkueste',
    anchor: ANCHOR_KORNFELD,
    groundMaterial: 'gras',
    riverPoints: [
      [480, 120],
      [500, 520],
      [540, 880],
    ],
    roadPoints: [
      [220, 480],
      [500, 500],
      [780, 520],
    ],
    primaryStamp: 'haus',
    sortOrder: 110,
  },
  // Eisengrat (2 Orte)
  {
    seedKey: 'dornhain.map.place.schmiedental',
    placeSeedKey: 'place.schmiedental',
    title: 'Schmiedental',
    description: 'Handwerks- und Schmiedestadt im Herzen des Eisengrats.',
    countrySeedKey: 'dornhain.map.country.eisengrat',
    countryPlaceSeedKey: 'country.eisengrat',
    anchor: ANCHOR_SCHMIEDENTAL,
    groundMaterial: 'stein',
    riverPoints: [
      [560, 100],
      [520, 480],
      [460, 880],
    ],
    roadPoints: [
      [200, 480],
      [500, 490],
      [800, 520],
    ],
    primaryStamp: 'haus',
    sortOrder: 120,
  },
  {
    seedKey: 'dornhain.map.place.sturmpass',
    placeSeedKey: 'place.sturmpass',
    title: 'Sturmpass',
    description: 'Hochgebirgspass mit Wachturm über der Alten Passfestung.',
    countrySeedKey: 'dornhain.map.country.eisengrat',
    countryPlaceSeedKey: 'country.eisengrat',
    anchor: ANCHOR_STURMPASS,
    groundMaterial: 'erde',
    roadPoints: [
      [210, 540],
      [500, 500],
      [790, 440],
    ],
    primaryStamp: 'turm',
    sortOrder: 130,
  },
];

function buildStandardPlaceCanvas(bp: PlaceBlueprint): UnifiedCanvasDoc {
  const slug = bp.placeSeedKey.replace(/^place\./, '');
  const rooms: UnifiedCanvasRoom[] = [
    mustPoly(`p.${slug}.ground`, bp.groundMaterial, [
      [140, 200],
      [480, 140],
      [840, 220],
      [880, 560],
      [780, 820],
      [420, 860],
      [160, 740],
      [120, 440],
    ]),
    rectRoom(`p.${slug}.plaza`, 'pflaster', 410, 430, 180, 140),
  ];
  const strokes: UnifiedCanvasStroke[] = [
    stroke(`p.${slug}.road`, 'pflaster', 12, bp.roadPoints),
  ];
  if (bp.riverPoints) {
    strokes.push(stroke(`p.${slug}.river`, 'wasser', 14, bp.riverPoints));
  }
  const objects: UnifiedCanvasObject[] = [
    stamp(`p.${slug}.main`, bp.primaryStamp, 500, 500, 0.62, { height: 1.25 }),
    stamp(`p.${slug}.hall`, 'haus', 430, 530, 0.52),
    stamp(`p.${slug}.tree-a`, 'baum', 320, 430, 0.52),
    stamp(`p.${slug}.pine-a`, 'tanne', 670, 580, 0.5),
    stamp(`p.${slug}.rock-a`, 'fels', 610, 390, 0.44),
  ];
  return baseOutdoorDoc(rooms, strokes, objects);
}

// ─── Bottom-Up Assembly (Places → Countries → Continents → World) ───────────

type CountryBlueprint = {
  readonly seedKey: string;
  readonly placeSeedKey: string;
  readonly title: string;
  readonly description: string;
  readonly continentSeedKey: string;
  readonly continentPlaceSeedKey: string;
  readonly anchor: ParentSpatialAnchor & { readonly metersPerUnit: number };
  readonly terrainMaterial: UnifiedCanvasMaterial;
  readonly polygon: readonly (readonly [number, number])[];
  readonly sortOrder: number;
};

const COUNTRY_BLUEPRINTS: readonly CountryBlueprint[] = [
  {
    seedKey: 'dornhain.map.country.westmark',
    placeSeedKey: 'country.westmark',
    title: 'Nordreich',
    description: 'Land Nordreich auf dem Kontinent Westmark (Bottom-Up aus Dornhain, Felswacht, Silberfurt abgeleitet).',
    continentSeedKey: 'dornhain.map.continent.westmark',
    continentPlaceSeedKey: 'continent.westmark',
    anchor: ANCHOR_NORDREICH,
    terrainMaterial: 'gras',
    polygon: [
      [170, 210],
      [480, 160],
      [810, 220],
      [840, 520],
      [760, 790],
      [440, 820],
      [180, 720],
      [150, 440],
    ],
    sortOrder: 5,
  },
  {
    seedKey: 'dornhain.map.country.suedmark',
    placeSeedKey: 'country.suedmark',
    title: 'Südmark',
    description: 'Südliches Küsten- und Moorland auf Westmark (Bottom-Up aus Weidenhafen & Moorbrück abgeleitet).',
    continentSeedKey: 'dornhain.map.continent.westmark',
    continentPlaceSeedKey: 'continent.westmark',
    anchor: ANCHOR_SUEDMARK,
    terrainMaterial: 'erde',
    polygon: [
      [180, 240],
      [520, 190],
      [820, 260],
      [850, 560],
      [740, 810],
      [380, 830],
      [170, 680],
    ],
    sortOrder: 65,
  },
  {
    seedKey: 'dornhain.map.country.sonnenkueste',
    placeSeedKey: 'country.sonnenkueste',
    title: 'Sonnenküste',
    description: 'Fruchtbares Küstenland im Westen Ostmarks (Bottom-Up aus Aurelia, Salzklippe & Kornfeld abgeleitet).',
    continentSeedKey: 'dornhain.map.continent.ostmark',
    continentPlaceSeedKey: 'continent.ostmark',
    anchor: ANCHOR_SONNENKUESTE,
    terrainMaterial: 'sand',
    polygon: [
      [160, 220],
      [500, 170],
      [820, 250],
      [840, 580],
      [720, 830],
      [360, 820],
      [150, 610],
    ],
    sortOrder: 85,
  },
  {
    seedKey: 'dornhain.map.country.eisengrat',
    placeSeedKey: 'country.eisengrat',
    title: 'Eisengrat',
    description: 'Hochgebirgsreich im Osten Ostmarks (Bottom-Up aus Schmiedental & Sturmpass abgeleitet).',
    continentSeedKey: 'dornhain.map.continent.ostmark',
    continentPlaceSeedKey: 'continent.ostmark',
    anchor: ANCHOR_EISENGRAT,
    terrainMaterial: 'stein',
    polygon: [
      [190, 210],
      [540, 160],
      [830, 240],
      [860, 560],
      [750, 810],
      [410, 820],
      [180, 640],
    ],
    sortOrder: 115,
  },
];

type ContinentBlueprint = {
  readonly seedKey: string;
  readonly placeSeedKey: string;
  readonly title: string;
  readonly description: string;
  readonly anchor: ParentSpatialAnchor & { readonly metersPerUnit: number };
  readonly worldRoomId: string;
  readonly worldRiverId: string;
  readonly sortOrder: number;
};

const CONTINENT_BLUEPRINTS: readonly ContinentBlueprint[] = [
  {
    seedKey: 'dornhain.map.continent.westmark',
    placeSeedKey: 'continent.westmark',
    title: 'Kontinent Westmark',
    description: 'Westlicher Kontinent Donalu (Bottom-Up aus Nordreich & Südmark abgeleitet).',
    anchor: ANCHOR_WESTMARK,
    worldRoomId: 'w.west-core',
    worldRiverId: 'w.river-w',
    sortOrder: 0,
  },
  {
    seedKey: 'dornhain.map.continent.ostmark',
    placeSeedKey: 'continent.ostmark',
    title: 'Kontinent Ostmark',
    description: 'Östlicher Kontinent Donalu (Bottom-Up aus Sonnenküste & Eisengrat abgeleitet).',
    anchor: ANCHOR_OSTMARK,
    worldRoomId: 'w.east-core',
    worldRiverId: 'w.river-e',
    sortOrder: 82,
  },
];

export type CalibratedDefaultWorldBundle = {
  readonly rootSeedKey: typeof ATLAS_DEFAULT_WORLD_ROOT_SEED;
  readonly rootMetersPerUnit: number;
  readonly rootDoc: UnifiedCanvasDoc;
  readonly maps: readonly DefaultWorldMapSpec[];
  readonly places: readonly DefaultWorldPlaceSpec[];
  readonly owners: readonly AtlasGeometryOwner[];
  readonly derivedRefs: readonly AtlasDerivedGeometryRef[];
  readonly worldNodes: Readonly<Record<string, AtlasWorldSpaceNode>>;
};

let cachedBundle: CalibratedDefaultWorldBundle | null = null;

/**
 * Assemble the complete calibrated Bottom-Up default world (cached immutable bundle).
 * Order of construction is STRICTLY bottom-up:
 *   Raum/Dungeons → Gebäude → 10 Orte → 4 Länder → 2 Kontinente → Welt Donalu.
 */
export function buildCalibratedDefaultWorld(): CalibratedDefaultWorldBundle {
  if (cachedBundle) return cachedBundle;

  const owners: AtlasGeometryOwner[] = [];
  const derivedRefs: AtlasDerivedGeometryRef[] = [];

  // 1) Finest interiors + procedural dungeons
  const taproomDoc = buildDefaultTaproomCanvas();
  const tavernDoc = buildDefaultTavernCanvas();
  const krypta = forgeDungeonCanvas(DEFAULT_KRYPTA_FORGE_PARAMS);
  const felswachtMine = forgeDungeonCanvas(EXTRA_DUNGEON_PARAMS.felswachtMine);
  const moorbrueckVault = forgeDungeonCanvas(EXTRA_DUNGEON_PARAMS.moorbrueckVault);
  const sturmpassFort = forgeDungeonCanvas(EXTRA_DUNGEON_PARAMS.sturmpassFort);

  owners.push(
    {
      structure: 'room',
      structureId: 'room.dornhain.taproom',
      direction: ATLAS_GEOMETRY_STRUCTURE_DIRECTION.room,
      authoritativeMapId: 'dornhain.map.room.taproom',
    },
    {
      structure: 'building',
      structureId: 'building.dornhain.tavern',
      direction: ATLAS_GEOMETRY_STRUCTURE_DIRECTION.building,
      authoritativeMapId: 'dornhain.map.loc.tavern',
    },
    {
      structure: 'dungeon',
      structureId: 'dungeon.dornhain.crypt',
      direction: ATLAS_GEOMETRY_STRUCTURE_DIRECTION.dungeon,
      authoritativeMapId: 'dornhain.map.loc.crypt',
    },
    {
      structure: 'dungeon',
      structureId: 'dungeon.felswacht.mine',
      direction: ATLAS_GEOMETRY_STRUCTURE_DIRECTION.dungeon,
      authoritativeMapId: 'dornhain.map.loc.felswacht-mine',
    },
    {
      structure: 'dungeon',
      structureId: 'dungeon.moorbrueck.vault',
      direction: ATLAS_GEOMETRY_STRUCTURE_DIRECTION.dungeon,
      authoritativeMapId: 'dornhain.map.loc.moorbrueck-vault',
    },
    {
      structure: 'dungeon',
      structureId: 'dungeon.sturmpass.fort',
      direction: ATLAS_GEOMETRY_STRUCTURE_DIRECTION.dungeon,
      authoritativeMapId: 'dornhain.map.loc.sturmpass-fort',
    },
  );

  // 2) 10 Authoritative Places (Orte)
  const placeDocs = new Map<string, UnifiedCanvasDoc>();
  for (const bp of PLACE_BLUEPRINTS) {
    const doc = bp.customBuild ? bp.customBuild() : buildStandardPlaceCanvas(bp);
    placeDocs.set(bp.seedKey, doc);
    owners.push({
      structure: 'terrain',
      structureId: `terrain.${bp.placeSeedKey}`,
      direction: 'bottom-up',
      authoritativeMapId: bp.seedKey,
    });
    if (bp.riverPoints) {
      owners.push({
        structure: 'river',
        structureId: `river.${bp.placeSeedKey}`,
        direction: 'bottom-up',
        authoritativeMapId: bp.seedKey,
      });
    }
    owners.push({
      structure: 'road',
      structureId: `road.${bp.placeSeedKey}`,
      direction: 'bottom-up',
      authoritativeMapId: bp.seedKey,
    });
  }

  // 3) 4 Countries — DERIVED bottom-up from their child Places
  const countryDocs = new Map<string, UnifiedCanvasDoc>();
  for (const cbp of COUNTRY_BLUEPRINTS) {
    const childPlaces = PLACE_BLUEPRINTS.filter((p) => p.countrySeedKey === cbp.seedKey);
    const derivedRooms: UnifiedCanvasRoom[] = [
      mustPoly(`c.${cbp.placeSeedKey}.realm`, cbp.terrainMaterial, cbp.polygon),
    ];
    const derivedStrokes: UnifiedCanvasStroke[] = [];
    const derivedObjects: UnifiedCanvasObject[] = [];

    owners.push({
      structure: 'political',
      structureId: `political.${cbp.placeSeedKey}`,
      direction: 'bottom-up',
      authoritativeMapId: cbp.seedKey,
    });

    const roadWaypoints: [number, number][] = [];
    const riverWaypoints: [number, number][] = [];

    for (const pbp of childPlaces) {
      const pdoc = placeDocs.get(pbp.seedKey)!;
      // Derive settlement core footprint
      const plaza = pdoc.rooms.find((r) => r.id !== 'g.ocean');
      if (plaza) {
        const dr = deriveCoarseRoomFromChild(pbp.anchor, plaza, `der.${pbp.placeSeedKey}.footprint`);
        if (dr) {
          derivedRooms.push(dr);
          derivedRefs.push({
            derivedFeatureId: dr.id,
            sourceMapId: pbp.seedKey,
            sourceFeatureId: plaza.id,
            structure: 'terrain',
            fingerprint: computeGeometryDerivedFingerprint(pbp.seedKey, dr),
          });
        }
      }
      // Derive child rivers & roads directly via anchor transform
      for (const st of pdoc.strokes) {
        const ds = deriveCoarseStrokeFromChild(pbp.anchor, st, `der.${pbp.placeSeedKey}.${st.id}`, {
          minWidth: 4,
          maxWidth: 10,
        });
        if (ds) {
          derivedStrokes.push(ds);
          derivedRefs.push({
            derivedFeatureId: ds.id,
            sourceMapId: pbp.seedKey,
            sourceFeatureId: st.id,
            structure: st.material === 'wasser' ? 'river' : 'road',
            fingerprint: computeGeometryDerivedFingerprint(pbp.seedKey, ds),
          });
          if (st.material === 'wasser') {
            riverWaypoints.push([ds.points[0]![0], ds.points[0]![1]]);
            riverWaypoints.push([
              ds.points[ds.points.length - 1]![0],
              ds.points[ds.points.length - 1]![1],
            ]);
          } else if (st.material === 'pflaster') {
            roadWaypoints.push([pbp.anchor.centerX, pbp.anchor.centerY]);
          }
        }
      }
      // Derive primary settlement landmark stamp
      const mainObj = pdoc.objects[0];
      if (mainObj) {
        const dobj = deriveCoarseObjectFromChild(
          pbp.anchor,
          mainObj,
          `g.pin.${pbp.placeSeedKey.replace(/^place\./, '')}`,
          { minSize: 0.45, maxSize: 0.6 },
        );
        derivedObjects.push(dobj);
        derivedRefs.push({
          derivedFeatureId: dobj.id,
          sourceMapId: pbp.seedKey,
          sourceFeatureId: mainObj.id,
          structure: 'building',
          fingerprint: computeGeometryDerivedFingerprint(pbp.seedKey, dobj),
        });
      }
    }

    // Connective inter-settlement road joining exact derived place centers
    if (roadWaypoints.length >= 2) {
      derivedStrokes.push(stroke(`c.${cbp.placeSeedKey}.highway`, 'pflaster', 8, roadWaypoints));
    }
    // Connective river spine joining exact derived child river endpoints
    if (riverWaypoints.length >= 2) {
      derivedStrokes.push(stroke(`c.${cbp.placeSeedKey}.river`, 'wasser', 9, riverWaypoints));
    }

    countryDocs.set(cbp.seedKey, baseOutdoorDoc(derivedRooms, derivedStrokes, derivedObjects));
  }

  // 4) 2 Continents — DERIVED bottom-up from their 2 child Countries
  const continentDocs = new Map<string, UnifiedCanvasDoc>();
  for (const cont of CONTINENT_BLUEPRINTS) {
    const childCountries = COUNTRY_BLUEPRINTS.filter((c) => c.continentSeedKey === cont.seedKey);
    const derivedRooms: UnifiedCanvasRoom[] = [];
    const derivedStrokes: UnifiedCanvasStroke[] = [];
    const derivedObjects: UnifiedCanvasObject[] = [];

    // Compute continent coastline hull enclosing its child countries (bottom-up landmass)
    const hullPts: [number, number][] = [];
    for (const cbp of childCountries) {
      const cdoc = countryDocs.get(cbp.seedKey)!;
      const realmRoom = cdoc.rooms.find((r) => r.id.endsWith('.realm'));
      if (realmRoom) {
        const dr = deriveCoarseRoomFromChild(cbp.anchor, realmRoom, `der.${cbp.placeSeedKey}.land`, {
          simplifyEpsilon: 1.5,
        });
        if (dr) {
          derivedRooms.push(dr);
          if (dr.points) {
            for (const pt of dr.points) hullPts.push([pt[0], pt[1]]);
          }
          derivedRefs.push({
            derivedFeatureId: dr.id,
            sourceMapId: cbp.seedKey,
            sourceFeatureId: realmRoom.id,
            structure: 'political',
            fingerprint: computeGeometryDerivedFingerprint(cbp.seedKey, dr),
          });
        }
      }
      // Project country highways & rivers up to continent
      for (const st of cdoc.strokes) {
        if (!st.id.endsWith('.highway') && !st.id.endsWith('.river')) continue;
        const ds = deriveCoarseStrokeFromChild(
          cbp.anchor,
          st,
          `der.${cbp.placeSeedKey}.${st.id.endsWith('.river') ? 'river' : 'road'}`,
          { minWidth: 5, maxWidth: 10 },
        );
        if (ds) {
          derivedStrokes.push(ds);
          derivedRefs.push({
            derivedFeatureId: ds.id,
            sourceMapId: cbp.seedKey,
            sourceFeatureId: st.id,
            structure: st.material === 'wasser' ? 'river' : 'road',
            fingerprint: computeGeometryDerivedFingerprint(cbp.seedKey, ds),
          });
        }
      }
      // Project country settlement markers up to continent
      for (const obj of cdoc.objects) {
        const dobj = deriveCoarseObjectFromChild(cbp.anchor, obj, `cont.${obj.id}`, {
          minSize: 0.38,
          maxSize: 0.55,
        });
        derivedObjects.push(dobj);
      }
    }

    // Derive landmass polygon wrapping child country bounds cleanly
    const minX = Math.max(90, Math.min(...hullPts.map((p) => p[0])) - 90);
    const maxX = Math.min(910, Math.max(...hullPts.map((p) => p[0])) + 90);
    const minY = Math.max(90, Math.min(...hullPts.map((p) => p[1])) - 80);
    const maxY = Math.min(910, Math.max(...hullPts.map((p) => p[1])) + 80);
    const midX = Math.round((minX + maxX) / 2);
    const midY = Math.round((minY + maxY) / 2);
    const continentBase = mustPoly(`g.land.${cont.placeSeedKey.replace(/^continent\./, '')}`, 'gras', [
      [Math.round(minX + 35), Math.round(minY + 20)],
      [midX, Math.round(minY)],
      [Math.round(maxX - 30), Math.round(minY + 35)],
      [Math.round(maxX), midY],
      [Math.round(maxX - 40), Math.round(maxY - 25)],
      [midX, Math.round(maxY)],
      [Math.round(minX + 30), Math.round(maxY - 35)],
      [Math.round(minX), midY],
    ]);

    owners.push({
      structure: 'landmass',
      structureId: `landmass.${cont.placeSeedKey}`,
      direction: 'bottom-up',
      authoritativeMapId: cont.seedKey,
    });

    continentDocs.set(
      cont.seedKey,
      baseOutdoorDoc([continentBase, ...derivedRooms], derivedStrokes, derivedObjects),
    );
  }

  // 5) Build World Space graph so World Root can derive exact multi-level positions
  const worldNodes: Record<string, AtlasWorldSpaceNode> = {
    [ATLAS_DEFAULT_WORLD_ROOT_SEED]: {
      id: ATLAS_DEFAULT_WORLD_ROOT_SEED,
      parentAnchor: null,
      bounds: DEFAULT_ATLAS_BOUNDS,
    },
    'dornhain.map.continent.westmark': {
      id: 'dornhain.map.continent.westmark',
      parentAnchor: ANCHOR_WESTMARK,
      bounds: DEFAULT_ATLAS_BOUNDS,
    },
    'dornhain.map.continent.ostmark': {
      id: 'dornhain.map.continent.ostmark',
      parentAnchor: ANCHOR_OSTMARK,
      bounds: DEFAULT_ATLAS_BOUNDS,
    },
    ...Object.fromEntries(
      COUNTRY_BLUEPRINTS.map((c) => [
        c.seedKey,
        { id: c.seedKey, parentAnchor: c.anchor, bounds: DEFAULT_ATLAS_BOUNDS },
      ]),
    ),
    ...Object.fromEntries(
      PLACE_BLUEPRINTS.map((p) => [
        p.seedKey,
        { id: p.seedKey, parentAnchor: p.anchor, bounds: DEFAULT_ATLAS_BOUNDS },
      ]),
    ),
    'dornhain.map.loc.tavern': {
      id: 'dornhain.map.loc.tavern',
      parentAnchor: ANCHOR_TAVERN,
      bounds: DEFAULT_ATLAS_BOUNDS,
    },
    'dornhain.map.room.taproom': {
      id: 'dornhain.map.room.taproom',
      parentAnchor: ANCHOR_TAPROOM,
      bounds: DEFAULT_ATLAS_BOUNDS,
    },
    'dornhain.map.loc.crypt': {
      id: 'dornhain.map.loc.crypt',
      parentAnchor: ANCHOR_CRYPT,
      bounds: DEFAULT_ATLAS_BOUNDS,
    },
    'dornhain.map.loc.felswacht-mine': {
      id: 'dornhain.map.loc.felswacht-mine',
      parentAnchor: ANCHOR_FELSWACHT_MINE,
      bounds: DEFAULT_ATLAS_BOUNDS,
    },
    'dornhain.map.loc.moorbrueck-vault': {
      id: 'dornhain.map.loc.moorbrueck-vault',
      parentAnchor: ANCHOR_MOORBRUECK_VAULT,
      bounds: DEFAULT_ATLAS_BOUNDS,
    },
    'dornhain.map.loc.sturmpass-fort': {
      id: 'dornhain.map.loc.sturmpass-fort',
      parentAnchor: ANCHOR_STURMPASS_FORT,
      bounds: DEFAULT_ATLAS_BOUNDS,
    },
  };

  // 6) World Root (`Welt` / Donalu) — DERIVED strictly bottom-up from the 2 Continents
  const worldRooms: UnifiedCanvasRoom[] = [rectRoom('w.ocean', 'wasser', 0, 0, 1000, 1000)];
  const worldStrokes: UnifiedCanvasStroke[] = [];
  const worldObjects: UnifiedCanvasObject[] = [];

  for (const cont of CONTINENT_BLUEPRINTS) {
    const cdoc = continentDocs.get(cont.seedKey)!;
    const baseLand = cdoc.rooms.find((r) => r.id.startsWith('g.land.'));
    if (baseLand) {
      const derivedContinent = deriveCoarseRoomFromChild(cont.anchor, baseLand, cont.worldRoomId, {
        simplifyEpsilon: 1.0,
      });
      if (derivedContinent) {
        worldRooms.push(derivedContinent);
        derivedRefs.push({
          derivedFeatureId: derivedContinent.id,
          sourceMapId: cont.seedKey,
          sourceFeatureId: baseLand.id,
          structure: 'landmass',
          fingerprint: computeGeometryDerivedFingerprint(cont.seedKey, derivedContinent),
        });
      }
    }
    // Derive country region polygons on world map
    for (const r of cdoc.rooms) {
      if (!r.id.startsWith('der.country.')) continue;
      const dr = deriveCoarseRoomFromChild(cont.anchor, r, `w.${r.id}`, { simplifyEpsilon: 1.5 });
      if (dr) worldRooms.push(dr);
    }
    // Derive primary river spine on world map (first river per continent keeps w.river-w / w.river-e)
    let riverIdx = 0;
    for (const st of cdoc.strokes) {
      const isRiver = st.material === 'wasser';
      const id =
        isRiver && riverIdx === 0
          ? cont.worldRiverId
          : `w.${cont.placeSeedKey.replace(/^continent\./, '')}.${st.id}`;
      if (isRiver) riverIdx += 1;
      const ds = deriveCoarseStrokeFromChild(cont.anchor, st, id, { minWidth: 5, maxWidth: 10 });
      if (ds) {
        worldStrokes.push(ds);
        derivedRefs.push({
          derivedFeatureId: ds.id,
          sourceMapId: cont.seedKey,
          sourceFeatureId: st.id,
          structure: isRiver ? 'river' : 'road',
          fingerprint: computeGeometryDerivedFingerprint(cont.seedKey, ds),
        });
      }
    }
  }

  // Derive exact world-space pins for all 10 places + Dornhain tavern/crypt (including secret flag!)
  for (const pbp of PLACE_BLUEPRINTS) {
    const worldPos = localToWorld(worldNodes, pbp.seedKey, { x: 500, y: 500 });
    if (worldPos.ok) {
      const slug = pbp.placeSeedKey.replace(/^place\./, '');
      worldObjects.push(
        stamp(
          `w.loc.${slug}`,
          pbp.primaryStamp,
          Math.round(worldPos.value.x * 100) / 100,
          Math.round(worldPos.value.y * 100) / 100,
          slug === 'dornhain' ? 0.42 : 0.36,
          { height: 1.2 },
        ),
      );
    }
  }
  const tavernWorldPos = localToWorld(worldNodes, 'dornhain.map.loc.tavern', { x: 500, y: 500 });
  if (tavernWorldPos.ok) {
    worldObjects.push(
      stamp(
        's.obj.tavern',
        'haus',
        Math.round(tavernWorldPos.value.x * 100) / 100,
        Math.round(tavernWorldPos.value.y * 100) / 100,
        0.4,
        { height: 1.1 },
      ),
    );
  }
  const cryptWorldPos = localToWorld(worldNodes, 'dornhain.map.loc.crypt', { x: 500, y: 500 });
  if (cryptWorldPos.ok) {
    const cx = Math.round(cryptWorldPos.value.x * 100) / 100;
    const cy = Math.round(cryptWorldPos.value.y * 100) / 100;
    worldObjects.push(stamp('s.obj.crypt', 'fels', cx, cy, 0.38, { secret: true }));
    worldRooms.push(rectRoom('s.crypt', 'stein', cx - 2, cy - 2, 4, 4, true));
  }

  const rootDoc: UnifiedCanvasDoc = {
    ...emptyUnifiedCanvasDoc(false),
    rooms: worldRooms,
    strokes: worldStrokes,
    objects: worldObjects,
  };

  // 7) Ordered parent→child map specs (22 child maps + 1 world root = 23 total)
  const maps: DefaultWorldMapSpec[] = [
    // Frozen-order reference chain first so cold-bootstrap & Golden checks keep deterministic order
    {
      seedKey: 'dornhain.map.continent.westmark',
      placeSeedKey: 'continent.westmark',
      title: 'Kontinent Westmark',
      kind: 'region',
      parentMapSeedKey: null,
      parentAnchor: ANCHOR_WESTMARK,
      buildCanvas: () => continentDocs.get('dornhain.map.continent.westmark')!,
    },
    {
      seedKey: 'dornhain.map.country.westmark',
      placeSeedKey: 'country.westmark',
      title: 'Nordreich',
      kind: 'region',
      parentMapSeedKey: 'dornhain.map.continent.westmark',
      parentAnchor: ANCHOR_NORDREICH,
      buildCanvas: () => countryDocs.get('dornhain.map.country.westmark')!,
    },
    {
      seedKey: 'dornhain.map.place.dornhain',
      placeSeedKey: 'place.dornhain',
      title: 'Dornhain',
      kind: 'settlement',
      parentMapSeedKey: 'dornhain.map.country.westmark',
      parentAnchor: ANCHOR_DORNHAIN,
      buildCanvas: () => placeDocs.get('dornhain.map.place.dornhain')!,
    },
    {
      seedKey: 'dornhain.map.loc.tavern',
      placeSeedKey: 'loc.tavern',
      title: 'Taverne Zum Flüstern',
      kind: 'scene',
      parentMapSeedKey: 'dornhain.map.place.dornhain',
      parentAnchor: ANCHOR_TAVERN,
      buildCanvas: () => tavernDoc,
    },
    {
      seedKey: 'dornhain.map.room.taproom',
      placeSeedKey: 'room.taproom',
      title: 'Schankraum',
      kind: 'scene',
      parentMapSeedKey: 'dornhain.map.loc.tavern',
      parentAnchor: ANCHOR_TAPROOM,
      buildCanvas: () => taproomDoc,
    },
    {
      seedKey: 'dornhain.map.loc.crypt',
      placeSeedKey: 'loc.crypt',
      title: 'Krypta unter dem Hügel',
      kind: 'scene',
      parentMapSeedKey: 'dornhain.map.place.dornhain',
      parentAnchor: ANCHOR_CRYPT,
      buildCanvas: () => krypta.doc,
      buildDungeonMeta: () => krypta.meta,
    },
    // Remaining places in Nordreich + procedural dungeon
    ...PLACE_BLUEPRINTS.filter(
      (p) => p.countrySeedKey === 'dornhain.map.country.westmark' && p.seedKey !== 'dornhain.map.place.dornhain',
    ).map((p): DefaultWorldMapSpec => ({
      seedKey: p.seedKey,
      placeSeedKey: p.placeSeedKey,
      title: p.title,
      kind: 'settlement',
      parentMapSeedKey: p.countrySeedKey,
      parentAnchor: p.anchor,
      buildCanvas: () => placeDocs.get(p.seedKey)!,
    })),
    {
      seedKey: 'dornhain.map.loc.felswacht-mine',
      placeSeedKey: 'loc.felswacht-mine',
      title: 'Minen von Felswacht',
      kind: 'scene',
      parentMapSeedKey: 'dornhain.map.place.felswacht',
      parentAnchor: ANCHOR_FELSWACHT_MINE,
      buildCanvas: () => felswachtMine.doc,
      buildDungeonMeta: () => felswachtMine.meta,
    },
    // Südmark + 2 places + procedural dungeon
    {
      seedKey: 'dornhain.map.country.suedmark',
      placeSeedKey: 'country.suedmark',
      title: 'Südmark',
      kind: 'region',
      parentMapSeedKey: 'dornhain.map.continent.westmark',
      parentAnchor: ANCHOR_SUEDMARK,
      buildCanvas: () => countryDocs.get('dornhain.map.country.suedmark')!,
    },
    ...PLACE_BLUEPRINTS.filter((p) => p.countrySeedKey === 'dornhain.map.country.suedmark').map(
      (p): DefaultWorldMapSpec => ({
        seedKey: p.seedKey,
        placeSeedKey: p.placeSeedKey,
        title: p.title,
        kind: 'settlement',
        parentMapSeedKey: p.countrySeedKey,
        parentAnchor: p.anchor,
        buildCanvas: () => placeDocs.get(p.seedKey)!,
      }),
    ),
    {
      seedKey: 'dornhain.map.loc.moorbrueck-vault',
      placeSeedKey: 'loc.moorbrueck-vault',
      title: 'Versunkenes Gewölbe',
      kind: 'scene',
      parentMapSeedKey: 'dornhain.map.place.moorbrueck',
      parentAnchor: ANCHOR_MOORBRUECK_VAULT,
      buildCanvas: () => moorbrueckVault.doc,
      buildDungeonMeta: () => moorbrueckVault.meta,
    },
    // Kontinent Ostmark + Sonnenküste + Eisengrat + 5 places + procedural dungeon
    {
      seedKey: 'dornhain.map.continent.ostmark',
      placeSeedKey: 'continent.ostmark',
      title: 'Kontinent Ostmark',
      kind: 'region',
      parentMapSeedKey: null,
      parentAnchor: ANCHOR_OSTMARK,
      buildCanvas: () => continentDocs.get('dornhain.map.continent.ostmark')!,
    },
    {
      seedKey: 'dornhain.map.country.sonnenkueste',
      placeSeedKey: 'country.sonnenkueste',
      title: 'Sonnenküste',
      kind: 'region',
      parentMapSeedKey: 'dornhain.map.continent.ostmark',
      parentAnchor: ANCHOR_SONNENKUESTE,
      buildCanvas: () => countryDocs.get('dornhain.map.country.sonnenkueste')!,
    },
    ...PLACE_BLUEPRINTS.filter((p) => p.countrySeedKey === 'dornhain.map.country.sonnenkueste').map(
      (p): DefaultWorldMapSpec => ({
        seedKey: p.seedKey,
        placeSeedKey: p.placeSeedKey,
        title: p.title,
        kind: 'settlement',
        parentMapSeedKey: p.countrySeedKey,
        parentAnchor: p.anchor,
        buildCanvas: () => placeDocs.get(p.seedKey)!,
      }),
    ),
    {
      seedKey: 'dornhain.map.country.eisengrat',
      placeSeedKey: 'country.eisengrat',
      title: 'Eisengrat',
      kind: 'region',
      parentMapSeedKey: 'dornhain.map.continent.ostmark',
      parentAnchor: ANCHOR_EISENGRAT,
      buildCanvas: () => countryDocs.get('dornhain.map.country.eisengrat')!,
    },
    ...PLACE_BLUEPRINTS.filter((p) => p.countrySeedKey === 'dornhain.map.country.eisengrat').map(
      (p): DefaultWorldMapSpec => ({
        seedKey: p.seedKey,
        placeSeedKey: p.placeSeedKey,
        title: p.title,
        kind: 'settlement',
        parentMapSeedKey: p.countrySeedKey,
        parentAnchor: p.anchor,
        buildCanvas: () => placeDocs.get(p.seedKey)!,
      }),
    ),
    {
      seedKey: 'dornhain.map.loc.sturmpass-fort',
      placeSeedKey: 'loc.sturmpass-fort',
      title: 'Alte Passfestung',
      kind: 'scene',
      parentMapSeedKey: 'dornhain.map.place.sturmpass',
      parentAnchor: ANCHOR_STURMPASS_FORT,
      buildCanvas: () => sturmpassFort.doc,
      buildDungeonMeta: () => sturmpassFort.meta,
    },
  ];

  // 8) Ordered parent→child place specs (keeps all original Dornhain place seeds intact)
  const places: DefaultWorldPlaceSpec[] = [
    {
      seedKey: 'continent.westmark',
      name: 'Kontinent Westmark',
      kind: 'continent',
      description: 'Westlicher Kontinent Donalu (Bottom-Up abgeleitet).',
      sortOrder: 0,
      parentSeedKey: null,
      anchor: { x: ANCHOR_WESTMARK.centerX, y: ANCHOR_WESTMARK.centerY },
    },
    {
      seedKey: 'country.westmark',
      name: 'Nordreich',
      kind: 'country',
      description: 'Land Nordreich auf dem Kontinent Westmark.',
      sortOrder: 5,
      parentSeedKey: 'continent.westmark',
      anchor: { x: ANCHOR_NORDREICH.centerX, y: ANCHOR_NORDREICH.centerY },
    },
    {
      seedKey: 'place.dornhain',
      name: 'Dornhain',
      kind: 'settlement',
      description: 'Stadt in Donalu — tiefer Referenz-Ort.',
      sortOrder: 10,
      parentSeedKey: 'country.westmark',
      anchor: { x: ANCHOR_DORNHAIN.centerX, y: ANCHOR_DORNHAIN.centerY },
    },
    {
      seedKey: 'dornhain.marktplatz',
      name: 'Marktplatz',
      kind: 'settlement',
      description: 'Dornhain Marktplatz — Startpunkt der Whisper-Road.',
      sortOrder: 15,
      parentSeedKey: 'place.dornhain',
      anchor: { x: 378, y: 488 },
    },
    {
      seedKey: 'dornhain.whisper-road',
      name: 'Whisper Road',
      kind: 'region',
      description: 'Die Whisper Road führt hinaus aus Dornhain.',
      sortOrder: 20,
      parentSeedKey: 'place.dornhain',
      anchor: { x: 420, y: 480 },
    },
    {
      seedKey: 'loc.tavern',
      name: 'Taverne Zum Flüstern',
      kind: 'building',
      description: 'Treffpunkt der Helden.',
      sortOrder: 30,
      parentSeedKey: 'place.dornhain',
      anchor: { x: ANCHOR_TAVERN.centerX, y: ANCHOR_TAVERN.centerY },
    },
    {
      seedKey: 'room.taproom',
      name: 'Schankraum',
      kind: 'room',
      description: 'Schankraum der Taverne Zum Flüstern (tiefste Ebene mit Tisch & Tresen).',
      sortOrder: 35,
      parentSeedKey: 'loc.tavern',
      anchor: { x: ANCHOR_TAPROOM.centerX, y: ANCHOR_TAPROOM.centerY },
    },
    {
      seedKey: 'loc.crypt',
      name: 'Krypta unter dem Hügel',
      kind: 'building',
      description: 'GM-Geheimnis — prozedurale Dungeon-Forge-Krypta unter Dornhain.',
      sortOrder: 40,
      parentSeedKey: 'place.dornhain',
      anchor: { x: ANCHOR_CRYPT.centerX, y: ANCHOR_CRYPT.centerY },
    },
    {
      seedKey: 'place.felswacht',
      name: 'Felswacht',
      kind: 'settlement',
      description: 'Bergfestung im Norden Nordreichs.',
      sortOrder: 50,
      parentSeedKey: 'country.westmark',
      anchor: { x: ANCHOR_FELSWACHT.centerX, y: ANCHOR_FELSWACHT.centerY },
    },
    {
      seedKey: 'loc.felswacht-mine',
      name: 'Minen von Felswacht',
      kind: 'building',
      description: 'Prozedurale Frostminen unter Felswacht.',
      sortOrder: 55,
      parentSeedKey: 'place.felswacht',
      anchor: { x: ANCHOR_FELSWACHT_MINE.centerX, y: ANCHOR_FELSWACHT_MINE.centerY },
    },
    {
      seedKey: 'place.silberfurt',
      name: 'Silberfurt',
      kind: 'settlement',
      description: 'Flussübergang am Silberbach.',
      sortOrder: 60,
      parentSeedKey: 'country.westmark',
      anchor: { x: ANCHOR_SILBERFURT.centerX, y: ANCHOR_SILBERFURT.centerY },
    },
    {
      seedKey: 'country.suedmark',
      name: 'Südmark',
      kind: 'country',
      description: 'Südliches Küsten- und Moorland auf Westmark.',
      sortOrder: 65,
      parentSeedKey: 'continent.westmark',
      anchor: { x: ANCHOR_SUEDMARK.centerX, y: ANCHOR_SUEDMARK.centerY },
    },
    {
      seedKey: 'place.weidenhafen',
      name: 'Weidenhafen',
      kind: 'settlement',
      description: 'Küstenhafen der Südmark.',
      sortOrder: 70,
      parentSeedKey: 'country.suedmark',
      anchor: { x: ANCHOR_WEIDENHAFEN.centerX, y: ANCHOR_WEIDENHAFEN.centerY },
    },
    {
      seedKey: 'place.moorbrueck',
      name: 'Moorbrück',
      kind: 'settlement',
      description: 'Pfahlbausiedlung am Rand der Südmoore.',
      sortOrder: 80,
      parentSeedKey: 'country.suedmark',
      anchor: { x: ANCHOR_MOORBRUECK.centerX, y: ANCHOR_MOORBRUECK.centerY },
    },
    {
      seedKey: 'loc.moorbrueck-vault',
      name: 'Versunkenes Gewölbe',
      kind: 'building',
      description: 'Prozedurales überwachsenes Gewölbe unter Moorbrück.',
      sortOrder: 81,
      parentSeedKey: 'place.moorbrueck',
      anchor: { x: ANCHOR_MOORBRUECK_VAULT.centerX, y: ANCHOR_MOORBRUECK_VAULT.centerY },
    },
    {
      seedKey: 'continent.ostmark',
      name: 'Kontinent Ostmark',
      kind: 'continent',
      description: 'Östlicher Kontinent Donalu (Bottom-Up abgeleitet).',
      sortOrder: 82,
      parentSeedKey: null,
      anchor: { x: ANCHOR_OSTMARK.centerX, y: ANCHOR_OSTMARK.centerY },
    },
    {
      seedKey: 'country.sonnenkueste',
      name: 'Sonnenküste',
      kind: 'country',
      description: 'Küstenland im Westen Ostmarks.',
      sortOrder: 85,
      parentSeedKey: 'continent.ostmark',
      anchor: { x: ANCHOR_SONNENKUESTE.centerX, y: ANCHOR_SONNENKUESTE.centerY },
    },
    {
      seedKey: 'place.aurelia',
      name: 'Aurelia',
      kind: 'settlement',
      description: 'Handelsstadt an der Westbucht Ostmarks.',
      sortOrder: 90,
      parentSeedKey: 'country.sonnenkueste',
      anchor: { x: ANCHOR_AURELIA.centerX, y: ANCHOR_AURELIA.centerY },
    },
    {
      seedKey: 'place.salzklippe',
      name: 'Salzklippe',
      kind: 'settlement',
      description: 'Steilküstenort der Salzsammler.',
      sortOrder: 100,
      parentSeedKey: 'country.sonnenkueste',
      anchor: { x: ANCHOR_SALZKLIPPE.centerX, y: ANCHOR_SALZKLIPPE.centerY },
    },
    {
      seedKey: 'place.kornfeld',
      name: 'Kornfeld',
      kind: 'settlement',
      description: 'Bauernsiedlung in den Hügeln der Sonnenküste.',
      sortOrder: 110,
      parentSeedKey: 'country.sonnenkueste',
      anchor: { x: ANCHOR_KORNFELD.centerX, y: ANCHOR_KORNFELD.centerY },
    },
    {
      seedKey: 'country.eisengrat',
      name: 'Eisengrat',
      kind: 'country',
      description: 'Hochgebirgsreich im Osten Ostmarks.',
      sortOrder: 115,
      parentSeedKey: 'continent.ostmark',
      anchor: { x: ANCHOR_EISENGRAT.centerX, y: ANCHOR_EISENGRAT.centerY },
    },
    {
      seedKey: 'place.schmiedental',
      name: 'Schmiedental',
      kind: 'settlement',
      description: 'Schmiedestadt im Herzen des Eisengrats.',
      sortOrder: 120,
      parentSeedKey: 'country.eisengrat',
      anchor: { x: ANCHOR_SCHMIEDENTAL.centerX, y: ANCHOR_SCHMIEDENTAL.centerY },
    },
    {
      seedKey: 'place.sturmpass',
      name: 'Sturmpass',
      kind: 'settlement',
      description: 'Hochgebirgspass im Eisengrat.',
      sortOrder: 130,
      parentSeedKey: 'country.eisengrat',
      anchor: { x: ANCHOR_STURMPASS.centerX, y: ANCHOR_STURMPASS.centerY },
    },
    {
      seedKey: 'loc.sturmpass-fort',
      name: 'Alte Passfestung',
      kind: 'building',
      description: 'Prozedurale Festungsruine unter dem Sturmpass.',
      sortOrder: 135,
      parentSeedKey: 'place.sturmpass',
      anchor: { x: ANCHOR_STURMPASS_FORT.centerX, y: ANCHOR_STURMPASS_FORT.centerY },
    },
  ];

  cachedBundle = {
    rootSeedKey: ATLAS_DEFAULT_WORLD_ROOT_SEED,
    rootMetersPerUnit: WORLD_MPU,
    rootDoc,
    maps,
    places,
    owners,
    derivedRefs,
    worldNodes,
  };
  return cachedBundle;
}

/**
 * Self-check helper verifying spatial + ownership + calibration integrity of the
 * default world (used by `sws-spatial-integrity` & `atlas-default-world` self-tests).
 */
export function verifyDefaultWorldIntegrity(): {
  readonly ok: boolean;
  readonly errors: readonly string[];
} {
  const bundle = buildCalibratedDefaultWorld();
  const errors: string[] = [];

  // 1) Ownership conflicts == 0
  const conflicts = findGeometryOwnershipConflicts(bundle.owners);
  if (conflicts.length > 0) {
    errors.push(`ownership conflicts: ${conflicts.map((c) => `${c.structure}:${c.kind}`).join(', ')}`);
  }

  // 2) Every node passes SWS-01 roundtrip < 1e-9
  for (const id of Object.keys(bundle.worldNodes)) {
    const pt = { x: 480, y: 480 };
    const w = localToWorld(bundle.worldNodes, id, pt);
    if (isAtlasWorldError(w)) {
      errors.push(`localToWorld failed on ${id}: ${w.error}`);
      continue;
    }
    const back = worldToLocal(bundle.worldNodes, id, w.value);
    if (isAtlasWorldError(back)) {
      errors.push(`worldToLocal failed on ${id}: ${back.error}`);
      continue;
    }
    if (Math.hypot(back.value.x - pt.x, back.value.y - pt.y) > 1e-9) {
      errors.push(`roundtrip drift on ${id}`);
    }
  }

  // 3) No sibling anchor overlap
  const byParent = new Map<string, ParentSpatialAnchor[]>();
  for (const m of bundle.maps) {
    const pid = m.parentMapSeedKey ?? bundle.rootSeedKey;
    const list = byParent.get(pid) ?? [];
    list.push({ ...m.parentAnchor, parentMapId: pid });
    byParent.set(pid, list);
  }
  for (const [pid, anchors] of byParent) {
    for (let i = 0; i < anchors.length; i += 1) {
      for (let j = i + 1; j < anchors.length; j += 1) {
        if (parentAnchorsOverlapAabb(anchors[i]!, anchors[j]!)) {
          errors.push(`sibling anchor overlap under ${pid}: #${i} and #${j}`);
        }
      }
    }
  }

  // 4) Calibration exact across all maps
  const mpuBySeed = new Map<string, number>([[bundle.rootSeedKey, bundle.rootMetersPerUnit]]);
  for (const m of bundle.maps) {
    const pid = m.parentMapSeedKey ?? bundle.rootSeedKey;
    const parentMpu = mpuBySeed.get(pid) ?? null;
    const expected = deriveCalibratedChildMetersPerUnit(parentMpu, m.parentAnchor);
    if (expected == null || Math.abs(expected - m.parentAnchor.metersPerUnit) > 1e-12) {
      errors.push(`calibration mismatch on ${m.seedKey}: expected ${expected}, got ${m.parentAnchor.metersPerUnit}`);
    }
    mpuBySeed.set(m.seedKey, m.parentAnchor.metersPerUnit);
  }

  return { ok: errors.length === 0, errors };
}
