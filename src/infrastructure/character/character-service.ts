/**
 * character-service — Application facade over character persistence (CUT-20 host Library HTTP).
 * Location: src/infrastructure/character/character-service.ts
 */
import type { CreateCharacterDto, UpdateCharacterDto } from '../../domains/character/contracts/character.commands';
import type {
  CharacterRosterMetaVm,
  CharacterSheetStatus,
  CharacterSummaryVm,
  CharacterVm,
} from '../../domains/character/contracts/character.views';
import {
  createEmptyInventory,
  migrateLegacyInventory,
} from '../../domains/character/inventory-v2';
import type { InventoryState } from '../../domains/character/inventory-v2';
import type { ItemDto } from '../../domains/character/domain/character.entity';
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
import { probeHostActor } from '../../lib/hostAuthBridge';
import { getLookProfile } from '../look';
import { projectService } from '../project/project-service';
import {
  createHostLibraryCharacter,
  deleteHostLibraryCharacter,
  fetchHostLibraryCharacter,
  fetchHostLibraryCharacters,
  isHostLibraryEnabled,
  publishHostAsset,
  updateHostLibraryCharacter,
  type HostLibraryCharacterDto,
} from '../host/host-library-http';
import { characterAdventureArcService } from './character-adventure-arc-service';
import type { CharacterDto } from './character.persistence';
import { readCharacterInventory, persistMigratedInventory } from '../inventory/inventory-persistence';

function assertHost(): void {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
}

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

function readSheetNumber(
  sheet: Record<string, unknown>,
  snake: string,
  camel: string,
): number | undefined {
  const snakeVal = sheet[snake];
  if (typeof snakeVal === 'number') return snakeVal;
  const camelVal = sheet[camel];
  if (typeof camelVal === 'number') return camelVal;
  return undefined;
}

function hostSheetInventorySlice(
  row: HostLibraryCharacterDto,
): Pick<CharacterDto, 'inventory' | 'inventory_v2' | 'inventory_schema_version'> {
  const sheet = (row.sheet ?? {}) as Record<string, unknown>;
  const schemaRaw = readSheetNumber(sheet, 'inventory_schema_version', 'inventorySchemaVersion');
  const schema: 1 | 2 = schemaRaw === 2 ? 2 : 1;
  const invV2 =
    sheet.inventory_v2 !== undefined ? sheet.inventory_v2 : sheet.inventoryV2;
  return {
    inventory: Array.isArray(sheet.inventory) ? (sheet.inventory as ItemDto[]) : [],
    inventory_v2: invV2,
    inventory_schema_version: schema,
  };
}

function mapHostCharacterVm(row: HostLibraryCharacterDto): CharacterVm {
  const sheet = row.sheet ?? {};
  const summary = mapHostCharacterSummary(row);
  const createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
  const updatedAt = row.updatedAt ? new Date(row.updatedAt) : createdAt;
  const invRead = readCharacterInventory(hostSheetInventorySlice(row));
  const schemaVersion: 1 | 2 = invRead.authoritativeV2 ? 2 : 1;
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
    inventoryV2: invRead.state,
    inventorySchemaVersion: schemaVersion,
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
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};

