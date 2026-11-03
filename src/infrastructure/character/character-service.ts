/**
 * character-service — Application facade over character persistence.
 * Location: src/infrastructure/character/character-service.ts
 *
 * Dual-path (MIG-302): when `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL,
 * Library list/read/create/update/delete use host Library HTTP; other character
 * flows keep Supabase until later FE-HOST slices.
 */
import type { CreateCharacterDto, UpdateCharacterDto } from '../../domains/character/contracts/character.commands';
import type {
  CharacterRosterMetaVm,
  CharacterSheetStatus,
  CharacterSummaryVm,
  CharacterVm,
} from '../../domains/character/contracts/character.views';
import { createEmptyInventory, migrateLegacyInventory } from '../../domains/character/inventory-v2';
import type { InventoryState } from '../../domains/character/inventory-v2';
import { assertPersonalLookOverrideWrite } from '../../domains/look';
import { createDefaultAbstractResources } from '../../domains/rules/sagatree/items';
import {
  normalizeAttributes,
  normalizeInventory,
  normalizeSagaTreeProfile,
  normalizeSkills,
  normalizeTextBlocks,
} from '../../domains/character/use-cases/normalize-character';
import { normalizeCharacterAppearance } from '../../domains/character/use-cases/avatar-presets';
import { ENTITY_CACHE_KEYS, entityCache } from '../../lib/entityCache';
import { getAuthenticatedUserId } from '../../lib/authenticatedUser';
import { persistMigratedInventory } from '../inventory/inventory-persistence';
import { getLookProfile } from '../look';
import { projectService } from '../project/project-service';
import {
  createHostLibraryCharacter,
  deleteHostLibraryCharacter,
  fetchHostLibraryCharacter,
  fetchHostLibraryCharacters,
  isHostLibraryEnabled,
  updateHostLibraryCharacter,
  type HostLibraryCharacterDto,
} from '../host/host-library-http';
import { characterAdventureArcService } from './character-adventure-arc-service';
import { supabaseCharacterRepository } from './supabase-character.repository';

function mapHostCharacterSummary(row: HostLibraryCharacterDto): CharacterSummaryVm {
  const sheetStatus: CharacterSheetStatus =
    row.sheetStatus === 'incomplete' || row.sheetStatus === 'draft' ? 'incomplete' : 'complete';
  return {
    id: row.id,
    publicId: typeof row.publicId === 'string' ? row.publicId : undefined,
    name: row.name,
    class: typeof row.class === 'string' ? row.class : '',
    race: typeof row.race === 'string' ? row.race : '',
    level: typeof row.level === 'number' ? row.level : 1,
    sheetStatus,
    portraitUrl:
      typeof row.portraitUrl === 'string' && row.portraitUrl.length > 0
        ? row.portraitUrl
        : undefined,
  };
}

function mapHostCharacterVm(row: HostLibraryCharacterDto): CharacterVm {
  const sheet = row.sheet ?? {};
  const summary = mapHostCharacterSummary(row);
  const createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
  const updatedAt = row.updatedAt ? new Date(row.updatedAt) : createdAt;
  return {
    id: summary.id,
    publicId: summary.publicId,
    name: summary.name,
    description: typeof row.description === 'string' ? row.description : '',
    class: summary.class,
    race: summary.race,
    rulesetKey: 'sagatree-core',
    level: summary.level,
    sheetStatus: summary.sheetStatus,
    notes: typeof sheet.notes === 'string' ? sheet.notes : '',
    personalityTraits: normalizeTextBlocks(sheet.personalityTraits),
    ideals: normalizeTextBlocks(sheet.ideals),
    bonds: normalizeTextBlocks(sheet.bonds),
    flaws: normalizeTextBlocks(sheet.flaws),
    appearance: normalizeCharacterAppearance(sheet.appearance),
    attributes: normalizeAttributes(sheet.attributes),
    skills: normalizeSkills(sheet.skills),
    sagaTreeProfile: normalizeSagaTreeProfile(sheet.sagatreeProfile ?? sheet.sagaTreeProfile),
    abilities: Array.isArray(sheet.abilities) ? (sheet.abilities as CharacterVm['abilities']) : [],
    inventory: normalizeInventory(
      Array.isArray(sheet.inventory) ? (sheet.inventory as Parameters<typeof normalizeInventory>[0]) : undefined,
    ),
    inventoryV2: createEmptyInventory(),
    inventorySchemaVersion: 1,
    abstractResources: createDefaultAbstractResources(),
    emotionProfiles: Array.isArray(sheet.emotionProfiles)
      ? (sheet.emotionProfiles as CharacterVm['emotionProfiles'])
      : [],
    portraitUrl: summary.portraitUrl,
    createdAt,
    updatedAt,
  };
}

