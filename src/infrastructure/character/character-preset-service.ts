/**
 * characterPreset.service — Owner-scoped CRUD + append-only Level versions for character presets.
 * Location: src/infrastructure/character/character-preset-service.ts
 *
 * CUT-08: host-first via `/api/v1/library/character-presets/*` when library host is enabled;
 * Host Library HTTP only (CUT-20).
 */
import { normalizeCharacterAppearance, normalizeSafeUrl } from '../../domains/character/use-cases/avatar-presets';
import { assertValidSagaTreeCharacterPersistence } from '../../domains/character';
import {
  SAGA_TREE_SPECIES_TRAIT_BUDGET,
  createEmptySagaTreeSkillRanks,
  getSagaTreeSpeciesTraitCost,
  isCharacterRulesetKey,
  isSagaTreeEssenceKey,
  sagaTreeSkillDefinitions,
  type CharacterRulesetKey,
  type SagaTreeSkillKey,
} from '../../domains/rules/sagatree/character-creation';
import type { CharacterAttributesDto, CharacterGenderReading, SagaTreeProfileDto } from '../../domains/character';
import type {
  CharacterPresetDto,
  CharacterPresetOrigin,
  CharacterPresetSnapshot,
  CharacterPresetVersionDto,
  CharacterPresetVm,
  CreateCharacterPresetInput,
  ReleaseCharacterPresetVersionInput,
} from '../../domains/character/contracts/character-preset.types';
import {
  createHostLibraryCharacterPreset,
  deleteHostLibraryCharacterPreset,
  duplicateHostLibraryCharacterPreset,
  fetchHostLibraryCharacterPresetForCharacter,
  fetchHostLibraryCharacterPresets,
  isHostLibraryEnabled,
  releaseHostLibraryCharacterPresetVersion,
  renameHostLibraryCharacterPreset,
} from '../host/host-library-http';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPresetOrigin(value: unknown): value is CharacterPresetOrigin {
  return value === 'user' || value === 'system';
}

function isGenderReading(value: unknown): value is CharacterGenderReading {
  return value === 'masculine-read' || value === 'feminine-read' || value === 'diverse';
}

function normalizeSkills(value: unknown): Record<SagaTreeSkillKey, number> {
  const result = createEmptySagaTreeSkillRanks();
  if (!isRecord(value)) return result;
  for (const skill of sagaTreeSkillDefinitions) {
    const rank = value[skill.key];
    if (typeof rank === 'number' && Number.isFinite(rank)) {
      result[skill.key] = Math.max(0, Math.min(5, Math.round(rank)));
    }
  }
  return result;
}

/** Fail closed: invalid snapshots must not be written or hydrated into the editor. */
export function assertValidSnapshot(snapshot: CharacterPresetSnapshot): void {
  if (snapshot.schemaVersion !== 1) {
    throw new Error('Ungültiger Preset-Snapshot (Schema).');
  }
  if (snapshot.ruleset_key !== 'sagatree-core') {
    throw new Error('Presets sind derzeit nur für SagaTree Core verfügbar.');
  }
  if (!snapshot.name.trim()) {
    throw new Error('Preset-Snapshot braucht einen Charakternamen.');
  }
  if (!isGenderReading(snapshot.appearance?.gender_reading)) {
    throw new Error('Preset-Snapshot braucht eine gültige Geschlechts-Lesart.');
  }
  const level = snapshot.level;
  if (!Number.isInteger(level) || level < 1 || level > 20) {
    throw new Error('Preset-Level muss zwischen 1 und 20 liegen.');
  }

  const profile = snapshot.sagatree_profile;
  if (!profile) {
    throw new Error('Preset-Snapshot braucht ein SagaTree-Profil.');
  }
  if (!isSagaTreeEssenceKey(profile.essence)) {
    throw new Error('Preset-Snapshot braucht eine Essenz.');
  }

  const bg = profile.background;
  if (!bg?.name?.trim()) {
    throw new Error('Preset-Snapshot: Hintergrund braucht einen Namen.');
  }
  if (![bg.milieuAccess, bg.contact, bg.complication, bg.communication].every((field) => typeof field === 'string' && field.trim())) {
    throw new Error('Preset-Snapshot: Hintergrund-Felder (Milieu/Kontakt/Komplikation/Kommunikation) unvollständig.');
  }

  const traitKeys = (profile.speciesTraitInstances ?? []).map((instance) => instance.trait);
  if (getSagaTreeSpeciesTraitCost(traitKeys) !== SAGA_TREE_SPECIES_TRAIT_BUDGET) {
    throw new Error(`Preset-Snapshot: Speziesmerkmale müssen genau ${SAGA_TREE_SPECIES_TRAIT_BUDGET} Punkte ergeben.`);
  }
  if (snapshot.race === 'alien' && !profile.speciesProfile?.name?.trim()) {
    throw new Error('Preset-Snapshot: Alien-Speziesprofil braucht einen Namen.');
  }
  if (!profile.baseAttributes) {
    throw new Error('Preset-Snapshot: baseAttributes fehlen.');
  }

  assertValidSagaTreeCharacterPersistence(snapshot.attributes, snapshot.skills, profile, level);
}

