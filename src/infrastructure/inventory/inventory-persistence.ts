/**
 * inventory-persistence — read/write helpers for Inventory v2 on characters (#109, CUT-20).
 *
 * Persisted migration uses host Library character PATCH — no Supabase PostgREST.
 * Location: src/infrastructure/inventory/inventory-persistence.ts
 */
import type { ItemDto } from '../../domains/character/domain/character.entity';
import {
  bindPendingDefinitions,
  cloneInventory,
  isInventoryV2State,
  migrateLegacyInventory,
} from '../../domains/character/inventory-v2';
import type {
  InventoryState,
  LegacyMigrationResult,
  MigratedPersonalDefinitionDraft,
} from '../../domains/character/inventory-v2';
import type { ItemDefinitionWriteDraft } from '../../domains/items';
import { getAuthenticatedUserId } from '../../lib/authenticatedUser';
import {
  createHostLibraryItem,
  fetchHostLibraryCharacter,
  fetchHostLibraryItem,
  isHostLibraryEnabled,
  updateHostLibraryCharacter,
} from '../host/host-library-http';
import type { CharacterDto } from '../character/character.persistence';
import { toDefinitionPayload } from './item-catalog.persistence';
import { assertWritableInventoryV2 as catalogAssertWritableInventoryV2 } from './item-catalog-service';

export interface CharacterInventoryRead {
  state: InventoryState;
  authoritativeV2: boolean;
  legacyFallback: boolean;
}

export function readCharacterInventory(
  dto: Pick<CharacterDto, 'inventory' | 'inventory_v2' | 'inventory_schema_version'>,
): CharacterInventoryRead {
  if (dto.inventory_schema_version === 2 && isInventoryV2State(dto.inventory_v2)) {
    return {
      state: cloneInventory(dto.inventory_v2),
      authoritativeV2: true,
      legacyFallback: false,
    };
  }

  if (dto.inventory_schema_version === 2) {
    console.warn(
      '[inventory-v2] inventory_schema_version=2 but inventory_v2 payload is invalid; falling back to legacy ItemDto[] without overwriting.',
    );
  }

  const migrated = migrateLegacyInventory(dto.inventory as ItemDto[] | undefined);
  return {
    state: migrated.state,
    authoritativeV2: false,
    legacyFallback: true,
  };
}

export async function assertWritableInventoryV2(
  state: unknown,
  characterId: string | null,
): Promise<InventoryState> {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }
  return catalogAssertWritableInventoryV2(state, characterId);
}

export async function persistMigratedInventory(
  characterId: string,
  migration: LegacyMigrationResult,
): Promise<InventoryState> {
  if (!isHostLibraryEnabled()) {
    throw new Error('Host-Anmeldung nicht konfiguriert (VITE_SAGATREE_HOST_AUTH_URL fehlt).');
  }

  const fingerprintToId = new Map<string, string>();
  for (const draft of migration.personalDrafts) {
    const stableId = await ensurePersonalDefinition(draft);
    fingerprintToId.set(draft.fingerprint, stableId);
  }

  const bound = bindPendingDefinitions(migration.state, fingerprintToId);

  const current = await fetchHostLibraryCharacter(characterId);
  const sheet = { ...(current.sheet ?? {}) } as Record<string, unknown>;
  const schemaVersion =
    typeof sheet.inventory_schema_version === 'number' ? sheet.inventory_schema_version : 1;
  if (schemaVersion !== 1) {
    throw new Error(
      'Inventar-Migration kollidierte mit einer anderen Speicherung. Bitte erneut versuchen.',
    );
  }

  const nextSheet = {
    ...sheet,
    inventory_v2: bound,
    inventory_schema_version: 2,
  };

  await updateHostLibraryCharacter(characterId, { sheet: nextSheet });

  return bound;
}

async function ensurePersonalDefinition(draft: MigratedPersonalDefinitionDraft): Promise<string> {
  const id = migrationDefinitionId(draft.fingerprint);
  const existing = await fetchHostLibraryItem(id);
  if (existing) return id;

  await getAuthenticatedUserId();
  const payload = toDefinitionPayload({
    ...toItemDefinitionDraft(draft),
    id,
    scope: 'personal',
  });

  const created = await createHostLibraryItem({
    name: draft.name,
    origin: 'personal',
    worldProfileId: null,
    payload,
  });
  if (!created || typeof created !== 'object') {
    throw new Error('Persönliche Definition konnte nicht angelegt werden.');
  }
  const row = created as Record<string, unknown>;
  const newId = typeof row.id === 'string' ? row.id : id;
  return newId;
}

export function migrationDefinitionId(fingerprint: string): string {
  return `personal:mig-${fnv1aHex(fingerprint, 32)}`;
}

function fnv1aHex(input: string, hexChars: number): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  let out = (hash >>> 0).toString(16).padStart(8, '0');
  hash = 2166136261 ^ hexChars;
  for (let index = input.length - 1; index >= 0; index -= 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
    out += (hash >>> 0).toString(16).padStart(8, '0');
  }
  return out.slice(0, hexChars);
}

function toItemDefinitionDraft(draft: MigratedPersonalDefinitionDraft): ItemDefinitionWriteDraft {
  return {
    name: draft.name,
    description: draft.description,
    type: draft.type,
    load: draft.load,
    cost: draft.cost,
    stackLimit: draft.stackLimit,
    ...(draft.damage ? { damage: draft.damage } : {}),
    ...(draft.damageType ? { damageType: draft.damageType } : {}),
    ...(draft.protection ? { protection: draft.protection } : {}),
    ...(draft.requirements ? { requirements: draft.requirements } : {}),
    ...(draft.traits ? { traits: draft.traits } : {}),
  };
}
