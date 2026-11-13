/**
 * dornhain-golden-hierarchy-seed — Host-side Golden six-level map/place seeds.
 * Location: server/src/bootstrap/dornhain-golden-hierarchy-seed.ts
 *
 * Mirrors FE `dornhain-golden-hierarchy` / `dornhain-golden-reset` place+map
 * contracts without importing frontend domains (architecture boundary).
 */
import type { HostDatabase } from '../persistence/index.ts';

export const DORHAIN_UNIFIED_SEED = 'dornhain.unified.v4';
export const DORHAIN_WORLD_LAYER_TITLE = 'Welt';
export const DORHAIN_WORLD_ANCHOR = { x: 360, y: 510 } as const;

export type DornhainGoldenPlaceSeed = {
  readonly stableId: string;
  readonly seedKey: string;
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly parentSeedKey: string | null;
  readonly anchor: { readonly x: number; readonly y: number } | null;
  readonly sortOrder: number;
};

/** Ordered parent→child (matches FE DORNHAIN_GOLDEN_PLACES). */
export const DORHAIN_GOLDEN_PLACE_SEEDS: readonly DornhainGoldenPlaceSeed[] = [
  {
    stableId: 'dh-place-continent-westmark',
    seedKey: 'continent.westmark',
    name: 'Kontinent Westmark',
    kind: 'continent',
    description: 'Westlicher Kontinent Donalu (Golden-Platzhaltername).',
    parentSeedKey: null,
    anchor: { x: 260, y: 420 },
    sortOrder: 0,
  },
  {
    stableId: 'dh-place-country-westmark',
    seedKey: 'country.westmark',
    name: 'Land Westmark',
    kind: 'country',
    description: 'Land auf dem Kontinent Westmark (Golden-Platzhaltername).',
    parentSeedKey: 'continent.westmark',
    anchor: { x: 430, y: 400 },
    sortOrder: 5,
  },
  {
    stableId: 'dh-place-dornhain',
    seedKey: 'place.dornhain',
    name: 'Dornhain',
    kind: 'settlement',
    description: 'Stadt in Donalu — Starterschauplatz.',
    parentSeedKey: 'country.westmark',
    anchor: DORHAIN_WORLD_ANCHOR,
    sortOrder: 10,
  },
  {
    stableId: 'dh-place-square',
    seedKey: 'dornhain.marktplatz',
    name: 'Marktplatz',
    kind: 'settlement',
    description: 'Dornhain Marktplatz — Startpunkt der Whisper-Road.',
    parentSeedKey: 'place.dornhain',
    anchor: { x: 378, y: 488 },
    sortOrder: 15,
  },
  {
    stableId: 'dh-place-whisper',
    seedKey: 'dornhain.whisper-road',
    name: 'Whisper Road',
    kind: 'region',
    description: 'Die Whisper Road führt hinaus aus Dornhain.',
    parentSeedKey: 'place.dornhain',
    anchor: { x: 420, y: 480 },
    sortOrder: 20,
  },
  {
    stableId: 'dh-place-tavern',
    seedKey: 'loc.tavern',
    name: 'Taverne Zum Flüstern',
    kind: 'building',
    description: 'Treffpunkt der Helden.',
    parentSeedKey: 'place.dornhain',
    anchor: { x: 328, y: 528 },
    sortOrder: 30,
  },
  {
    stableId: 'dh-place-crypt',
    seedKey: 'loc.crypt',
    name: 'Krypta unter dem Hügel',
    kind: 'building',
    description: 'GM-Geheimnis — Reliktort unter Dornhain.',
    parentSeedKey: 'place.dornhain',
    anchor: { x: 406, y: 462 },
    sortOrder: 40,
  },
];

type UnifiedCanvasDoc = {
  readonly format: 'sagatree-unified-atlas-v1';
  readonly layers: Record<string, boolean>;
  readonly strokes: readonly unknown[];
  readonly objects: readonly unknown[];
  readonly rooms: readonly unknown[];
  readonly walls: readonly unknown[];
  readonly demoSeed: false;
};

