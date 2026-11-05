/**
 * Owner-scoped product character presets (CUT-08 / #1143).
 * Private — import only from character public API.
 * Location: server/src/modules/character/internal/character-preset-product-store.ts
 *
 * Extends character_presets with versions_json / origin / source_character_id.
 * Seeded public rows (MIG-302) remain origin=system; product CRUD is origin=user only.
 */
import { randomUUID } from 'node:crypto';
import type { HostDatabase } from '../../../persistence/open-database.ts';
import type { CharacterSheetResult } from './character-sheet-store.ts';

export type CharacterPresetProductVersion = {
  readonly level: number;
  readonly snapshot: Readonly<Record<string, unknown>>;
  readonly created_at: string;
};

export type CharacterPresetProductRecord = {
  readonly id: string;
  readonly ownerUserId: string;
  readonly displayName: string;
  readonly rulesetKey: string;
  readonly origin: 'user' | 'system';
  readonly sourceCharacterId: string | null;
  readonly sourceCharacterMissing: boolean;
  readonly published: boolean;
  readonly versions: readonly CharacterPresetProductVersion[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateCharacterPresetProductInput = {
  readonly displayName: string;
  readonly rulesetKey: string;
  readonly sourceCharacterId: string;
  readonly snapshot: Readonly<Record<string, unknown>>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safePortraitUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:text/html') ||
    lower.startsWith('vbscript:')
  ) {
    return undefined;
  }
  return trimmed;
}

const ESSENCE_KEYS = new Set([
  'physical',
  'mental',
  'spiritual',
  'bound',
  'technological',
]);

/** Cost table mirrors FE `sagaTreeSpeciesTraitDefinitions` (budget = 3). */
const SPECIES_TRAIT_COST: Readonly<Record<string, number>> = {
  'sharpened-sense': 1,
  'natural-weapon': 1,
  'narrow-resistance': 1,
  'environment-adaptation': 1,
  'enduring-organism': 1,
  'low-rest-need': 1,
  'natural-protection': 2,
  'enhanced-climbing': 2,
  'enhanced-swimming': 2,
  amphibious: 2,
  'enhanced-sight': 2,
  flight: 3,
  'extreme-environment': 3,
  'exceptional-body': 3,
};

const SPECIES_TRAIT_BUDGET = 3;

/** Structural snapshot gate — mirrors FE assertValidSnapshot fail-closed rules. */
export function assertProductSnapshot(
  snapshot: Readonly<Record<string, unknown>>,
): CharacterSheetResult<Readonly<Record<string, unknown>>> {
  if (snapshot.schemaVersion !== 1) {
    return { ok: false, error: 'Ungültiger Preset-Snapshot (Schema).' };
  }
  if (snapshot.ruleset_key !== 'sagatree-core') {
    return { ok: false, error: 'Presets sind derzeit nur für SagaTree Core verfügbar.' };
  }
  if (typeof snapshot.name !== 'string' || !snapshot.name.trim()) {
    return { ok: false, error: 'Preset-Snapshot braucht einen Charakternamen.' };
  }
  const level = snapshot.level;
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 20) {
    return { ok: false, error: 'Preset-Level muss zwischen 1 und 20 liegen.' };
  }
  const appearance = snapshot.appearance;
  if (!isRecord(appearance) || typeof appearance.gender_reading !== 'string') {
    return { ok: false, error: 'Preset-Snapshot braucht eine gültige Geschlechts-Lesart.' };
  }
  const gender = appearance.gender_reading;
  if (gender !== 'masculine-read' && gender !== 'feminine-read' && gender !== 'diverse') {
    return { ok: false, error: 'Preset-Snapshot braucht eine gültige Geschlechts-Lesart.' };
  }
  const profile = snapshot.sagatree_profile;
  if (!isRecord(profile)) {
    return { ok: false, error: 'Preset-Snapshot braucht ein SagaTree-Profil.' };
  }
  if (typeof profile.essence !== 'string' || !ESSENCE_KEYS.has(profile.essence)) {
    return { ok: false, error: 'Preset-Snapshot braucht eine Essenz.' };
  }
  const bg = profile.background;
  if (!isRecord(bg) || typeof bg.name !== 'string' || !bg.name.trim()) {
    return { ok: false, error: 'Preset-Snapshot: Hintergrund braucht einen Namen.' };
  }
  const bgFields = [bg.milieuAccess, bg.contact, bg.complication, bg.communication];
  if (!bgFields.every((field) => typeof field === 'string' && field.trim())) {
    return {
      ok: false,
      error:
        'Preset-Snapshot: Hintergrund-Felder (Milieu/Kontakt/Komplikation/Kommunikation) unvollständig.',
    };
  }
  const traitsRaw = profile.speciesTraitInstances;
  if (!Array.isArray(traitsRaw)) {
    return {
      ok: false,
      error: `Preset-Snapshot: Speziesmerkmale müssen genau ${SPECIES_TRAIT_BUDGET} Punkte ergeben.`,
    };
  }
  let traitCost = 0;
  for (const entry of traitsRaw) {
    if (!isRecord(entry) || typeof entry.trait !== 'string') {
      return { ok: false, error: 'Preset-Snapshot: ungültiges Speziesmerkmal.' };
    }
    const cost = SPECIES_TRAIT_COST[entry.trait];
    if (typeof cost !== 'number') {
      return { ok: false, error: 'Preset-Snapshot: unbekanntes Speziesmerkmal.' };
    }
    traitCost += cost;
  }
  if (traitCost !== SPECIES_TRAIT_BUDGET) {
    return {
      ok: false,
      error: `Preset-Snapshot: Speziesmerkmale müssen genau ${SPECIES_TRAIT_BUDGET} Punkte ergeben.`,
    };
  }
  if (snapshot.race === 'alien') {
    const speciesProfile = profile.speciesProfile;
    if (!isRecord(speciesProfile) || typeof speciesProfile.name !== 'string' || !speciesProfile.name.trim()) {
      return { ok: false, error: 'Preset-Snapshot: Alien-Speziesprofil braucht einen Namen.' };
    }
  }
  if (!isRecord(profile.baseAttributes) && !isRecord(snapshot.attributes)) {
    return { ok: false, error: 'Preset-Snapshot: baseAttributes fehlen.' };
  }
  if (!isRecord(snapshot.attributes)) {
    return { ok: false, error: 'Preset-Snapshot: baseAttributes fehlen.' };
  }
  const portrait = safePortraitUrl(snapshot.portrait_url);
  if (portrait !== undefined && portrait !== snapshot.portrait_url) {
    return { ok: true, value: { ...snapshot, portrait_url: portrait } };
  }
  if (snapshot.portrait_url && portrait === undefined) {
    const rest: Record<string, unknown> = { ...snapshot };
    delete rest.portrait_url;
    return { ok: true, value: rest };
  }
  return { ok: true, value: snapshot };
}

