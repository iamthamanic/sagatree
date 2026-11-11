/**
 * Product default: ensure Dornhain catalog exists for the solo (or owner) actor.
 * Location: server/src/bootstrap/ensure-dornhain-default.ts
 *
 * Cutover drills already seed fixtures; fresh solo hosts must still land Dornhain
 * world + saga + pregens + items/monsters/NPCs without a Supabase migration.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { HostDatabase } from '../persistence/index.ts';
import {
  dornhainFixtureCatalog,
  DORHAIN_SLUG,
  DORHAIN_WORLD_TITLE,
  type DornhainCatalog,
} from '../migration/cutover/index.ts';
import { generateSagaPublicId } from '../modules/project/internal/public-project-id.ts';
import { generateProjectJoinCode } from '../modules/project/internal/project-membership-store.ts';
import { generateWorldPublicId } from '../modules/world/internal/public-world-id.ts';

export type EnsureDornhainResult = {
  readonly seeded: boolean;
  readonly worldId: string;
  readonly projectId: string;
};

const ARCHETYPE_CLASS: Record<string, { classLabel: string; raceLabel: string }> = {
  warrior: { classLabel: 'Kriegerin', raceLabel: 'Mensch' },
  scout: { classLabel: 'Kundschafter', raceLabel: 'Mensch' },
  diplomat: { classLabel: 'Diplomatin', raceLabel: 'Mensch' },
  mystic: { classLabel: 'Mystiker', raceLabel: 'Mensch' },
};

function findOwnedWorldId(db: HostDatabase, ownerUserId: string): string | null {
  const row = db
    .prepare(
      `SELECT id FROM worlds WHERE owner_user_id = ? AND title = ? ORDER BY created_at ASC LIMIT 1`,
    )
    .get(ownerUserId, DORHAIN_WORLD_TITLE) as { id: string } | undefined;
  return row?.id ?? null;
}

function findOwnedProjectId(db: HostDatabase, ownerUserId: string, worldId: string): string | null {
  const row = db
    .prepare(
      `SELECT id FROM projects
       WHERE gm_user_id = ? AND world_id = ?
       ORDER BY created_at ASC LIMIT 1`,
    )
    .get(ownerUserId, worldId) as { id: string } | undefined;
  return row?.id ?? null;
}

/** Solo keeps canonical slug; remotes get UNIQUE owner-scoped slug (no cross-owner saga FK). */
function ownedDornhainSlug(ownerUserId: string): string {
  if (ownerUserId.startsWith('solo-')) return DORHAIN_SLUG;
  const digest = createHash('sha256').update(ownerUserId).digest('hex').slice(0, 12);
  return `${DORHAIN_SLUG}__${digest}`;
}

function findOwnedSagaId(db: HostDatabase, ownerUserId: string): string | null {
  const slug = ownedDornhainSlug(ownerUserId);
  const row = db
    .prepare(
      `SELECT id FROM saga_definitions
       WHERE owner_user_id = ? AND slug = ?
       ORDER BY created_at ASC LIMIT 1`,
    )
    .get(ownerUserId, slug) as { id: string } | undefined;
  return row?.id ?? null;
}

/** Solo boot keeps fixture ids; remote actors get owner-scoped ids (no REPLACE steal). */
function scopedCatalogId(ownerUserId: string, stableId: string): string {
  if (ownerUserId.startsWith('solo-')) return stableId;
  const digest = createHash('sha256')
    .update(`${ownerUserId}:${stableId}`)
    .digest('hex')
    .slice(0, 12);
  return `${stableId}__${digest}`;
}

/** Public-ID alphabet mirrors resource-id (no O/0/I/1); host must not import FE domains. */
const PUBLIC_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PUBLIC_ID_BODY_LENGTH = 5;

function hasLetterAndDigitBody(body: string): boolean {
  let hasLetter = false;
  let hasDigit = false;
  for (const ch of body) {
    if (ch >= 'A' && ch <= 'Z') hasLetter = true;
    if (ch >= '2' && ch <= '9') hasDigit = true;
  }
  return hasLetter && hasDigit;
}

