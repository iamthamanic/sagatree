/**
 * dornhain-golden-hierarchy-seed — Host-side Calibrated Bottom-Up Default World seeds.
 * Location: server/src/bootstrap/dornhain-golden-hierarchy-seed.ts
 *
 * Mirrors FE `atlas-default-world` / `dornhain-golden-hierarchy` / `dornhain-golden-reset`
 * via generated `dornhain-default-world-mirror.ts` without importing FE domains
 * (architecture boundary). Includes full calibrated 23-map hierarchy (reference chain:
 * `continent.westmark` → `country.westmark` → `place.dornhain` →
 * `dornhain.map.loc.tavern` → `dornhain.map.room.taproom` / `dornhain.map.loc.crypt`).
 */
import type { HostDatabase } from '../persistence/index.ts';
import {
  DEFAULT_WORLD_MAP_DATA,
  DEFAULT_WORLD_PLACE_SEEDS,
} from './dornhain-default-world-mirror.ts';
import { isUntouchedLegacyGoldenCanvas } from './dornhain-golden-content-upgrade.ts';

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

/** Ordered parent→child (mirrors FE DORNHAIN_GOLDEN_PLACES 1:1). */
export const DORHAIN_GOLDEN_PLACE_SEEDS: readonly DornhainGoldenPlaceSeed[] =
  DEFAULT_WORLD_PLACE_SEEDS.map((p) => ({
    stableId: p.stableId,
    seedKey: p.seedKey,
    name: p.name,
    kind: p.kind,
    description: p.description,
    parentSeedKey: p.parentSeedKey,
    anchor: p.anchor ? { x: p.anchor.x, y: p.anchor.y } : null,
    sortOrder: p.sortOrder,
  }));

type UnifiedCanvasDoc = {
  readonly format: 'sagatree-unified-atlas-v1';
  readonly layers: Record<string, boolean>;
  readonly strokes: readonly unknown[];
  readonly objects: readonly unknown[];
  readonly rooms: readonly unknown[];
  readonly walls: readonly unknown[];
  readonly doors?: readonly unknown[];
  readonly heightfield?: Record<string, unknown>;
  readonly demoSeed: false;
};

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
    readonly rotationRad: number;
    readonly metersPerUnit: number;
  };
  readonly buildCanvas: () => UnifiedCanvasDoc;
  /** Committed Dungeon-Forge meta stored under generatorMeta.dungeon. */
  readonly dungeonMeta?: Readonly<Record<string, unknown>>;
};

/**
 * Pre-freeze Golden map titles (ATL2-H03 #1236, owner freeze 2026-11-15). Existing worlds
 * whose map still carries exactly the old Golden title get the frozen title on bootstrap;
 * user-renamed maps and authored canvases are never touched.
 */
export const DORHAIN_GOLDEN_LEGACY_MAP_TITLES: Readonly<Record<string, readonly string[]>> = {
  'dornhain.map.country.westmark': ['Land Westmark'],
};

/** Ordered parent→child calibrated Bottom-Up default world maps (mirrors FE 1:1). */
export const DORHAIN_GOLDEN_MAP_SEEDS: readonly DornhainGoldenMapSeed[] =
  DEFAULT_WORLD_MAP_DATA.map((entry) => ({
    stableId: entry.stableId,
    seedKey: entry.seedKey,
    placeSeedKey: entry.placeSeedKey,
    title: entry.title,
    kind: entry.kind,
    parentMapSeedKey: entry.parentMapSeedKey,
    parentAnchor: {
      centerX: entry.parentAnchor.centerX,
      centerY: entry.parentAnchor.centerY,
      extentX: entry.parentAnchor.extentX,
      extentY: entry.parentAnchor.extentY,
      rotationRad: entry.parentAnchor.rotationRad,
      metersPerUnit: entry.parentAnchor.metersPerUnit,
    },
    buildCanvas: () => structuredClone(entry.canvas) as unknown as UnifiedCanvasDoc,
    ...('dungeonMeta' in entry && entry.dungeonMeta
      ? { dungeonMeta: entry.dungeonMeta as Readonly<Record<string, unknown>> }
      : {}),
  }));

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
    ...(spec.dungeonMeta ? { dungeon: { ...spec.dungeonMeta } } : {}),
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
    mapFrame: {
      status: 'ready',
      parentAnchor: {
        parentMapId,
        centerX: spec.parentAnchor.centerX,
        centerY: spec.parentAnchor.centerY,
        extentX: spec.parentAnchor.extentX,
        extentY: spec.parentAnchor.extentY,
        rotationRad: spec.parentAnchor.rotationRad,
        metersPerUnit: spec.parentAnchor.metersPerUnit,
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
    } else if (isUntouchedLegacyGoldenCanvas(spec.seedKey, prevMeta.unifiedCanvas, generatorMeta.unifiedCanvas)) {
      const legacyTitle = (DORHAIN_GOLDEN_LEGACY_MAP_TITLES[spec.seedKey] ?? []).includes(existing.title);
      const nextMeta = {
        ...prevMeta,
        unifiedCanvas: generatorMeta.unifiedCanvas,
        ...(generatorMeta.dungeon ? { dungeon: generatorMeta.dungeon } : {}),
        golden: true,
      };
      db.prepare(
        `UPDATE world_atlas_maps SET title = ?, generator_meta = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND world_profile_id = ?`,
      ).run(legacyTitle ? spec.title : existing.title, JSON.stringify(nextMeta), now, mapId, worldId);
    } else if (
      existing.title !== spec.title &&
      (DORHAIN_GOLDEN_LEGACY_MAP_TITLES[spec.seedKey] ?? []).includes(existing.title)
    ) {
      db.prepare(
        `UPDATE world_atlas_maps SET title = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND world_profile_id = ?`,
      ).run(spec.title, now, mapId, worldId);
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