function invalidateCharacterListCaches(): void {
  entityCache.invalidate(ENTITY_CACHE_KEYS.characterSummaries);
}

export type UploadPortraitOptions = {
  /**
   * When true, skip client optimize (caller already ran character-portrait intake).
   * Storage MIME/magic-byte/owner checks still run in the repository.
   */
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};

/**
 * Run the character-portrait media optimizer. Never returns the original after a
 * required optimize failure (no silent fallback upload).
 */
export async function prepareCharacterPortraitFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  // Lazy import keeps the WebP Worker out of the service module graph until prepare runs.
  const { optimizeMedia } = await import('../media/optimizer');
  let optimizedBytes: Uint8Array | undefined;
  const result = await optimizeMedia({
    kind: 'image',
    profileId: 'character-portrait',
    mimeType: file.type || 'application/octet-stream',
    byteSize: file.size,
    bytes: file,
    signal,
    onOptimizedBytes: (bytes) => {
      optimizedBytes = bytes;
    },
  });

  if (result.status === 'unchanged') {
    return file;
  }

  if (result.status === 'optimized') {
    if (!optimizedBytes || optimizedBytes.byteLength === 0) {
      throw new Error('Portrait-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'portrait';
    const ext = result.outputMimeType === 'image/webp' ? 'webp' : 'bin';
    return new File([copy], `${base}.${ext}`, { type: result.outputMimeType });
  }

  if (result.status === 'aborted') {
    throw new Error(result.message || 'Portrait-Optimierung abgebrochen.');
  }

  const message =
    'message' in result && typeof result.message === 'string'
      ? result.message
      : 'Portrait-Optimierung fehlgeschlagen.';
  throw new Error(message);
}

class CharacterService {
  async getUserCharacterSummaries(): Promise<CharacterSummaryVm[]> {
    if (isHostLibraryEnabled()) {
      const rows = await fetchHostLibraryCharacters();
      return rows.map(mapHostCharacterSummary);
    }
    return supabaseCharacterRepository.getUserCharacterSummaries();
  }

  async getUserCharacters(): Promise<CharacterVm[]> {
    if (isHostLibraryEnabled()) {
      const rows = await fetchHostLibraryCharacters();
      return rows.map(mapHostCharacterVm);
    }
    return supabaseCharacterRepository.getUserCharacters();
  }

  async getCharacterById(id: string): Promise<CharacterVm> {
    if (isHostLibraryEnabled()) {
      const row = await fetchHostLibraryCharacter(id);
      return mapHostCharacterVm(row);
    }
    return supabaseCharacterRepository.getCharacterById(id);
  }

  /** Batch lobby roster names — avoids N× getCharacterById(select('*')). */
  async getCharacterRosterMetaByIds(ids: readonly string[]): Promise<CharacterRosterMetaVm[]> {
    if (isHostLibraryEnabled()) {
      const rows = await fetchHostLibraryCharacters();
      const wanted = new Set(ids);
      return rows
        .filter((row) => wanted.has(row.id))
        .map((row) => {
          const summary = mapHostCharacterSummary(row);
          return {
            id: summary.id,
            publicId: summary.publicId ?? null,
            name: summary.name,
            portraitUrl: summary.portraitUrl ?? null,
            level: summary.level,
            classLabel: summary.class || null,
            raceKey: summary.race || null,
            essenceKey: null,
            archetypeKey: null,
          } satisfies CharacterRosterMetaVm;
        });
    }
    return supabaseCharacterRepository.getCharacterRosterMetaByIds(ids);
  }

  async getCharacterByPublicId(publicId: string): Promise<CharacterVm> {
    if (isHostLibraryEnabled()) {
      const rows = await fetchHostLibraryCharacters();
      const match = rows.find((row) => row.publicId === publicId);
      if (!match) throw new Error('Charakter nicht gefunden');
      return mapHostCharacterVm(match);
    }
    return supabaseCharacterRepository.getCharacterByPublicId(publicId);
  }

  async createCharacter(payload: CreateCharacterDto): Promise<CharacterVm> {
    if (isHostLibraryEnabled()) {
      const row = await createHostLibraryCharacter({
        name: payload.name,
        description: payload.description,
        class: payload.class,
        race: payload.race,
        level: payload.level ?? 1,
        sheet_status: payload.sheet_status ?? 'draft',
        notes: payload.notes,
        attributes: payload.attributes,
        skills: payload.skills,
        sagatree_profile: payload.sagatree_profile,
        appearance: payload.appearance,
        inventory: payload.inventory,
        sheet: {
          class: payload.class,
          race: payload.race,
          classLabel: payload.class,
          raceLabel: payload.race,
          notes: payload.notes,
          attributes: payload.attributes,
          skills: payload.skills,
          sagatreeProfile: payload.sagatree_profile,
          appearance: payload.appearance,
          inventory: payload.inventory,
          abilities: payload.abilities,
        },
      });
      invalidateCharacterListCaches();
      return mapHostCharacterVm(row);
    }
    const created = await supabaseCharacterRepository.createCharacter(payload);
    invalidateCharacterListCaches();
    return created;
  }

  async updateCharacter(id: string, payload: UpdateCharacterDto): Promise<CharacterVm> {
    if (payload.appearance && 'personal_look_profile_id' in payload.appearance) {
      await this.assertPersonalLookWriteGate(
        id,
        payload.appearance.personal_look_profile_id ?? null,
      );
    }
    if (isHostLibraryEnabled()) {
      const current = await fetchHostLibraryCharacter(id);
      const sheet: Record<string, unknown> = {
        ...(current.sheet ?? {}),
        ...(payload.class !== undefined ? { class: payload.class, classLabel: payload.class } : {}),
        ...(payload.race !== undefined ? { race: payload.race, raceLabel: payload.race } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
        ...(payload.appearance !== undefined ? { appearance: payload.appearance } : {}),
        ...(payload.attributes !== undefined ? { attributes: payload.attributes } : {}),
        ...(payload.skills !== undefined ? { skills: payload.skills } : {}),
        ...(payload.sagatree_profile !== undefined
          ? { sagatreeProfile: payload.sagatree_profile }
          : {}),
        ...(payload.abilities !== undefined ? { abilities: payload.abilities } : {}),
        ...(payload.inventory !== undefined ? { inventory: payload.inventory } : {}),
        ...(payload.personality_traits !== undefined
          ? { personalityTraits: payload.personality_traits }
          : {}),
        ...(payload.ideals !== undefined ? { ideals: payload.ideals } : {}),
        ...(payload.bonds !== undefined ? { bonds: payload.bonds } : {}),
        ...(payload.flaws !== undefined ? { flaws: payload.flaws } : {}),
      };
      const updated = await updateHostLibraryCharacter(id, {
        name: payload.name,
        description: payload.description,
        level: payload.level,
        sheet_status: payload.sheet_status,
        sheet,
        portrait_url: payload.portrait_url,
      });
      invalidateCharacterListCaches();
      return mapHostCharacterVm(updated);
    }
    const updated = await supabaseCharacterRepository.updateCharacter(id, payload);
    invalidateCharacterListCaches();
    return updated;
  }

  /**
   * Persist personal Look override only (#351). Null clears override (inherit world/saga).
   * DB trigger re-checks; this is the client fail-closed preflight.
   */
  async updateCharacterPersonalLook(
    characterId: string,
    personalLookProfileId: string | null,
  ): Promise<CharacterVm> {
    await this.assertPersonalLookWriteGate(characterId, personalLookProfileId);
    const current = await supabaseCharacterRepository.getCharacterById(characterId);
    const updated = await supabaseCharacterRepository.updateCharacter(characterId, {
      appearance: {
        ...current.appearance,
        personal_look_profile_id: personalLookProfileId,
      },
    });
    invalidateCharacterListCaches();
    return updated;
  }

  private async assertPersonalLookWriteGate(
    characterId: string,
    personalLookProfileId: string | null,
  ): Promise<void> {
    const actorUserId = await getAuthenticatedUserId();
    // Owner-scoped fetch — proves the actor can access this character.
    await supabaseCharacterRepository.getCharacterById(characterId);

    let sagaAllows = true;
    try {
      const arcs = await characterAdventureArcService.listArcsForCharacter(characterId);
      const activeArcs = arcs.filter((arc) => arc.status === 'active');
      for (const arc of activeArcs) {
        const project = await projectService.getProjectById(arc.projectId);
        if (!project.allowPlayerCharacterLookOverride) {
          sagaAllows = false;
          break;
        }
      }
    } catch {
      sagaAllows = true;
    }

    let lookOwnerUserId: string | null = null;
    let lookStatus: string | null = null;
    if (personalLookProfileId) {
      const record = await getLookProfile(personalLookProfileId);
      lookOwnerUserId = record?.profile.ownerId ?? null;
      lookStatus = record?.status ?? null;
    }

    const gate = assertPersonalLookOverrideWrite({
      // getCharacterById is owner-scoped — successful fetch implies actor owns the character.
      characterOwnerUserId: actorUserId,
      actorUserId,
      personalLookProfileId,
      lookOwnerUserId,
      lookStatus,
      sagaAllowsPlayerOverrides: sagaAllows,
    });
    if (gate.ok === false) {
      throw new Error(gate.messageDe);
    }
  }

  /**
   * One-shot migration of a character's legacy ItemDto[] into Inventory v2.
   * Creates Personal definitions first, then persists inventory_v2 and flips
   * inventory_schema_version to 2. Idempotent when already on schema 2.
   */
  async migrateCharacterInventoryToV2(characterId: string): Promise<InventoryState> {
    if (isHostLibraryEnabled()) {
      const character = await this.getCharacterById(characterId);
      return character.inventoryV2;
    }
    const character = await supabaseCharacterRepository.getCharacterById(characterId);
    if (character.inventorySchemaVersion === 2) {
      return character.inventoryV2;
    }
    const migration = migrateLegacyInventory(character.inventory);
    const state = await persistMigratedInventory(characterId, migration);
    invalidateCharacterListCaches();
    return state;
  }

  async deleteCharacter(id: string): Promise<void> {
    if (isHostLibraryEnabled()) {
      await deleteHostLibraryCharacter(id);
      invalidateCharacterListCaches();
      return;
    }
    await supabaseCharacterRepository.deleteCharacter(id);
    invalidateCharacterListCaches();
  }

  /** Owner-scoped clone with a fresh public id (DB trigger) and “(Kopie)” name. */
  async duplicateCharacter(id: string): Promise<CharacterVm> {
    const source = await this.getCharacterById(id);
    const suffix = ' (Kopie)';
    const maxBase = Math.max(1, 255 - suffix.length);
    const name = `${source.name.trim().slice(0, maxBase) || 'Charakter'}${suffix}`;
    if (isHostLibraryEnabled()) {
      const created = await createHostLibraryCharacter({
        name,
        description: source.description,
        class: source.class,
        race: source.race,
        level: source.level,
        sheet_status: source.sheetStatus === 'complete' ? 'draft' : source.sheetStatus,
        sheet: {
          class: source.class,
          race: source.race,
          classLabel: source.class,
          raceLabel: source.race,
          notes: source.notes,
          appearance: source.appearance,
          attributes: source.attributes,
          skills: source.skills,
          sagatreeProfile: source.sagaTreeProfile,
          abilities: source.abilities,
          inventory: source.inventory,
          personalityTraits: source.personalityTraits,
          ideals: source.ideals,
          bonds: source.bonds,
          flaws: source.flaws,
        },
      });
      invalidateCharacterListCaches();
      return mapHostCharacterVm(created);
    }
    const created = await supabaseCharacterRepository.createCharacter({
      name,
      description: source.description,
      class: source.class,
      race: source.race,
      ruleset_key: source.rulesetKey,
      dnd_background: source.dndBackground ?? null,
      level: source.level,
      sheet_status: source.sheetStatus,
      background_story: source.backgroundStory,
      notes: source.notes,
      personality_traits: source.personalityTraits,
      ideals: source.ideals,
      bonds: source.bonds,
      flaws: source.flaws,
      appearance: source.appearance,
      attributes: source.attributes,
      skills: source.skills,
      sagatree_profile: source.sagaTreeProfile,
      abilities: source.abilities,
      inventory: source.inventory,
      // Only copy v2 when already on schema 2 — avoid re-migrating legacy bags.
      ...(source.inventorySchemaVersion === 2
        ? { inventory_v2: source.inventoryV2 }
        : {}),
      abstractResources: source.abstractResources,
      portrait_url: source.portraitUrl,
    });
    invalidateCharacterListCaches();
    return created;
  }

  async searchCharacters(query: string): Promise<CharacterVm[]> {
    if (isHostLibraryEnabled()) {
      const rows = await fetchHostLibraryCharacters();
      const q = query.trim().toLowerCase();
      if (!q) return rows.map(mapHostCharacterVm);
      return rows
        .filter((row) => row.name.toLowerCase().includes(q))
        .map(mapHostCharacterVm);
    }
    return supabaseCharacterRepository.searchCharacters(query);
  }

  /**
   * Prepare (unless alreadyOptimized) then upload to owner-scoped Storage.
   * On failure the previous portrait URL is unchanged (caller keeps local state).
   */
  async uploadPortrait(file: File, options?: UploadPortraitOptions): Promise<string> {
    const prepared = options?.alreadyOptimized
      ? file
      : await prepareCharacterPortraitFile(file, options?.signal);
    return supabaseCharacterRepository.uploadPortrait(prepared);
  }

  preparePortraitFile(file: File, signal?: AbortSignal): Promise<File> {
    return prepareCharacterPortraitFile(file, signal);
  }
}

export const characterService = new CharacterService();