/**
 * Owner-scoped Public ID: keep canonical PREFIX + 5-char body (CH-/NPCC-/IT-/…).
 * Fixture ids stay for solo; remotes derive a collision-resistant body from owner+seed.
 */
function scopedPublicId(ownerUserId: string, publicId: string): string {
  if (ownerUserId.startsWith('solo-')) return publicId;
  const dash = publicId.indexOf('-');
  const prefix = dash > 0 ? publicId.slice(0, dash).toUpperCase() : 'CH';
  const seed = `${ownerUserId}:${publicId}`;
  let hash = createHash('sha256').update(seed).digest();
  for (let attempt = 0; attempt < 64; attempt += 1) {
    if (attempt > 0) {
      hash = createHash('sha256').update(hash).update(String(attempt)).digest();
    }
    let body = '';
    for (let i = 0; i < PUBLIC_ID_BODY_LENGTH; i += 1) {
      body += PUBLIC_ID_ALPHABET[hash[i]! % PUBLIC_ID_ALPHABET.length] ?? 'A';
    }
    if (hasLetterAndDigitBody(body)) return `${prefix}-${body}`;
  }
  return `${prefix}-A2BC3`;
}

function seedCharacterSheets(
  db: HostDatabase,
  ownerUserId: string,
  catalog: DornhainCatalog,
  now: string,
): void {
  for (const ch of catalog.characters) {
    const labels = ARCHETYPE_CLASS[ch.archetype] ?? {
      classLabel: ch.archetype,
      raceLabel: 'Mensch',
    };
    const sheet = {
      archetype: ch.archetype,
      class: labels.classLabel,
      race: labels.raceLabel,
      classLabel: labels.classLabel,
      raceLabel: labels.raceLabel,
      nativeTag: 'SagaTree Native',
      sagaSlug: DORHAIN_SLUG,
    };
    const id = scopedCatalogId(ownerUserId, ch.id);
    const publicId = scopedPublicId(ownerUserId, ch.publicId);
    // Never REPLACE across owners — scoped ids keep admin + player copies distinct.
    db.prepare(
      `INSERT OR IGNORE INTO characters
       (id, owner_user_id, character_type, sheet_status, name, created_at, public_id,
        updated_at, description, level, sheet_json, portrait_storage_path, deleted_at)
       VALUES (?, ?, 'pc', 'complete', ?, ?, ?, ?, ?, 1, ?, NULL, NULL)`,
    ).run(
      id,
      ownerUserId,
      ch.displayName,
      now,
      publicId,
      now,
      ch.archetype,
      JSON.stringify(sheet),
    );
  }
}

/** Owner-scoped catalog apply (avoids INSERT OR REPLACE stealing solo fixture rows). */
function applyOwnedDornhainCatalog(
  db: HostDatabase,
  ownerUserId: string,
  worldId: string,
  catalog: DornhainCatalog,
  now: string,
): void {
  seedCharacterSheets(db, ownerUserId, catalog, now);

  for (const itemId of catalog.itemDefinitionIds) {
    const id = scopedCatalogId(ownerUserId, itemId);
    const publicId = scopedPublicId(
      ownerUserId,
      `IT-${itemId.replace(/^dh-item-/, 'DH').toUpperCase()}`,
    );
    db.prepare(
      `INSERT OR IGNORE INTO inventory_item_definitions
       (id, public_id, origin, owner_user_id, world_profile_id, status, name, payload_json, created_at, updated_at)
       VALUES (?, ?, 'world', ?, ?, 'active', ?, ?, ?, ?)`,
    ).run(
      id,
      publicId,
      ownerUserId,
      worldId,
      itemId,
      JSON.stringify({ nativeTag: 'SagaTree Native', sagaSlug: DORHAIN_SLUG }),
      now,
      now,
    );
  }

  for (const mon of catalog.monsters) {
    const id = scopedCatalogId(ownerUserId, mon.id);
    db.prepare(
      `INSERT OR IGNORE INTO npc_creature_definitions
       (id, scope, owner_user_id, world_profile_id, status, payload, created_at, updated_at, public_id)
       VALUES (?, 'world', ?, ?, 'active', ?, ?, ?, ?)`,
    ).run(
      id,
      ownerUserId,
      worldId,
      JSON.stringify({
        kind: 'monster',
        publicId: scopedPublicId(ownerUserId, mon.publicId),
        displayName: mon.displayName,
        nativeTag: 'SagaTree Native',
        sagaSlug: DORHAIN_SLUG,
      }),
      now,
      now,
      scopedPublicId(ownerUserId, mon.publicId),
    );
  }

  for (const [index, publicId] of catalog.npcPublicIds.entries()) {
    const stable = `dh-npc-def-${index + 1}`;
    const id = scopedCatalogId(ownerUserId, stable);
    const scopedPub = scopedPublicId(ownerUserId, publicId);
    db.prepare(
      `INSERT OR IGNORE INTO npc_creature_definitions
       (id, scope, owner_user_id, world_profile_id, status, payload, created_at, updated_at, public_id)
       VALUES (?, 'world', ?, ?, 'active', ?, ?, ?, ?)`,
    ).run(
      id,
      ownerUserId,
      worldId,
      JSON.stringify({
        kind: 'npc',
        publicId: scopedPub,
        displayName: publicId,
        nativeTag: 'SagaTree Native',
        sagaSlug: DORHAIN_SLUG,
      }),
      now,
      now,
      scopedPub,
    );
  }
}