function withSafePortraitUrl(snapshot: CharacterPresetSnapshot): CharacterPresetSnapshot {
  if (!snapshot.portrait_url) return snapshot;
  const safePortrait = normalizeSafeUrl(snapshot.portrait_url);
  if (safePortrait === snapshot.portrait_url) return snapshot;
  return { ...snapshot, portrait_url: safePortrait };
}

function normalizeSnapshot(value: unknown): CharacterPresetSnapshot | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  if (typeof value.name !== 'string' || typeof value.race !== 'string' || typeof value.class !== 'string') return null;
  if (typeof value.level !== 'number') return null;
  const rawRuleset = typeof value.ruleset_key === 'string' && isCharacterRulesetKey(value.ruleset_key)
    ? value.ruleset_key
    : 'sagatree-core';
  const rulesetKey: CharacterRulesetKey = rawRuleset === 'dnd-5.5e' ? 'dnd-5.5e' : 'sagatree-core';
  const appearance = normalizeCharacterAppearance(isRecord(value.appearance) ? value.appearance : undefined);
  const profileRecord = isRecord(value.sagatree_profile) ? value.sagatree_profile : null;
  const profile = profileRecord ? (profileRecord as unknown as SagaTreeProfileDto) : null;
  if (!profile) return null;

  const snapshot: CharacterPresetSnapshot = {
    schemaVersion: 1,
    name: value.name,
    description: typeof value.description === 'string' ? value.description : '',
    class: value.class,
    race: value.race,
    ruleset_key: rulesetKey,
    level: value.level,
    appearance,
    attributes: {
      strength: typeof (value.attributes as CharacterAttributesDto | undefined)?.strength === 'number' ? (value.attributes as CharacterAttributesDto).strength : 0,
      dexterity: typeof (value.attributes as CharacterAttributesDto | undefined)?.dexterity === 'number' ? (value.attributes as CharacterAttributesDto).dexterity : 0,
      endurance: typeof (value.attributes as CharacterAttributesDto | undefined)?.endurance === 'number' ? (value.attributes as CharacterAttributesDto).endurance : 0,
      mind: typeof (value.attributes as CharacterAttributesDto | undefined)?.mind === 'number' ? (value.attributes as CharacterAttributesDto).mind : 0,
      perception: typeof (value.attributes as CharacterAttributesDto | undefined)?.perception === 'number' ? (value.attributes as CharacterAttributesDto).perception : 0,
      charisma: typeof (value.attributes as CharacterAttributesDto | undefined)?.charisma === 'number' ? (value.attributes as CharacterAttributesDto).charisma : 0,
    },
    skills: normalizeSkills(value.skills),
    sagatree_profile: profile,
    abilities: Array.isArray(value.abilities) ? value.abilities as CharacterPresetSnapshot['abilities'] : [],
    inventory: Array.isArray(value.inventory) ? value.inventory as CharacterPresetSnapshot['inventory'] : [],
  };
  if (typeof value.background_story === 'string') snapshot.background_story = value.background_story;
  if (typeof value.notes === 'string') snapshot.notes = value.notes;
  if (Array.isArray(value.personality_traits)) snapshot.personality_traits = value.personality_traits.filter((entry): entry is string => typeof entry === 'string');
  if (Array.isArray(value.ideals)) snapshot.ideals = value.ideals.filter((entry): entry is string => typeof entry === 'string');
  if (Array.isArray(value.bonds)) snapshot.bonds = value.bonds.filter((entry): entry is string => typeof entry === 'string');
  if (Array.isArray(value.flaws)) snapshot.flaws = value.flaws.filter((entry): entry is string => typeof entry === 'string');
  if (typeof value.portrait_url === 'string' && value.portrait_url.trim()) {
    const safePortrait = normalizeSafeUrl(value.portrait_url);
    if (safePortrait) snapshot.portrait_url = safePortrait;
  }
  return snapshot;
}

