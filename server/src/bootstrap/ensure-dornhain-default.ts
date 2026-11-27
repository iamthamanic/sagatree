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
import {
  DEFAULT_WORLD_ROOT_CANVAS,
  DEFAULT_WORLD_ROOT_METERS_PER_UNIT,
} from './dornhain-default-world-mirror.ts';
import {
  DORHAIN_GOLDEN_PLACE_SEEDS,
  DORHAIN_UNIFIED_SEED,
  DORHAIN_WORLD_ANCHOR,
  DORHAIN_WORLD_LAYER_TITLE,
  seedDornhainGoldenHierarchy,
} from './dornhain-golden-hierarchy-seed.ts';

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
/** Alias for root GeoJSON pin features (full place rows come from Golden seeds). */
const DORHAIN_ATLAS_PLACES = DORHAIN_GOLDEN_PLACE_SEEDS;

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
 * Host-side mirror of FE `buildDornhainUnifiedGeneratorMeta` (no FE domain import).
 * SWS Bottom-Up calibrated default world (`w.west-core`, `w.east-core`, `s.obj.crypt`
 * with `secret: true`, calibrated `metersPerUnit: 250`).
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
    worldSpace: {
      calibrated: true,
      metersPerUnit: DEFAULT_WORLD_ROOT_METERS_PER_UNIT,
      derivation: 'bottom-up',
    },
    unifiedCanvas: structuredClone(DEFAULT_WORLD_ROOT_CANVAS),
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
      // Preserve authored GeoJSON layers when upgrading a blank-v3 canvas —
      // only replace layers when the existing FeatureCollection is empty.
      let layersJson = JSON.stringify(layers);
      try {
        const existingLayers = row?.layers ? (JSON.parse(row.layers) as Record<string, unknown>) : null;
        const features = Array.isArray(existingLayers?.features) ? existingLayers.features : [];
        if (features.length > 0) {
          layersJson = row!.layers;
        }
      } catch {
        /* keep Golden seed layers */
      }
      // Bump revision so an editor still holding the pre-upgrade map gets a
      // conflict instead of silently saving over the Golden canvas.
      db.prepare(
        `UPDATE world_atlas_maps
         SET title = ?, generator_meta = ?, layers = ?, revision = revision + 1, updated_at = ?
         WHERE id = ? AND world_profile_id = ?`,
      ).run(
        DORHAIN_WORLD_LAYER_TITLE,
        generatorMeta,
        layersJson,
        now,
        mapId,
        worldId,
      );
    }
  }

  // Six-level Golden child maps + places + primary/overview links (ATL2-A03).
  seedDornhainGoldenHierarchy(db, ownerUserId, worldId, mapId, now, scopedCatalogId);
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