const DORHAIN_ATLAS_ROOT_STABLE = 'dh-atlas-root';
/** Matches FE `DORNHAIN_WORLD_LAYER_TITLE` / dornhain-unified-starter. */
const DORHAIN_WORLD_LAYER_TITLE = 'Welt';
const DORHAIN_UNIFIED_SEED = 'dornhain.unified.v4';
/** Settlement overview anchor on the world canvas (FE DORNHAIN_WORLD_ANCHOR). */
const DORHAIN_WORLD_ANCHOR = { x: 360, y: 510 } as const;

const DORHAIN_ATLAS_PLACES: readonly {
  readonly stableId: string;
  readonly seedKey: string;
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly parentSeedKey: string | null;
  readonly anchor: { readonly x: number; readonly y: number } | null;
}[] = [
  {
    stableId: 'dh-place-square',
    seedKey: 'dornhain.marktplatz',
    name: 'Marktplatz',
    kind: 'settlement',
    description: 'Dornhain Marktplatz — Startpunkt der Whisper-Road.',
    parentSeedKey: null,
    anchor: DORHAIN_WORLD_ANCHOR,
  },
  {
    stableId: 'dh-place-dornhain',
    seedKey: 'place.dornhain',
    name: 'Dornhain',
    kind: 'settlement',
    description: 'Stadt in Donalu — Starterschauplatz.',
    parentSeedKey: null,
    anchor: DORHAIN_WORLD_ANCHOR,
  },
  {
    stableId: 'dh-place-whisper',
    seedKey: 'dornhain.whisper-road',
    name: 'Whisper Road',
    kind: 'region',
    description: 'Die Whisper Road führt hinaus aus Dornhain.',
    parentSeedKey: 'place.dornhain',
    anchor: { x: 420, y: 480 },
  },
  {
    stableId: 'dh-place-tavern',
    seedKey: 'loc.tavern',
    name: 'Taverne Zum Flüstern',
    kind: 'building',
    description: 'Treffpunkt der Helden.',
    parentSeedKey: 'place.dornhain',
    anchor: { x: 328, y: 528 },
  },
  {
    stableId: 'dh-place-crypt',
    seedKey: 'loc.crypt',
    name: 'Krypta unter dem Hügel',
    kind: 'building',
    description: 'GM-Geheimnis — Reliktort unter Dornhain.',
    parentSeedKey: 'place.dornhain',
    anchor: { x: 406, y: 462 },
  },
];

function isBlankOceanUnifiedCanvas(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const doc = raw as Record<string, unknown>;
  if (doc.demoSeed !== false) return false;
  const strokes = doc.strokes;
  const objects = doc.objects;
  const walls = doc.walls;
  const rooms = doc.rooms;
  if (!Array.isArray(strokes) || strokes.length > 0) return false;
  if (!Array.isArray(objects) || objects.length > 0) return false;
  if (!Array.isArray(walls) || walls.length > 0) return false;
  if (!Array.isArray(rooms) || rooms.length !== 1) return false;
  const only = rooms[0] as Record<string, unknown>;
  return only.id === 'w.ocean' && only.material === 'wasser';
}