function normalizeVersions(value: unknown): CharacterPresetVersionDto[] {
  if (!Array.isArray(value)) return [];
  const versions: CharacterPresetVersionDto[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.level !== 'number' || typeof item.created_at !== 'string') continue;
    const snapshot = normalizeSnapshot(item.snapshot);
    if (!snapshot) continue;
    try {
      assertValidSnapshot(snapshot);
    } catch (error) {
      console.error(
        'Skipping invalid preset version on read:',
        error instanceof Error ? error.message : error,
      );
      continue;
    }
    versions.push({ level: item.level, snapshot, created_at: item.created_at });
  }
  return versions.sort((a, b) => a.level - b.level || a.created_at.localeCompare(b.created_at));
}

function mapToViewModel(dto: CharacterPresetDto, sourceMissing: boolean): CharacterPresetVm {
  return {
    id: dto.id,
    displayName: dto.display_name,
    rulesetKey: isCharacterRulesetKey(dto.ruleset_key) ? dto.ruleset_key : 'sagatree-core',
    origin: isPresetOrigin(dto.origin) ? dto.origin : 'user',
    sourceCharacterId: dto.source_character_id,
    sourceCharacterMissing: sourceMissing,
    published: dto.published === true,
    versions: normalizeVersions(dto.versions),
    createdAt: new Date(dto.created_at),
    updatedAt: new Date(dto.updated_at),
  };
}

function mapHostPresetRow(value: unknown): CharacterPresetVm | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  const dto: CharacterPresetDto = {
    id: value.id,
    owner_user_id: typeof value.owner_user_id === 'string' ? value.owner_user_id : '',
    display_name: typeof value.display_name === 'string' ? value.display_name : '',
    ruleset_key:
      typeof value.ruleset_key === 'string' && isCharacterRulesetKey(value.ruleset_key)
        ? value.ruleset_key
        : 'sagatree-core',
    origin: isPresetOrigin(value.origin) ? value.origin : 'user',
    source_character_id:
      typeof value.source_character_id === 'string' ? value.source_character_id : null,
    published: value.published === true,
    versions: Array.isArray(value.versions)
      ? (value.versions as CharacterPresetVersionDto[])
      : [],
    created_at: typeof value.created_at === 'string' ? value.created_at : new Date().toISOString(),
    updated_at: typeof value.updated_at === 'string' ? value.updated_at : new Date().toISOString(),
  };
  const missing = value.source_character_missing === true;
  return mapToViewModel(dto, missing);
}

class CharacterPresetService {
  async listUserPresets(): Promise<CharacterPresetVm[]> {
    assertHost();
    const rows = await fetchHostLibraryCharacterPresets();
    return rows
      .map(mapHostPresetRow)
      .filter((row): row is CharacterPresetVm => row !== null);
  }

