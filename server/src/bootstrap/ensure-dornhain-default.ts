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
  applyDornhainCatalogToHost,
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

function findOwnedSagaId(db: HostDatabase, ownerUserId: string): string | null {
  const row = db
    .prepare(
      `SELECT id FROM saga_definitions
       WHERE owner_user_id = ? AND slug = ?
       ORDER BY created_at ASC LIMIT 1`,
    )
    .get(ownerUserId, DORHAIN_SLUG) as { id: string } | undefined;
  return row?.id ?? null;
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
    };
    // Never REPLACE — preserve user edits / imported rows that reuse the stable id.
    db.prepare(
      `INSERT OR IGNORE INTO characters
       (id, owner_user_id, character_type, sheet_status, name, created_at, public_id,
        updated_at, description, level, sheet_json, portrait_storage_path, deleted_at)
       VALUES (?, ?, 'pc', 'complete', ?, ?, ?, ?, ?, 1, ?, NULL, NULL)`,
    ).run(
      ch.id,
      ownerUserId,
      ch.displayName,
      now,
      ch.publicId,
      now,
      ch.archetype,
      JSON.stringify(sheet),
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
  const existingSagaId = findOwnedSagaId(db, ownerUserId);
  if (existingWorldId && existingSagaId) {
    applyDornhainCatalogToHost(db, ownerUserId, existingWorldId, catalog, now);
    seedCharacterSheets(db, ownerUserId, catalog, now);
    const projectId =
      findOwnedProjectId(db, ownerUserId, existingWorldId) ??
      createDornhainProject(db, ownerUserId, existingWorldId, existingSagaId, now);
    return { seeded: false, worldId: existingWorldId, projectId };
  }

  const worldId = existingWorldId ?? randomUUID();
  const sagaId = existingSagaId ?? randomUUID().replace(/-/g, '').slice(0, 32);
  const versionId = randomUUID().replace(/-/g, '').slice(0, 32);
  const assetId = randomUUID().replace(/-/g, '').slice(0, 32);
  const bytes = Buffer.from('dornhain-product-cover');
  const checksum = createHash('sha256').update(bytes).digest('hex');

  if (!existingWorldId) {
    db.prepare(
      `INSERT INTO worlds (id, owner_user_id, title, created_at) VALUES (?, ?, ?, ?)`,
    ).run(worldId, ownerUserId, catalog.worldTitle, now);
  }

  if (!existingSagaId) {
    db.prepare(
      `INSERT INTO saga_definitions
       (id, slug, title, synopsis, origin, owner_user_id, draft_revision, created_at, updated_at)
       VALUES (?, ?, ?, '', 'user', ?, 0, ?, ?)`,
    ).run(sagaId, catalog.sagaSlug, catalog.sagaTitle, ownerUserId, now, now);
    db.prepare(
      `INSERT INTO saga_definition_versions
       (id, saga_id, version_label, status, payload, published_at, created_at)
       VALUES (?, ?, 'v1', 'published', ?, ?, ?)`,
    ).run(
      versionId,
      sagaId,
      JSON.stringify({
        title: catalog.sagaTitle,
        characters: catalog.characters.map((c) => c.id),
        monsters: catalog.monsters.map((m) => m.id),
        itemDefinitionIds: [...catalog.itemDefinitionIds],
        npcPublicIds: [...catalog.npcPublicIds],
      }),
      now,
      now,
    );
  }

  const existingProject = findOwnedProjectId(db, ownerUserId, worldId);
  const resolvedProjectId =
    existingProject ?? createDornhainProject(db, ownerUserId, worldId, sagaId, now);

  db.prepare(
    `INSERT OR IGNORE INTO assets
     (id, owner_user_id, content_type, byte_size, checksum_sha256, storage_key, published, created_at)
     VALUES (?, ?, 'image/png', ?, ?, ?, 1, ?)`,
  ).run(assetId, ownerUserId, bytes.byteLength, checksum, assetId, now);

  applyDornhainCatalogToHost(db, ownerUserId, worldId, catalog, now);
  seedCharacterSheets(db, ownerUserId, catalog, now);

  return { seeded: true, worldId, projectId: resolvedProjectId };
}