/**
 * Host-side copy of FE `buildDornhainUnifiedGeneratorMeta` (no FE domain import).
 * Golden v4 — land + pins + settlement LOD; `demoSeed: false`.
 */
function dornhainUnifiedGeneratorMeta(): Record<string, unknown> {
  return {
    engine: 'unified_canvas',
    sagaSlug: DORHAIN_SLUG,
    seed: DORHAIN_UNIFIED_SEED,
    scale: 'world',
    mapStatus: 'ready',
    nativeTag: 'SagaTree Native',
    golden: true,
    unifiedCanvas: {
      format: 'sagatree-unified-atlas-v1',
      layers: {
        terrain: true,
        roads: true,
        region: true,
        city: true,
        interior: true,
        drawings: true,
        objects: true,
        grid: false,
      },
      strokes: [
        {
          id: 'w.river-w',
          material: 'wasser',
          width: 10,
          points: [
            [220, 120],
            [240, 280],
            [210, 420],
            [250, 560],
            [200, 720],
          ],
        },
        {
          id: 'w.river-e',
          material: 'wasser',
          width: 12,
          points: [
            [780, 80],
            [760, 220],
            [800, 400],
            [740, 580],
            [780, 760],
          ],
        },
        {
          id: 's.rd.plaza',
          material: 'pflaster',
          width: 9,
          points: [
            [330, 530],
            [350, 510],
            [370, 490],
          ],
        },
        {
          id: 'w.rd.whisper',
          material: 'pflaster',
          width: 8,
          points: [
            [360, 510],
            [420, 480],
            [520, 460],
            [640, 440],
          ],
        },
      ],
      objects: [
        { id: 'w.loc.dornhain', type: 'haus', x: 360, y: 510, size: 0.42, height: 1.2 },
        { id: 'w.loc.northkeep', type: 'turm', x: 220, y: 160, size: 0.36, height: 1.4 },
        { id: 'w.loc.eastport', type: 'haus', x: 820, y: 480, size: 0.38, height: 1.1 },
        { id: 'w.loc.southmarsh', type: 'fels', x: 180, y: 720, size: 0.34 },
        { id: 'w.loc.highpass', type: 'fels', x: 700, y: 120, size: 0.32 },
        { id: 's.obj.tavern', type: 'haus', x: 328, y: 528, size: 0.55, height: 1.2 },
        { id: 's.obj.market', type: 'haus', x: 378, y: 488, size: 0.5, height: 1.1 },
        { id: 's.obj.woods', type: 'tanne', x: 410, y: 550, size: 0.65 },
        { id: 's.obj.crypt', type: 'fels', x: 406, y: 462, size: 0.55 },
        { id: 's.obj.tree-a', type: 'baum', x: 304, y: 460, size: 0.4 },
        { id: 's.obj.tree-b', type: 'tanne', x: 420, y: 500, size: 0.45 },
      ],
      rooms: [
        {
          id: "w.ocean",
          material: "wasser",
          x: 0,
          y: 0,
          w: 1000,
          h: 1000
        },
        {
          id: "w.west-core",
          material: "gras",
          x: 55,
          y: 95,
          w: 385,
          h: 665,
          points: [
            [70, 200],
            [160, 110],
            [310, 95],
            [390, 180],
            [430, 310],
            [410, 450],
            [440, 560],
            [380, 680],
            [280, 760],
            [140, 740],
            [70, 620],
            [55, 420],
            [90, 280]
          ]
        },
        {
          id: "w.west-north",
          material: "erde",
          x: 100,
          y: 70,
          w: 260,
          h: 140,
          points: [
            [110, 100],
            [220, 70],
            [340, 90],
            [360, 160],
            [280, 210],
            [150, 200],
            [100, 150]
          ]
        },
        {
          id: "w.west-south",
          material: "sand",
          x: 70,
          y: 640,
          w: 290,
          h: 180,
          points: [
            [90, 660],
            [200, 640],
            [330, 670],
            [360, 760],
            [250, 820],
            [120, 800],
            [70, 720]
          ]
        },
        {
          id: "w.east-core",
          material: "gras",
          x: 500,
          y: 110,
          w: 420,
          h: 650,
          points: [
            [540, 160],
            [680, 110],
            [820, 140],
            [900, 250],
            [920, 420],
            [880, 580],
            [820, 700],
            [700, 760],
            [580, 700],
            [520, 560],
            [500, 400],
            [520, 260]
          ]
        },
        {
          id: "w.east-north",
          material: "stein",
          x: 580,
          y: 30,
          w: 300,
          h: 160,
          points: [
            [600, 40],
            [740, 30],
            [860, 70],
            [880, 150],
            [780, 190],
            [640, 170],
            [580, 100]
          ]
        },
        {
          id: "w.east-south",
          material: "erde",
          x: 560,
          y: 640,
          w: 320,
          h: 220,
          points: [
            [580, 660],
            [720, 640],
            [860, 680],
            [880, 800],
            [760, 860],
            [620, 840],
            [560, 740]
          ]
        },
        {
          id: "w.east-bay",
          material: "sand",
          x: 480,
          y: 340,
          w: 100,
          h: 160,
          points: [
            [480, 360],
            [560, 340],
            [580, 420],
            [540, 500],
            [480, 480]
          ]
        },
        {
          id: "w.isle-n",
          material: "holz",
          x: 430,
          y: 25,
          w: 110,
          h: 95,
          points: [
            [430, 40],
            [510, 25],
            [540, 80],
            [500, 120],
            [430, 100]
          ]
        },
        {
          id: "w.isle-sw",
          material: "gras",
          x: 40,
          y: 780,
          w: 100,
          h: 120,
          points: [
            [40, 800],
            [110, 780],
            [140, 860],
            [90, 900],
            [40, 860]
          ]
        },
        {
          id: "w.isle-se",
          material: "sand",
          x: 850,
          y: 820,
          w: 120,
          h: 110,
          points: [
            [870, 830],
            [950, 820],
            [970, 900],
            [910, 930],
            [850, 890]
          ]
        },
        {
          id: "w.lake-w",
          material: "wasser",
          x: 180,
          y: 320,
          w: 70,
          h: 50
        },
        {
          id: "w.lake-e",
          material: "wasser",
          x: 700,
          y: 280,
          w: 90,
          h: 60
        },
        {
          id: "s.ground",
          material: "gras",
          x: 280,
          y: 430,
          w: 160,
          h: 160
        },
        {
          id: "s.plaza",
          material: "pflaster",
          x: 320,
          y: 480,
          w: 70,
          h: 60
        },
        {
          id: "s.tavern",
          material: "erde",
          x: 310,
          y: 510,
          w: 36,
          h: 36
        },
        {
          id: "s.market",
          material: "sand",
          x: 360,
          y: 470,
          w: 36,
          h: 36
        },
        {
          id: "s.woods",
          material: "holz",
          x: 390,
          y: 530,
          w: 40,
          h: 40
        },
        {
          id: "s.crypt",
          material: "stein",
          x: 390,
          y: 446,
          w: 32,
          h: 32
        }
      ],
      walls: [],
      demoSeed: false,
    },
  };
}