function parseVersions(raw: string | null | undefined): CharacterPresetProductVersion[] {
  try {
    const parsed: unknown = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) return [];
    const out: CharacterPresetProductVersion[] = [];
    for (const item of parsed) {
      if (!isRecord(item)) continue;
      if (typeof item.level !== 'number' || typeof item.created_at !== 'string') continue;
      if (!isRecord(item.snapshot)) continue;
      const checked = assertProductSnapshot(item.snapshot);
      if (!checked.ok) continue;
      out.push({
        level: item.level,
        snapshot: checked.value,
        created_at: item.created_at,
      });
    }
    return out.sort((a, b) => a.level - b.level || a.created_at.localeCompare(b.created_at));
  } catch {
    return [];
  }
}

type PresetRow = {
  id: string;
  owner_user_id: string | null;
  display_name: string;
  ruleset_key: string;
  origin: string;
  source_character_id: string | null;
  published: number;
  versions_json: string;
  created_at: string;
  updated_at: string;
};

function mapRow(
  row: PresetRow,
  sourceMissing: boolean,
): CharacterPresetProductRecord | null {
  if (!row.owner_user_id) return null;
  const origin = row.origin === 'system' ? 'system' : 'user';
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    displayName: row.display_name,
    rulesetKey: row.ruleset_key || 'sagatree-core',
    origin,
    sourceCharacterId: row.source_character_id,
    sourceCharacterMissing: sourceMissing,
    published: row.published === 1,
    versions: parseVersions(row.versions_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicPresetId(): string {
  return `CP-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function productSlug(): string {
  return `user-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

export class CharacterPresetProductStore {
  readonly #db: HostDatabase;

  constructor(db: HostDatabase) {
    this.#db = db;
  }

  #existingSourceIds(actorId: string, sourceIds: readonly string[]): Set<string> {
    const existing = new Set<string>();
    if (sourceIds.length === 0) return existing;
    const placeholders = sourceIds.map(() => '?').join(', ');
    const rows = this.#db
      .prepare(
        `SELECT id FROM characters
         WHERE owner_user_id = ? AND deleted_at IS NULL AND id IN (${placeholders})`,
      )
      .all(actorId, ...sourceIds) as Array<{ id: string }>;
    for (const row of rows) existing.add(row.id);
    return existing;
  }

  #loadOwnedUser(actorId: string, presetId: string): CharacterSheetResult<PresetRow> {
    const row = this.#db
      .prepare(
        `SELECT id, owner_user_id, display_name, ruleset_key, origin, source_character_id,
                published, versions_json, created_at, updated_at
         FROM character_presets
         WHERE id = ? AND owner_user_id = ? AND origin = 'user'`,
      )
      .get(presetId, actorId) as PresetRow | undefined;
    if (!row) return { ok: false, error: 'not-found' };
    return { ok: true, value: row };
  }

  listUserPresets(actorId: string): CharacterSheetResult<readonly CharacterPresetProductRecord[]> {
    const rows = this.#db
      .prepare(
        `SELECT id, owner_user_id, display_name, ruleset_key, origin, source_character_id,
                published, versions_json, created_at, updated_at
         FROM character_presets
         WHERE owner_user_id = ? AND origin = 'user'
         ORDER BY created_at DESC`,
      )
      .all(actorId) as PresetRow[];
    const sourceIds = Array.from(
      new Set(
        rows
          .map((row) => row.source_character_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    const existing = this.#existingSourceIds(actorId, sourceIds);
    const mapped: CharacterPresetProductRecord[] = [];
    for (const row of rows) {
      const missing =
        Boolean(row.source_character_id) && !existing.has(row.source_character_id as string);
      const record = mapRow(row, missing);
      if (record) mapped.push(record);
    }
    return { ok: true, value: mapped };
  }

  getPresetForCharacter(
    actorId: string,
    characterId: string,
  ): CharacterSheetResult<CharacterPresetProductRecord | null> {
    const trimmed = characterId.trim();
    if (!trimmed) return { ok: false, error: 'invalid-character-id' };
    const row = this.#db
      .prepare(
        `SELECT id, owner_user_id, display_name, ruleset_key, origin, source_character_id,
                published, versions_json, created_at, updated_at
         FROM character_presets
         WHERE owner_user_id = ? AND origin = 'user' AND source_character_id = ?
         LIMIT 1`,
      )
      .get(actorId, trimmed) as PresetRow | undefined;
    if (!row) return { ok: true, value: null };
    const existing = this.#existingSourceIds(actorId, [trimmed]);
    return {
      ok: true,
      value: mapRow(row, !existing.has(trimmed)),
    };
  }

  createFromCharacter(
    actorId: string,
    input: CreateCharacterPresetProductInput,
  ): CharacterSheetResult<CharacterPresetProductRecord> {
    if (input.rulesetKey !== 'sagatree-core') {
      return { ok: false, error: 'Presets sind derzeit nur für SagaTree Core verfügbar.' };
    }
    const sourceId = input.sourceCharacterId.trim();
    if (!sourceId) return { ok: false, error: 'invalid-character-id' };

    const owned = this.#db
      .prepare(
        `SELECT id FROM characters
         WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
         LIMIT 1`,
      )
      .get(sourceId, actorId) as { id: string } | undefined;
    if (!owned) return { ok: false, error: 'not-found' };

    const existing = this.getPresetForCharacter(actorId, sourceId);
    if (!existing.ok) return existing;
    if (existing.value) {
      return {
        ok: false,
        error: 'Für diesen Charakter existiert bereits ein Preset. Nutze „Version freigeben“.',
      };
    }

    const snap = assertProductSnapshot(input.snapshot);
    if (!snap.ok) return snap;

    const version: CharacterPresetProductVersion = {
      level: snap.value.level as number,
      snapshot: snap.value,
      created_at: nowIso(),
    };
    const id = randomUUID();
    const createdAt = nowIso();
    const displayName =
      input.displayName.trim() ||
      `${typeof snap.value.name === 'string' ? snap.value.name.trim() : 'Charakter'} Preset`;

    try {
      this.#db
        .prepare(
          `INSERT INTO character_presets
             (id, public_id, slug, display_name, visibility, owner_user_id, sheet_json,
              created_at, updated_at, ruleset_key, origin, source_character_id, published, versions_json)
           VALUES (?, ?, ?, ?, 'owner', ?, ?, ?, ?, 'sagatree-core', 'user', ?, 0, ?)`,
        )
        .run(
          id,
          publicPresetId(),
          productSlug(),
          displayName,
          actorId,
          JSON.stringify(snap.value),
          createdAt,
          createdAt,
          sourceId,
          JSON.stringify([version]),
        );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/UNIQUE|unique/i.test(message)) {
        return {
          ok: false,
          error: 'Für diesen Charakter existiert bereits ein Preset. Nutze „Version freigeben“.',
        };
      }
      return { ok: false, error: `Preset konnte nicht gespeichert werden: ${message}` };
    }

    const loaded = this.#loadOwnedUser(actorId, id);
    if (!loaded.ok) return loaded;
    const record = mapRow(loaded.value, false);
    if (!record) return { ok: false, error: 'Preset konnte nicht gespeichert werden.' };
    return { ok: true, value: record };
  }

  releaseVersion(
    actorId: string,
    presetId: string,
    snapshot: Readonly<Record<string, unknown>>,
  ): CharacterSheetResult<CharacterPresetProductRecord> {
    const snap = assertProductSnapshot(snapshot);
    if (!snap.ok) return snap;
    const loaded = this.#loadOwnedUser(actorId, presetId);
    if (!loaded.ok) return loaded;

    const versions = parseVersions(loaded.value.versions_json);
    const level = snap.value.level as number;
    if (versions.some((version) => version.level === level)) {
      return { ok: false, error: `Für Level ${level} existiert bereits eine Preset-Version.` };
    }

    const nextVersions = [
      ...versions,
      { level, snapshot: snap.value, created_at: nowIso() },
    ].sort((a, b) => a.level - b.level || a.created_at.localeCompare(b.created_at));

    const updatedAt = nowIso();
    const changed = this.#db
      .prepare(
        `UPDATE character_presets
         SET versions_json = ?, published = 0, sheet_json = ?, updated_at = ?
         WHERE id = ? AND owner_user_id = ? AND origin = 'user'`,
      )
      .run(
        JSON.stringify(nextVersions),
        JSON.stringify(snap.value),
        updatedAt,
        presetId,
        actorId,
      );
    if (changed.changes !== 1) return { ok: false, error: 'not-found' };

    const refreshed = this.#loadOwnedUser(actorId, presetId);
    if (!refreshed.ok) return refreshed;
    const sourceId = refreshed.value.source_character_id;
    const missing =
      Boolean(sourceId) && !this.#existingSourceIds(actorId, [sourceId as string]).has(sourceId as string);
    const record = mapRow(refreshed.value, missing);
    if (!record) return { ok: false, error: 'not-found' };
    return { ok: true, value: record };
  }

  renamePreset(
    actorId: string,
    presetId: string,
    displayName: string,
  ): CharacterSheetResult<CharacterPresetProductRecord> {
    const trimmed = displayName.trim();
    if (!trimmed) return { ok: false, error: 'Preset-Name darf nicht leer sein.' };
    const updatedAt = nowIso();
    const changed = this.#db
      .prepare(
        `UPDATE character_presets
         SET display_name = ?, published = 0, updated_at = ?
         WHERE id = ? AND owner_user_id = ? AND origin = 'user'`,
      )
      .run(trimmed, updatedAt, presetId, actorId);
    if (changed.changes !== 1) return { ok: false, error: 'not-found' };
    const refreshed = this.#loadOwnedUser(actorId, presetId);
    if (!refreshed.ok) return refreshed;
    const sourceId = refreshed.value.source_character_id;
    const missing =
      Boolean(sourceId) && !this.#existingSourceIds(actorId, [sourceId as string]).has(sourceId as string);
    const record = mapRow(refreshed.value, missing);
    if (!record) return { ok: false, error: 'not-found' };
    return { ok: true, value: record };
  }

  duplicatePreset(
    actorId: string,
    presetId: string,
  ): CharacterSheetResult<CharacterPresetProductRecord> {
    const loaded = this.#loadOwnedUser(actorId, presetId);
    if (!loaded.ok) return loaded;
    const versions = parseVersions(loaded.value.versions_json);
    const id = randomUUID();
    const createdAt = nowIso();
    const latestSheet =
      versions.length > 0 ? versions[versions.length - 1]?.snapshot ?? {} : {};
    this.#db
      .prepare(
        `INSERT INTO character_presets
           (id, public_id, slug, display_name, visibility, owner_user_id, sheet_json,
            created_at, updated_at, ruleset_key, origin, source_character_id, published, versions_json)
         VALUES (?, ?, ?, ?, 'owner', ?, ?, ?, ?, ?, 'user', NULL, 0, ?)`,
      )
      .run(
        id,
        publicPresetId(),
        productSlug(),
        `${loaded.value.display_name} (Kopie)`,
        actorId,
        JSON.stringify(latestSheet),
        createdAt,
        createdAt,
        loaded.value.ruleset_key || 'sagatree-core',
        JSON.stringify(versions),
      );
    const refreshed = this.#loadOwnedUser(actorId, id);
    if (!refreshed.ok) return refreshed;
    const record = mapRow(refreshed.value, false);
    if (!record) return { ok: false, error: 'Preset konnte nicht dupliziert werden.' };
    return { ok: true, value: record };
  }

  deletePreset(actorId: string, presetId: string): CharacterSheetResult<{ readonly id: string }> {
    const changed = this.#db
      .prepare(
        `DELETE FROM character_presets
         WHERE id = ? AND owner_user_id = ? AND origin = 'user'`,
      )
      .run(presetId, actorId);
    if (changed.changes !== 1) return { ok: false, error: 'not-found' };
    return { ok: true, value: { id: presetId } };
  }
}