function emptyLayers(): UnifiedCanvasDoc['layers'] {
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

function rect(
  id: string,
  material: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra: Record<string, unknown> = {},
) {
  return { id, material, x, y, w, h, ...extra };
}

function stroke(
  id: string,
  material: string,
  width: number,
  points: readonly (readonly [number, number])[],
) {
  return { id, material, width, points };
}

function stamp(
  id: string,
  type: string,
  x: number,
  y: number,
  size: number,
  extra: Record<string, unknown> = {},
) {
  return { id, type, x, y, size, ...extra };
}

function baseDoc(
  rooms: unknown[],
  strokes: unknown[] = [],
  objects: unknown[] = [],
  walls: unknown[] = [],
): UnifiedCanvasDoc {
  return {
    format: 'sagatree-unified-atlas-v1',
    layers: emptyLayers(),
    rooms: [rect('g.ocean', 'wasser', 0, 0, 1000, 1000), ...rooms],
    strokes,
    objects,
    walls,
    demoSeed: false,
  };
}

export type DornhainGoldenMapSeed = {
  readonly stableId: string;
  readonly seedKey: string;
  readonly placeSeedKey: string;
  readonly title: string;
  readonly kind: string;
  /** Parent Golden map seed; null = world root. */
  readonly parentMapSeedKey: string | null;
  readonly parentAnchor: {
    readonly centerX: number;
    readonly centerY: number;
    readonly extentX: number;
    readonly extentY: number;
  };
  readonly buildCanvas: () => UnifiedCanvasDoc;
};

/** Ordered parent→child so cold bootstrap upserts without forward refs. */
export const DORHAIN_GOLDEN_MAP_SEEDS: readonly DornhainGoldenMapSeed[] = [
  {
    stableId: 'dh-map-continent-westmark',
    seedKey: 'dornhain.map.continent.westmark',
    placeSeedKey: 'continent.westmark',
    title: 'Kontinent Westmark',
    kind: 'region',
    parentMapSeedKey: null,
    parentAnchor: { centerX: 260, centerY: 420, extentX: 160, extentY: 220 },
    buildCanvas: () =>
      baseDoc(
        [
          {
            id: 'g.land.westmark',
            material: 'gras',
            x: 100,
            y: 120,
            w: 640,
            h: 640,
            points: [
              [120, 180],
              [280, 120],
              [520, 140],
              [700, 260],
              [740, 480],
              [620, 700],
              [360, 760],
              [160, 620],
              [100, 400],
            ],
          },
          rect('g.country.westmark', 'erde', 320, 300, 220, 200),
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
      ),
  },
  {
    stableId: 'dh-map-country-westmark',
    seedKey: 'dornhain.map.country.westmark',
    placeSeedKey: 'country.westmark',
    title: 'Land Westmark',
    kind: 'region',
    parentMapSeedKey: 'dornhain.map.continent.westmark',
    parentAnchor: { centerX: 430, centerY: 400, extentX: 110, extentY: 100 },
    buildCanvas: () =>
      baseDoc(
        [rect('g.country.core', 'gras', 180, 180, 640, 640)],
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
      ),
  },
  {
    stableId: 'dh-map-place-dornhain',
    seedKey: 'dornhain.map.place.dornhain',
    placeSeedKey: 'place.dornhain',
    title: 'Dornhain',
    kind: 'settlement',
    parentMapSeedKey: 'dornhain.map.country.westmark',
    parentAnchor: { centerX: 360, centerY: 510, extentX: 55, extentY: 55 },
    buildCanvas: () =>
      baseDoc(
        [
          rect('g.town.plaza', 'pflaster', 300, 420, 180, 140),
          rect('g.town.block-a', 'stein', 220, 380, 90, 80),
          rect('g.town.block-b', 'holz', 460, 400, 100, 90),
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
      ),
  },
  {
    stableId: 'dh-map-loc-tavern',
    seedKey: 'dornhain.map.loc.tavern',
    placeSeedKey: 'loc.tavern',
    title: 'Taverne Zum Flüstern',
    kind: 'scene',
    parentMapSeedKey: 'dornhain.map.place.dornhain',
    parentAnchor: { centerX: 328, centerY: 528, extentX: 24, extentY: 24 },
    buildCanvas: () => ({
      format: 'sagatree-unified-atlas-v1',
      layers: emptyLayers(),
      rooms: [
        rect('g.tav.common', 'holz', 200, 200, 400, 320),
        rect('g.tav.bar', 'stein', 220, 220, 140, 80),
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
      strokes: [],
      demoSeed: false,
    }),
  },
  {
    stableId: 'dh-map-loc-crypt',
    seedKey: 'dornhain.map.loc.crypt',
    placeSeedKey: 'loc.crypt',
    title: 'Krypta unter dem Hügel',
    kind: 'scene',
    parentMapSeedKey: 'dornhain.map.place.dornhain',
    parentAnchor: { centerX: 406, centerY: 462, extentX: 28, extentY: 28 },
    buildCanvas: () => ({
      format: 'sagatree-unified-atlas-v1',
      layers: emptyLayers(),
      rooms: [
        rect('g.crypt.hall', 'stein', 240, 240, 360, 280),
        rect('g.crypt.vault', 'erde', 320, 560, 200, 160),
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
      strokes: [],
      demoSeed: false,
    }),
  },
];

export function buildGoldenChildGeneratorMeta(
  spec: DornhainGoldenMapSeed,
  parentMapId: string,
): Record<string, unknown> {
  return {
    engine: 'unified_canvas',
    seed: spec.seedKey,
    golden: true,
    placeSeedKey: spec.placeSeedKey,
    scale: spec.kind,
    mapStatus: 'ready',
    unifiedCanvas: spec.buildCanvas(),
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    mapFrame: {
      status: 'ready',
      parentAnchor: {
        parentMapId,
        centerX: spec.parentAnchor.centerX,
        centerY: spec.parentAnchor.centerY,
        extentX: spec.parentAnchor.extentX,
        extentY: spec.parentAnchor.extentY,
        rotationRad: 0,
        metersPerUnit: null,
      },
    },
  };
}

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore */
  }
  return {};
}

function canvasRoomCount(meta: Record<string, unknown>): number {
  const canvas = meta.unifiedCanvas;
  if (!canvas || typeof canvas !== 'object' || Array.isArray(canvas)) return 0;
  const rooms = (canvas as { rooms?: unknown }).rooms;
  return Array.isArray(rooms) ? rooms.length : 0;
}

/**
 * Idempotent Golden child-map + place hierarchy under an existing world root map.
 * Never deletes non-Golden maps. Safe to call on every ensure.
 */
export function seedDornhainGoldenHierarchy(
  db: HostDatabase,
  ownerUserId: string,
  worldId: string,
  worldRootMapId: string,
  now: string,
  scopedId: (ownerUserId: string, stableId: string) => string,
): { readonly mapIdsBySeed: ReadonlyMap<string, string>; readonly placeIdsBySeed: ReadonlyMap<string, string> } {
  const mapIdsBySeed = new Map<string, string>();
  mapIdsBySeed.set(DORHAIN_UNIFIED_SEED, worldRootMapId);

  // Index existing maps by seed (owner world only).
  const existingMaps = db
    .prepare(
      `SELECT id, parent_map_id, kind, title, sort_order, bounds, layers, generator_meta, revision
       FROM world_atlas_maps WHERE world_profile_id = ?`,
    )
    .all(worldId) as Array<{
    id: string;
    parent_map_id: string | null;
    kind: string;
    title: string;
    sort_order: number;
    bounds: string;
    layers: string;
    generator_meta: string;
    revision: number;
  }>;
  for (const row of existingMaps) {
    const seed = parseMeta(row.generator_meta).seed;
    if (typeof seed === 'string' && seed.length > 0) {
      mapIdsBySeed.set(seed, row.id);
    }
  }

  for (const spec of DORHAIN_GOLDEN_MAP_SEEDS) {
    const parentSeed = spec.parentMapSeedKey ?? DORHAIN_UNIFIED_SEED;
    const parentMapId = mapIdsBySeed.get(parentSeed);
    if (!parentMapId) {
      throw new Error(`Golden cold bootstrap: missing parent map ${parentSeed}`);
    }
    const mapId = mapIdsBySeed.get(spec.seedKey) ?? scopedId(ownerUserId, spec.stableId);
    const generatorMeta = buildGoldenChildGeneratorMeta(spec, parentMapId);
    const emptyLayers = JSON.stringify({ type: 'FeatureCollection', features: [] });
    const bounds = JSON.stringify({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 });

    const existing = existingMaps.find((r) => r.id === mapId);
    if (!existing) {
      db.prepare(
        `INSERT OR IGNORE INTO world_atlas_maps (
           id, world_profile_id, parent_map_id, kind, title, sort_order,
           bounds, layers, generator_meta, revision, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 1, ?, ?)`,
      ).run(
        mapId,
        worldId,
        parentMapId,
        spec.kind,
        spec.title,
        bounds,
        emptyLayers,
        JSON.stringify(generatorMeta),
        now,
        now,
      );
      mapIdsBySeed.set(spec.seedKey, mapId);
      existingMaps.push({
        id: mapId,
        parent_map_id: parentMapId,
        kind: spec.kind,
        title: spec.title,
        sort_order: 0,
        bounds,
        layers: emptyLayers,
        generator_meta: JSON.stringify(generatorMeta),
        revision: 1,
      });
      continue;
    }

    const prevMeta = parseMeta(existing.generator_meta);
    const prevSeed = typeof prevMeta.seed === 'string' ? prevMeta.seed : '';
    const needsGolden =
      prevSeed !== spec.seedKey ||
      prevMeta.engine !== 'unified_canvas' ||
      canvasRoomCount(prevMeta) < 1 ||
      prevMeta.mapStatus !== 'ready';
    if (needsGolden || existing.parent_map_id !== parentMapId) {
      const nextMeta = {
        ...prevMeta,
        ...generatorMeta,
        // Keep any non-canvas authored keys; Golden canvas wins when blank/wrong seed.
        unifiedCanvas: generatorMeta.unifiedCanvas,
        mapFrame: generatorMeta.mapFrame,
        seed: spec.seedKey,
        golden: true,
      };
      db.prepare(
        `UPDATE world_atlas_maps
         SET parent_map_id = ?, kind = ?, title = ?, generator_meta = ?,
             revision = revision + 1, updated_at = ?
         WHERE id = ? AND world_profile_id = ?`,
      ).run(
        parentMapId,
        spec.kind,
        spec.title,
        JSON.stringify(nextMeta),
        now,
        mapId,
        worldId,
      );
    }
    mapIdsBySeed.set(spec.seedKey, mapId);
  }

  // Reuse existing place rows by seed_key (FE reset may have created UUID ids).
  const existingPlaces = db
    .prepare(
      `SELECT id, seed_key FROM world_places
       WHERE world_profile_id = ? AND seed_key IS NOT NULL`,
    )
    .all(worldId) as Array<{ id: string; seed_key: string }>;
  const placeIdsBySeed = new Map<string, string>();
  for (const row of existingPlaces) {
    if (row.seed_key) placeIdsBySeed.set(row.seed_key, row.id);
  }

  // Primary map id per place seed (filled as we create/link Golden maps).
  const primaryMapByPlaceSeed = new Map<string, string>();
  for (const spec of DORHAIN_GOLDEN_MAP_SEEDS) {
    const mapId = mapIdsBySeed.get(spec.seedKey);
    if (mapId) primaryMapByPlaceSeed.set(spec.placeSeedKey, mapId);
  }

  for (const place of DORHAIN_GOLDEN_PLACE_SEEDS) {
    const placeId = placeIdsBySeed.get(place.seedKey) ?? scopedId(ownerUserId, place.stableId);
    placeIdsBySeed.set(place.seedKey, placeId);
    const parentId =
      place.parentSeedKey !== null ? (placeIdsBySeed.get(place.parentSeedKey) ?? null) : null;

    db.prepare(
      `INSERT OR IGNORE INTO world_places (
         id, world_profile_id, parent_place_id, kind, name, description,
         status, seed_key, sort_order, revision, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'canonical', ?, ?, 0, ?, ?)`,
    ).run(
      placeId,
      worldId,
      parentId,
      place.kind,
      place.name,
      place.description,
      place.seedKey,
      place.sortOrder,
      now,
      now,
    );
    db.prepare(
      `UPDATE world_places
       SET parent_place_id = ?, kind = ?, name = ?, description = ?,
           status = 'canonical', sort_order = ?, updated_at = ?
       WHERE world_profile_id = ? AND seed_key = ?`,
    ).run(
      parentId,
      place.kind,
      place.name,
      place.description,
      place.sortOrder,
      now,
      worldId,
      place.seedKey,
    );

    const mapSpec = DORHAIN_GOLDEN_MAP_SEEDS.find((m) => m.placeSeedKey === place.seedKey);
    const childMapId = mapSpec ? mapIdsBySeed.get(mapSpec.seedKey) : null;
    if (childMapId) {
      const primaryLinkId = scopedId(ownerUserId, `${place.stableId}-primary`);
      db.prepare(
        `INSERT OR IGNORE INTO world_place_map_links (
           id, world_profile_id, place_id, map_id, usage, feature_id, anchor,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'primary', ?, '{}', ?, ?)`,
      ).run(primaryLinkId, worldId, placeId, childMapId, placeId, now, now);
      db.prepare(
        `UPDATE world_place_map_links
         SET map_id = ?, usage = 'primary', feature_id = ?, updated_at = ?
         WHERE id = ? AND world_profile_id = ?`,
      ).run(childMapId, placeId, now, primaryLinkId, worldId);
      primaryMapByPlaceSeed.set(place.seedKey, childMapId);
    }

    if (place.anchor) {
      // Places with their own Golden map: overview on parent map.
      // Mapless children (Marktplatz / Whisper Road): overview on parent place's primary map.
      let overviewMapId: string = worldRootMapId;
      if (mapSpec?.parentMapSeedKey) {
        overviewMapId = mapIdsBySeed.get(mapSpec.parentMapSeedKey) ?? worldRootMapId;
      } else if (mapSpec && !mapSpec.parentMapSeedKey) {
        overviewMapId = worldRootMapId;
      } else if (place.parentSeedKey) {
        overviewMapId =
          primaryMapByPlaceSeed.get(place.parentSeedKey) ?? worldRootMapId;
      }
      const overviewLinkId = scopedId(ownerUserId, `${place.stableId}-link`);
      const anchor = {
        x: place.anchor.x,
        y: place.anchor.y,
        source: DORHAIN_UNIFIED_SEED,
      };
      db.prepare(
        `INSERT OR IGNORE INTO world_place_map_links (
           id, world_profile_id, place_id, map_id, usage, feature_id, anchor,
           created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'overview', ?, ?, ?, ?)`,
      ).run(
        overviewLinkId,
        worldId,
        placeId,
        overviewMapId,
        placeId,
        JSON.stringify(anchor),
        now,
        now,
      );
      db.prepare(
        `UPDATE world_place_map_links
         SET map_id = ?, usage = 'overview', feature_id = ?, anchor = ?, updated_at = ?
         WHERE id = ? AND world_profile_id = ?`,
      ).run(
        overviewMapId,
        placeId,
        JSON.stringify(anchor),
        now,
        overviewLinkId,
        worldId,
      );
    }
  }

  return { mapIdsBySeed, placeIdsBySeed };
}