/** FE-HOST-11: idempotent root atlas map + places for the owned Dornhain world. */
function seedOwnedDornhainAtlas(
  db: HostDatabase,
  ownerUserId: string,
  worldId: string,
  now: string,
): void {
  const existingRoot = db
    .prepare(
      `SELECT id FROM world_atlas_maps
       WHERE world_profile_id = ? AND parent_map_id IS NULL
       ORDER BY CASE WHEN kind = 'world' THEN 0 ELSE 1 END, sort_order, title
       LIMIT 1`,
    )
    .get(worldId) as { id: string } | undefined;

  const mapId =
    existingRoot?.id ?? scopedCatalogId(ownerUserId, DORHAIN_ATLAS_ROOT_STABLE);
  const layers = {
    type: 'FeatureCollection',
    features: DORHAIN_ATLAS_PLACES.filter((p) => p.anchor).map((p) => ({
      type: 'Feature',
      id: scopedCatalogId(ownerUserId, p.stableId),
      properties: { name: p.name, seedKey: p.seedKey },
      geometry: {
        type: 'Point',
        coordinates: [p.anchor!.x, p.anchor!.y],
      },
    })),
  };
  const generatorMeta = JSON.stringify(dornhainUnifiedGeneratorMeta());

  if (!existingRoot) {
    db.prepare(
      `INSERT OR IGNORE INTO world_atlas_maps (
         id, world_profile_id, parent_map_id, kind, title, sort_order,
         bounds, layers, generator_meta, revision, created_at, updated_at
       ) VALUES (?, ?, NULL, 'world', ?, 0, ?, ?, ?, 1, ?, ?)`,
    ).run(
      mapId,
      worldId,
      DORHAIN_WORLD_LAYER_TITLE,
      JSON.stringify({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }),
      JSON.stringify(layers),
      generatorMeta,
      now,
      now,
    );
  } else {
    // Fill missing product canvas, or upgrade blank v3 ocean → Golden v4.
    const row = db
      .prepare(`SELECT generator_meta, layers FROM world_atlas_maps WHERE id = ?`)
      .get(mapId) as { generator_meta: string; layers: string } | undefined;
    let meta: Record<string, unknown> = {};
    try {
      meta = row?.generator_meta ? (JSON.parse(row.generator_meta) as Record<string, unknown>) : {};
    } catch {
      meta = {};
    }
    const seed = typeof meta.seed === 'string' ? meta.seed : '';
    const statusMissing = meta.mapStatus !== 'ready' && meta.mapStatus !== 'unsketched';
    const needsGolden =
      meta.unifiedCanvas === undefined ||
      meta.engine !== 'unified_canvas' ||
      seed === 'dornhain.unified.v1' ||
      seed === 'dornhain.unified.v2' ||
      (seed === 'dornhain.unified.v3' && isBlankOceanUnifiedCanvas(meta.unifiedCanvas)) ||
      (seed === DORHAIN_UNIFIED_SEED && statusMissing);
    if (needsGolden) {
      // Bump revision so an editor still holding the pre-upgrade map gets a
      // conflict instead of silently saving over the Golden canvas.
      db.prepare(
        `UPDATE world_atlas_maps
         SET title = ?, generator_meta = ?, layers = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND world_profile_id = ?`,
      ).run(
        DORHAIN_WORLD_LAYER_TITLE,
        generatorMeta,
        JSON.stringify(layers),
        now,
        mapId,
        worldId,
      );
    }
  }

  const placeIdBySeed = new Map<string, string>();
  for (const [index, place] of DORHAIN_ATLAS_PLACES.entries()) {
    const placeId = scopedCatalogId(ownerUserId, place.stableId);
    placeIdBySeed.set(place.seedKey, placeId);
    const parentId =
      place.parentSeedKey !== null ? (placeIdBySeed.get(place.parentSeedKey) ?? null) : null;
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
      index,
      now,
      now,
    );

    const linkId = scopedCatalogId(ownerUserId, `${place.stableId}-link`);
    // Root-map anchors are overview (containing world map), never place-owned primary.
    const usage = 'overview';
    const anchor = place.anchor
      ? { x: place.anchor.x, y: place.anchor.y, source: DORHAIN_UNIFIED_SEED }
      : {};
    db.prepare(
      `INSERT OR IGNORE INTO world_place_map_links (
         id, world_profile_id, place_id, map_id, usage, feature_id, anchor,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      linkId,
      worldId,
      placeId,
      mapId,
      usage,
      place.anchor ? placeId : null,
      JSON.stringify(anchor),
      now,
      now,
    );
  }
}

function createDornhainProject(
  db: HostDatabase,
  ownerUserId: string,
  worldId: string,
  sagaId: string,
  now: string,
  projectId = randomUUID(),
): string {
  const publicId = generateSagaPublicId();
  const code = generateProjectJoinCode();
  const memberId = randomUUID();
  db.prepare(
    `INSERT INTO projects
     (id, world_id, gm_user_id, title, created_at, saga_id, public_id, status, description, code)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run(
    projectId,
    worldId,
    ownerUserId,
    'Dornhain — Whisper',
    now,
    sagaId,
    publicId,
    'Starter-Saga Dornhain',
    code,
  );
  db.prepare(
    `INSERT OR IGNORE INTO project_members
     (project_id, user_id, role, active, joined_at, id, character_id)
     VALUES (?, ?, 'gm', 1, ?, ?, NULL)`,
  ).run(projectId, ownerUserId, now, memberId);
  return projectId;
}

/**
 * Idempotent product seed for Dornhain. Safe to call on every host boot.
 * Uses origin `user` (owned copy) — native rows require owner_user_id IS NULL.
 */
export function ensureDornhainDefaultCatalog(
  db: HostDatabase,
  ownerUserId: string,
  catalog: DornhainCatalog = dornhainFixtureCatalog(),
): EnsureDornhainResult {
  const now = new Date().toISOString();

  const existingWorldId = findOwnedWorldId(db, ownerUserId);
  const sagaSlug = ownedDornhainSlug(ownerUserId);
  const ownedSagaId = findOwnedSagaId(db, ownerUserId);

  if (existingWorldId && ownedSagaId) {
    applyOwnedDornhainCatalog(db, ownerUserId, existingWorldId, catalog, now);
    seedOwnedDornhainAtlas(db, ownerUserId, existingWorldId, now);
    const projectId =
      findOwnedProjectId(db, ownerUserId, existingWorldId) ??
      createDornhainProject(db, ownerUserId, existingWorldId, ownedSagaId, now);
    return { seeded: false, worldId: existingWorldId, projectId };
  }

  const worldId = existingWorldId ?? randomUUID();
  const createdSagaId = ownedSagaId ?? randomUUID().replace(/-/g, '').slice(0, 32);
  const versionId = randomUUID().replace(/-/g, '').slice(0, 32);
  const assetId = scopedCatalogId(ownerUserId, 'dornhain-product-cover');
  const bytes = Buffer.from('dornhain-product-cover');
  const checksum = createHash('sha256').update(bytes).digest('hex');

  if (!existingWorldId) {
    db.prepare(
      `INSERT INTO worlds (id, owner_user_id, title, created_at, public_id) VALUES (?, ?, ?, ?, ?)`,
    ).run(worldId, ownerUserId, catalog.worldTitle, now, generateWorldPublicId());
  }

  // Each actor owns their Dornhain saga definition (owner-scoped UNIQUE slug).
  if (!ownedSagaId) {
    db.prepare(
      `INSERT INTO saga_definitions
       (id, slug, title, synopsis, origin, owner_user_id, draft_revision, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'user', ?, 0, ?, ?)`,
    ).run(
      createdSagaId,
      sagaSlug,
      catalog.sagaTitle,
      'SagaTree Native — Dornhain starter',
      ownerUserId,
      now,
      now,
    );
    db.prepare(
      `INSERT INTO saga_definition_versions
       (id, saga_id, version_label, status, payload, published_at, created_at)
       VALUES (?, ?, 'v1', 'published', ?, ?, ?)`,
    ).run(
      versionId,
      createdSagaId,
      JSON.stringify({
        title: catalog.sagaTitle,
        nativeTag: 'SagaTree Native',
        characters: catalog.characters.map((c) => c.id),
        monsters: catalog.monsters.map((m) => m.id),
        itemDefinitionIds: [...catalog.itemDefinitionIds],
        npcPublicIds: [...catalog.npcPublicIds],
      }),
      now,
      now,
    );
  }

  const resolvedSagaId = ownedSagaId ?? createdSagaId;
  const existingProject = findOwnedProjectId(db, ownerUserId, worldId);
  const resolvedProjectId =
    existingProject ?? createDornhainProject(db, ownerUserId, worldId, resolvedSagaId, now);

  db.prepare(
    `INSERT OR IGNORE INTO assets
     (id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at)
     VALUES (?, ?, 'image/png', ?, ?, ?, 1, ?)`,
  ).run(assetId, ownerUserId, bytes.byteLength, checksum, assetId, now);

  applyOwnedDornhainCatalog(db, ownerUserId, worldId, catalog, now);
  seedOwnedDornhainAtlas(db, ownerUserId, worldId, now);

  return { seeded: true, worldId, projectId: resolvedProjectId };
}
