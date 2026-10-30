/**
 * Owner-scoped character sheet CRUD for MIG-302 / #801.
 * Private — import only from character public API.
 * Location: server/src/modules/character/internal/character-sheet-store.ts
 *
 * Supabase remains live FE default; this is the host isolated-contract store.
 * Creator/VRM rendering utilities stay client-side (not moved here).
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import { generateCharacterPublicId } from './public-character-id.ts';

export const CHARACTER_INFRA_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export type CharacterSheetResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type CharacterSheetRecord = {
  readonly id: string;
  readonly publicId: string;
  readonly ownerUserId: string;
  readonly characterType: 'pc' | 'npc' | 'gm_presence';
  readonly sheetStatus: 'complete' | 'incomplete' | 'draft';
  readonly name: string;
  readonly description: string;
  readonly level: number;
  readonly sheet: Readonly<Record<string, unknown>>;
  readonly portraitStoragePath: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CharacterPresetRecord = {
  readonly id: string;
  readonly publicId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly visibility: 'public' | 'owner';
  readonly ownerUserId: string | null;
  readonly sheet: Readonly<Record<string, unknown>>;
};

export type CharacterSheetDraft = {
  readonly name?: unknown;
  readonly description?: unknown;
  readonly level?: unknown;
  readonly sheetStatus?: unknown;
  readonly sheet?: unknown;
  readonly portraitStoragePath?: unknown;
  readonly characterType?: unknown;
};

function nowIso(): string {
  return new Date().toISOString();
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function parseSheetStatus(value: unknown, fallback: 'complete' | 'incomplete' | 'draft') {
  return value === 'incomplete' || value === 'draft' || value === 'complete' ? value : fallback;
}

function parseCharacterType(value: unknown): 'pc' | 'npc' | 'gm_presence' {
  return value === 'npc' || value === 'gm_presence' ? value : 'pc';
}

type CharacterRow = {
  id: string;
  public_id: string | null;
  owner_user_id: string;
  character_type: string;
  sheet_status: string;
  name: string;
  description: string;
  level: number;
  sheet_json: string;
  portrait_storage_path: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

function mapRow(row: CharacterRow): CharacterSheetRecord {
  let sheet: Record<string, unknown> = {};
  try {
    sheet = asObject(JSON.parse(row.sheet_json || '{}'));
  } catch {
    sheet = {};
  }
  return {
    id: row.id,
    publicId: typeof row.public_id === 'string' && row.public_id ? row.public_id : row.id,
    ownerUserId: row.owner_user_id,
    characterType: parseCharacterType(row.character_type),
    sheetStatus: parseSheetStatus(row.sheet_status, 'complete'),
    name: row.name,
    description: row.description ?? '',
    level: Number.isFinite(row.level) ? row.level : 1,
    sheet,
    portraitStoragePath: row.portrait_storage_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/** Owner-scoped storage path: `{ownerUserId}/…` only. */
export function assertCharacterOwnerStoragePath(
  ownerUserId: string,
  storagePath: string,
): CharacterSheetResult<true> {
  const owner = ownerUserId.trim();
  const path = storagePath.trim().replace(/^\/+/, '');
  if (!owner || !path || path.includes('..')) {
    return { ok: false, error: 'invalid-storage-path' };
  }
  if (!path.startsWith(`${owner}/`)) {
    return { ok: false, error: 'foreign-storage-path' };
  }
  return { ok: true, value: true };
}

