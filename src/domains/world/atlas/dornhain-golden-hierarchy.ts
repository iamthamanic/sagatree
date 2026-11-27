/**
 * dornhain-golden-hierarchy — Calibrated Bottom-Up Default World hierarchy (SWS-02 / C1–C6).
 * Location: src/domains/world/atlas/dornhain-golden-hierarchy.ts
 *
 * Pure domain — no React / Host. Replaces the legacy 5-map Dornhain Golden world
 * with the calibrated Bottom-Up default world (`atlas-default-world.ts`):
 *  - 2 Kontinente × 2 Länder × 2–3 Orte (10 Orte), 1 tiefer Referenz-Ort (Dornhain
 *    → Taverne Zum Flüstern → Schankraum → Tisch), 4 prozedurale Dungeons.
 *  - Preserves canonical Dornhain heightfield + Dungeon-Forge Krypta (seed 1425)
 *    for ATL3-V01 visual contract compatibility.
 *  - Every anchor is calibrated from Day 1 (`metersPerUnit > 0`).
 */
import {
  buildCalibratedDefaultWorld,
  buildDefaultDornhainCanvas,
  buildDefaultDornhainHeightfield,
  buildDefaultTavernCanvas,
  DEFAULT_DORNHAIN_HILLS,
  DEFAULT_KRYPTA_FORGE_PARAMS,
  type DefaultWorldMapSpec,
} from './atlas-default-world';
import type { AtlasHeightfield } from './atlas-heightfield';
import {
  mergeDungeonMetaIntoGeneratorMeta,
  type DungeonGenerateParams,
  type DungeonGeneratorMeta,
} from './dungeon-generator';
import {
  mergeMapFrameIntoGeneratorMeta,
  type ParentSpatialAnchor,
} from './map-frame';
import type { UnifiedCanvasDoc } from './unified-canvas-doc';
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
    readonly metersPerUnit?: number | null;
  };
  readonly buildCanvas: () => UnifiedCanvasDoc;
  /** Committed Dungeon-Forge meta (`generatorMeta.dungeon`) for forge-built Golden maps. */
  readonly buildDungeonMeta?: () => DungeonGeneratorMeta;
};

export const GOLDEN_DORNHAIN_HILLS = DEFAULT_DORNHAIN_HILLS;

export const GOLDEN_KRYPTA_FORGE_PARAMS: DungeonGenerateParams = DEFAULT_KRYPTA_FORGE_PARAMS;

export function buildGoldenDornhainHeightfield(): AtlasHeightfield {
  return buildDefaultDornhainHeightfield();
}

export function buildGoldenContinentCanvas(): UnifiedCanvasDoc {
  const m = buildCalibratedDefaultWorld().maps.find(
    (x) => x.seedKey === 'dornhain.map.continent.westmark',
  );
  if (!m) throw new Error('Missing Kontinent Westmark in calibrated default world');
  return m.buildCanvas();
}

export function buildGoldenCountryCanvas(): UnifiedCanvasDoc {
  const m = buildCalibratedDefaultWorld().maps.find(
    (x) => x.seedKey === 'dornhain.map.country.westmark',
  );
  if (!m) throw new Error('Missing Nordreich in calibrated default world');
  return m.buildCanvas();
}

export function buildGoldenDornhainCanvas(): UnifiedCanvasDoc {
  return buildDefaultDornhainCanvas();
}

export function buildGoldenTavernCanvas(): UnifiedCanvasDoc {
  return buildDefaultTavernCanvas();
}

export function buildGoldenCryptCanvas(): UnifiedCanvasDoc {
  const m = buildCalibratedDefaultWorld().maps.find((x) => x.seedKey === 'dornhain.map.loc.crypt');
  if (!m) throw new Error('Missing Krypta in calibrated default world');
  return m.buildCanvas();
}

export function buildGoldenCryptDungeonMeta(): DungeonGeneratorMeta {
  const m = buildCalibratedDefaultWorld().maps.find((x) => x.seedKey === 'dornhain.map.loc.crypt');
  if (!m?.buildDungeonMeta) throw new Error('Missing Krypta dungeon meta in calibrated default world');
  return m.buildDungeonMeta();
}

/** Ordered parent→child calibrated Bottom-Up world maps (replaces legacy 5-map Golden). */
export const DORNHAIN_GOLDEN_MAPS: readonly DornhainGoldenMapSpec[] =
  buildCalibratedDefaultWorld().maps.map(
    (spec: DefaultWorldMapSpec): DornhainGoldenMapSpec => ({
      seedKey: spec.seedKey,
      placeSeedKey: spec.placeSeedKey,
      title: spec.title,
      kind: spec.kind,
      parentMapSeedKey: spec.parentMapSeedKey,
      parentAnchor: {
        centerX: spec.parentAnchor.centerX,
        centerY: spec.parentAnchor.centerY,
        extentX: spec.parentAnchor.extentX,
        extentY: spec.parentAnchor.extentY,
        rotationRad: spec.parentAnchor.rotationRad,
        metersPerUnit: spec.parentAnchor.metersPerUnit,
      },
      buildCanvas:
        spec.seedKey === 'dornhain.map.place.dornhain'
          ? buildGoldenDornhainCanvas
          : spec.seedKey === 'dornhain.map.loc.crypt'
            ? buildGoldenCryptCanvas
            : spec.buildCanvas,
      ...(spec.buildDungeonMeta ? { buildDungeonMeta: spec.buildDungeonMeta } : {}),
    }),
  );

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
    metersPerUnit: spec.parentAnchor.metersPerUnit ?? null,
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
