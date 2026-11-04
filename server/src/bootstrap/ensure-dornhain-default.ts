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
const DORHAIN_ATLAS_PLACES: readonly {
  readonly stableId: string;
  readonly seedKey: string;
  readonly name: string;
  readonly kind: string;
  readonly description: string;
  readonly anchor: { readonly x: number; readonly y: number } | null;
}[] = [
  {
    stableId: 'dh-place-square',
    seedKey: 'dornhain.marktplatz',
    name: 'Marktplatz',
    kind: 'settlement',
    description: 'Dornhain Marktplatz — Startpunkt der Whisper-Road.',
    anchor: { x: 10, y: 12 },
  },
  {
    stableId: 'dh-place-whisper',
    seedKey: 'dornhain.whisper-road',
    name: 'Whisper Road',
    kind: 'region',
    description: 'Die Whisper Road führt hinaus aus Dornhain.',
    anchor: null,
  },
];

/** FE-HOST-11: idempotent root atlas map + places for the owned Dornhain world. */
function seedOwnedDornhainAtlas(
  db: HostDatabase,
  ownerUserId: string,
  worldId: string,
  now: string,
): void {
  const mapId = scopedCatalogId(ownerUserId, DORHAIN_ATLAS_ROOT_STABLE);
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

  db.prepare(
    `INSERT OR IGNORE INTO world_atlas_maps (
       id, world_profile_id, parent_map_id, kind, title, sort_order,
       bounds, layers, generator_meta, revision, created_at, updated_at
     ) VALUES (?, ?, NULL, 'world', ?, 0, ?, ?, ?, 1, ?, ?)`,
  ).run(
    mapId,
    worldId,
    'Dornhain — Weltkarte',
    JSON.stringify({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }),
    JSON.stringify(layers),
    JSON.stringify({ engine: 'manual', nativeTag: 'SagaTree Native', sagaSlug: DORHAIN_SLUG }),
    now,
    now,
  );

  for (const [index, place] of DORHAIN_ATLAS_PLACES.entries()) {
    const placeId = scopedCatalogId(ownerUserId, place.stableId);
    db.prepare(
      `INSERT OR IGNORE INTO world_places (
         id, world_profile_id, parent_place_id, kind, name, description,
         status, seed_key, sort_order, revision, created_at, updated_at
       ) VALUES (?, ?, NULL, ?, ?, ?, 'canonical', ?, ?, 0, ?, ?)`,
    ).run(
      placeId,
      worldId,
      place.kind,
      place.name,
      place.description,
      place.seedKey,
      index,
      now,
      now,
    );

    const linkId = scopedCatalogId(ownerUserId, `${place.stableId}-link`);
    const usage = place.anchor ? 'primary' : 'overview';
    const anchor = place.anchor ? { x: place.anchor.x, y: place.anchor.y } : {};
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
      `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
    ).run(worldId, ownerUserId, catalog.worldTitle, now);
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