export class CharacterSheetStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  listOwned(actorId: string): CharacterSheetResult<readonly CharacterSheetRecord[]> {
    const rows = this.#db
      .prepare(
        `SELECT * FROM characters
         WHERE owner_user_id = ? AND deleted_at IS NULL AND character_type = 'pc'
         ORDER BY created_at DESC`,
      )
      .all(actorId) as CharacterRow[];
    return { ok: true, value: rows.map(mapRow) };
  }

  getOwned(actorId: string, characterId: string): CharacterSheetResult<CharacterSheetRecord | null> {
    const any = this.#db
      .prepare(
        `SELECT * FROM characters WHERE id = ? AND deleted_at IS NULL`,
      )
      .get(characterId) as CharacterRow | undefined;
    if (!any) return { ok: true, value: null };
    if (any.owner_user_id !== actorId) return { ok: false, error: 'not-authorized' };
    return { ok: true, value: mapRow(any) };
  }

  createOwned(actorId: string, draft: CharacterSheetDraft): CharacterSheetResult<CharacterSheetRecord> {
    const name = typeof draft.name === 'string' ? draft.name.trim() : '';
    if (!name) return { ok: false, error: 'name-required' };
    const level =
      typeof draft.level === 'number' && Number.isFinite(draft.level) && draft.level >= 1
        ? Math.floor(draft.level)
        : 1;
    const sheetStatus = parseSheetStatus(draft.sheetStatus, 'draft');
    const characterType = parseCharacterType(draft.characterType);
    if (characterType !== 'pc') return { ok: false, error: 'pc-only' };
    const description = typeof draft.description === 'string' ? draft.description : '';
    const sheet = asObject(draft.sheet);
    let portrait: string | null = null;
    if (draft.portraitStoragePath !== undefined && draft.portraitStoragePath !== null) {
      if (typeof draft.portraitStoragePath !== 'string') {
        return { ok: false, error: 'invalid-portrait-path' };
      }
      const pathCheck = assertCharacterOwnerStoragePath(actorId, draft.portraitStoragePath);
      if (!pathCheck.ok) return pathCheck;
      portrait = draft.portraitStoragePath.trim().replace(/^\/+/, '');
    }

    const id = randomUUID();
    const publicId = this.#uniquePublicId();
    const createdAt = nowIso();
    this.#db
      .prepare(
        `INSERT INTO characters (
           id, owner_user_id, character_type, sheet_status, name, created_at, public_id,
           updated_at, description, level, sheet_json, portrait_storage_path, deleted_at
         ) VALUES (?, ?, 'pc', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(
        id,
        actorId,
        sheetStatus,
        name,
        createdAt,
        publicId,
        createdAt,
        description,
        level,
        JSON.stringify(sheet),
        portrait,
      );
    const created = this.getOwned(actorId, id);
    if (!created.ok || !created.value) return { ok: false, error: 'create-failed' };
    return { ok: true, value: created.value };
  }

  updateOwned(
    actorId: string,
    characterId: string,
    draft: CharacterSheetDraft,
  ): CharacterSheetResult<CharacterSheetRecord> {
    const existing = this.getOwned(actorId, characterId);
    if (!existing.ok) return existing;
    if (!existing.value) return { ok: false, error: 'not-found' };
    // existing.value implies actor owns the row (getOwned DENY otherwise)

    const name =
      typeof draft.name === 'string' ? draft.name.trim() : existing.value.name;
    if (!name) return { ok: false, error: 'name-required' };
    const description =
      typeof draft.description === 'string' ? draft.description : existing.value.description;
    const level =
      typeof draft.level === 'number' && Number.isFinite(draft.level) && draft.level >= 1
        ? Math.floor(draft.level)
        : existing.value.level;
    const sheetStatus = parseSheetStatus(draft.sheetStatus, existing.value.sheetStatus);
    const sheet =
      draft.sheet !== undefined ? asObject(draft.sheet) : { ...existing.value.sheet };

    let portrait = existing.value.portraitStoragePath;
    if (draft.portraitStoragePath === null) {
      portrait = null;
    } else if (typeof draft.portraitStoragePath === 'string') {
      const pathCheck = assertCharacterOwnerStoragePath(actorId, draft.portraitStoragePath);
      if (!pathCheck.ok) return pathCheck;
      portrait = draft.portraitStoragePath.trim().replace(/^\/+/, '');
    }

    const updatedAt = nowIso();
    const changed = this.#db
      .prepare(
        `UPDATE characters SET
           name = ?, description = ?, level = ?, sheet_status = ?, sheet_json = ?,
           portrait_storage_path = ?, updated_at = ?
         WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`,
      )
      .run(
        name,
        description,
        level,
        sheetStatus,
        JSON.stringify(sheet),
        portrait,
        updatedAt,
        characterId,
        actorId,
      );
    if (changed.changes !== 1) return { ok: false, error: 'not-found' };
    const next = this.getOwned(actorId, characterId);
    if (!next.ok || !next.value) return { ok: false, error: 'not-found' };
    return { ok: true, value: next.value };
  }

  deleteOwned(actorId: string, characterId: string): CharacterSheetResult<{ readonly id: string }> {
    const owned = this.getOwned(actorId, characterId);
    if (!owned.ok) return owned;
    if (!owned.value) return { ok: false, error: 'not-found' };
    const updatedAt = nowIso();
    const changed = this.#db
      .prepare(
        `UPDATE characters SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`,
      )
      .run(updatedAt, updatedAt, characterId, actorId);
    if (changed.changes !== 1) return { ok: false, error: 'not-found' };
    return { ok: true, value: { id: characterId } };
  }

  listReadablePresets(actorId: string): CharacterSheetResult<readonly CharacterPresetRecord[]> {
    const rows = this.#db
      .prepare(
        `SELECT id, public_id, slug, display_name, visibility, owner_user_id, sheet_json
         FROM character_presets
         WHERE visibility = 'public'
            OR (visibility = 'owner' AND owner_user_id = ?)
         ORDER BY display_name ASC`,
      )
      .all(actorId) as Array<{
      id: string;
      public_id: string;
      slug: string;
      display_name: string;
      visibility: string;
      owner_user_id: string | null;
      sheet_json: string;
    }>;
    return {
      ok: true,
      value: rows.map((row) => ({
        id: row.id,
        publicId: row.public_id,
        slug: row.slug,
        displayName: row.display_name,
        visibility: row.visibility === 'owner' ? 'owner' : 'public',
        ownerUserId: row.owner_user_id,
        sheet: asObject(JSON.parse(row.sheet_json || '{}')),
      })),
    };
  }

  seedPublicPreset(input: {
    readonly slug: string;
    readonly displayName: string;
    readonly sheet?: Readonly<Record<string, unknown>>;
  }): CharacterPresetRecord {
    const id = randomUUID();
    const publicId = `CP-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const createdAt = nowIso();
    this.#db
      .prepare(
        `INSERT INTO character_presets
           (id, public_id, slug, display_name, visibility, owner_user_id, sheet_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'public', NULL, ?, ?, ?)`,
      )
      .run(
        id,
        publicId,
        input.slug,
        input.displayName,
        JSON.stringify(input.sheet ?? {}),
        createdAt,
        createdAt,
      );
    return {
      id,
      publicId,
      slug: input.slug,
      displayName: input.displayName,
      visibility: 'public',
      ownerUserId: null,
      sheet: input.sheet ?? {},
    };
  }

  resolveArtifact(
    actorId: string,
    storagePath: string,
  ): CharacterSheetResult<{ readonly storagePath: string; readonly characterId: string }> {
    const pathCheck = assertCharacterOwnerStoragePath(actorId, storagePath);
    if (!pathCheck.ok) return pathCheck;
    const normalized = storagePath.trim().replace(/^\/+/, '');
    const row = this.#db
      .prepare(
        `SELECT character_id AS characterId, storage_path AS storagePath
         FROM character_avatar_artifacts
         WHERE owner_user_id = ? AND storage_path = ?
         LIMIT 1`,
      )
      .get(actorId, normalized) as { characterId: string; storagePath: string } | undefined;
    if (!row) return { ok: false, error: 'not-found' };
    return { ok: true, value: row };
  }

  seedArtifact(input: {
    readonly ownerUserId: string;
    readonly characterId: string;
    readonly storagePath: string;
  }): CharacterSheetResult<{ readonly id: string }> {
    const pathCheck = assertCharacterOwnerStoragePath(input.ownerUserId, input.storagePath);
    if (!pathCheck.ok) return pathCheck;
    const id = randomUUID();
    this.#db
      .prepare(
        `INSERT INTO character_avatar_artifacts
           (id, character_id, owner_user_id, storage_path, kind, created_at)
         VALUES (?, ?, ?, ?, 'artifact', ?)`,
      )
      .run(
        id,
        input.characterId,
        input.ownerUserId,
        input.storagePath.trim().replace(/^\/+/, ''),
        nowIso(),
      );
    return { ok: true, value: { id } };
  }

  #uniquePublicId(): string {
    for (let i = 0; i < 16; i += 1) {
      const publicId = generateCharacterPublicId();
      const hit = this.#db
        .prepare(`SELECT 1 AS o FROM characters WHERE public_id = ? LIMIT 1`)
        .get(publicId);
      if (!hit) return publicId;
    }
    return generateCharacterPublicId();
  }
}