export async function prepareCharacterPortraitFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
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
    assertHost();
    const rows = await fetchHostLibraryCharacters();
    return rows.map(mapHostCharacterSummary);
  }

  async getUserCharacters(): Promise<CharacterVm[]> {
    assertHost();
    const rows = await fetchHostLibraryCharacters();
    return rows.map(mapHostCharacterVm);
  }

  async getCharacterById(id: string): Promise<CharacterVm> {
    assertHost();
    const row = await fetchHostLibraryCharacter(id);
    return mapHostCharacterVm(row);
  }

  async getCharacterRosterMetaByIds(ids: readonly string[]): Promise<CharacterRosterMetaVm[]> {
    assertHost();
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

  async getCharacterByPublicId(publicId: string): Promise<CharacterVm> {
    assertHost();
    const rows = await fetchHostLibraryCharacters();
    const match = rows.find((row) => row.publicId === publicId);
    if (!match) throw new Error('Charakter nicht gefunden');
    return mapHostCharacterVm(match);
  }

  async createCharacter(payload: CreateCharacterDto): Promise<CharacterVm> {
    assertHost();
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
        ...(payload.inventory_v2 !== undefined
          ? { inventory_v2: payload.inventory_v2, inventory_schema_version: 2 }
          : {}),
        abilities: payload.abilities,
      },
    });
    invalidateCharacterListCaches();
    return mapHostCharacterVm(row);
  }

  async updateCharacter(id: string, payload: UpdateCharacterDto): Promise<CharacterVm> {
    assertHost();
    if (payload.appearance && 'personal_look_profile_id' in payload.appearance) {
      await this.assertPersonalLookWriteGate(
        id,
        payload.appearance.personal_look_profile_id ?? null,
      );
    }
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
      ...(payload.inventory_v2 !== undefined
        ? { inventory_v2: payload.inventory_v2, inventory_schema_version: 2 }
        : {}),
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

  async updateCharacterPersonalLook(
    characterId: string,
    personalLookProfileId: string | null,
  ): Promise<CharacterVm> {
    await this.assertPersonalLookWriteGate(characterId, personalLookProfileId);
    assertHost();
    const current = await fetchHostLibraryCharacter(characterId);
    const appearance = {
      ...((current.sheet?.appearance as Record<string, unknown> | undefined) ?? {}),
      personal_look_profile_id: personalLookProfileId,
    };
    const updated = await updateHostLibraryCharacter(characterId, {
      sheet: { ...(current.sheet ?? {}), appearance },
    });
    invalidateCharacterListCaches();
    return mapHostCharacterVm(updated);
  }

  private async assertPersonalLookWriteGate(
    characterId: string,
    personalLookProfileId: string | null,
  ): Promise<void> {
    assertHost();
    await fetchHostLibraryCharacter(characterId);
    const who = await probeHostActor();
    const actorUserId = who?.actorId ?? 'solo';

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

  async migrateCharacterInventoryToV2(characterId: string): Promise<InventoryState> {
    assertHost();
    const row = await fetchHostLibraryCharacter(characterId);
    const slice = hostSheetInventorySlice(row);
    const read = readCharacterInventory(slice);
    if (read.authoritativeV2) {
      return read.state;
    }
    const migration = migrateLegacyInventory(slice.inventory as ItemDto[] | undefined);
    const state = await persistMigratedInventory(characterId, migration);
    invalidateCharacterListCaches();
    return state;
  }

  async deleteCharacter(id: string): Promise<void> {
    assertHost();
    await deleteHostLibraryCharacter(id);
    invalidateCharacterListCaches();
  }

  async duplicateCharacter(id: string): Promise<CharacterVm> {
    assertHost();
    const source = await this.getCharacterById(id);
    const suffix = ' (Kopie)';
    const maxBase = Math.max(1, 255 - suffix.length);
    const name = `${source.name.trim().slice(0, maxBase) || 'Charakter'}${suffix}`;
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
        ...(source.inventorySchemaVersion === 2
          ? { inventory_v2: source.inventoryV2, inventory_schema_version: 2 as const }
          : {}),
      },
    });
    invalidateCharacterListCaches();
    return mapHostCharacterVm(created);
  }

  async searchCharacters(query: string): Promise<CharacterVm[]> {
    assertHost();
    const rows = await fetchHostLibraryCharacters();
    const q = query.trim().toLowerCase();
    if (!q) return rows.map(mapHostCharacterVm);
    return rows
      .filter((row) => row.name.toLowerCase().includes(q))
      .map(mapHostCharacterVm);
  }

  async uploadPortrait(file: File, options?: UploadPortraitOptions): Promise<string> {
    assertHost();
    const prepared = options?.alreadyOptimized
      ? file
      : await prepareCharacterPortraitFile(file, options?.signal);
    const published = await publishHostAsset(prepared);
    return published.url;
  }

  preparePortraitFile(file: File, signal?: AbortSignal): Promise<File> {
    return prepareCharacterPortraitFile(file, signal);
  }
}

export const characterService = new CharacterService();