  async getPresetForCharacter(characterId: string): Promise<CharacterPresetVm | null> {
    assertHost();
    const row = await fetchHostLibraryCharacterPresetForCharacter(characterId);
    return row ? mapHostPresetRow(row) : null;
  }

  async createPresetFromCharacter(input: CreateCharacterPresetInput): Promise<CharacterPresetVm> {
    if (input.rulesetKey !== 'sagatree-core') {
      throw new Error('Presets sind derzeit nur für SagaTree Core verfügbar.');
    }
    const snapshot = withSafePortraitUrl(input.snapshot);
    assertValidSnapshot(snapshot);

    assertHost();
    const created = await createHostLibraryCharacterPreset({
      displayName: input.displayName.trim() || `${snapshot.name.trim()} Preset`,
      rulesetKey: 'sagatree-core',
      sourceCharacterId: input.sourceCharacterId,
      snapshot,
    });
    const mapped = mapHostPresetRow(created);
    if (!mapped) throw new Error('Host-Charakter-Preset anlegen: ungültige Antwort');
    return mapped;
  }

  async releaseVersion(input: ReleaseCharacterPresetVersionInput): Promise<CharacterPresetVm> {
    const snapshot = withSafePortraitUrl(input.snapshot);
    assertValidSnapshot(snapshot);

    assertHost();
    const existingRows = await fetchHostLibraryCharacterPresets();
    const existing = existingRows
      .map(mapHostPresetRow)
      .find((row): row is CharacterPresetVm => row !== null && row.id === input.presetId);
    if (
      existing &&
      existing.versions.some((version) => version.level === snapshot.level)
    ) {
      throw new Error(`Für Level ${snapshot.level} existiert bereits eine Preset-Version.`);
    }
    const released = await releaseHostLibraryCharacterPresetVersion(input.presetId, snapshot);
    const mapped = mapHostPresetRow(released);
    if (!mapped) throw new Error('Host-Charakter-Preset-Version: ungültige Antwort');
    return mapped;
  }

  async renamePreset(presetId: string, displayName: string): Promise<CharacterPresetVm> {
    const trimmed = displayName.trim();
    if (!trimmed) throw new Error('Preset-Name darf nicht leer sein.');

    assertHost();
    const renamed = await renameHostLibraryCharacterPreset(presetId, trimmed);
    const mapped = mapHostPresetRow(renamed);
    if (!mapped) throw new Error('Host-Charakter-Preset umbenennen: ungültige Antwort');
    return mapped;
  }

  async duplicatePreset(presetId: string): Promise<CharacterPresetVm> {
    assertHost();
    const duplicated = await duplicateHostLibraryCharacterPreset(presetId);
    const mapped = mapHostPresetRow(duplicated);
    if (!mapped) throw new Error('Host-Charakter-Preset duplizieren: ungültige Antwort');
    if (mapped.displayName.includes('(Kopie)')) return mapped;
    return this.renamePreset(mapped.id, `${mapped.displayName} (Kopie)`);
  }

  async deletePreset(presetId: string): Promise<void> {
    assertHost();
    await deleteHostLibraryCharacterPreset(presetId);
  }

  /**
   * Auto-release after successful character save when level increased.
   * No-op when no linked preset, level already released, or validation fails.
   */
  async maybeAutoReleaseVersion(input: {
    characterId: string;
    previousLevel: number;
    snapshot: CharacterPresetSnapshot;
    releaseMode: 'manual' | 'auto';
  }): Promise<CharacterPresetVm | null> {
    if (input.releaseMode !== 'auto') return null;
    if (input.snapshot.level <= input.previousLevel) return null;
    const linked = await this.getPresetForCharacter(input.characterId);
    if (!linked) return null;
    if (linked.versions.some((version) => version.level === input.snapshot.level)) return linked;
    try {
      return await this.releaseVersion({ presetId: linked.id, snapshot: input.snapshot });
    } catch (error) {
      console.error('Auto preset release skipped:', error instanceof Error ? error.message : error);
      return null;
    }
  }
}

export const characterPresetService = new CharacterPresetService();
