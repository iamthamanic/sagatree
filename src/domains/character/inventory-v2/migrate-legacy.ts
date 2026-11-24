/**
 * Inventory v2 legacy migration (#109).
 *
 * Pure function: flat `ItemDto[]` → Inventory v2 state + Personal definition
 * drafts. No backend clients, no React. Persistence of the resulting drafts and the
 * versioned state lives under `src/infrastructure/**`.
 *
 * Location: src/domains/character/inventory-v2/migrate-legacy.ts
 */

import type { ItemDto } from '../domain/character.entity';
import { listCoreItemDefinitions } from './core-catalog';
import {
  BASE_SLOT_COUNT,
  INVENTORY_V2_SCHEMA_VERSION,
  QUICK_SLOT_COUNT,
  type InventoryItemType,
  type InventoryState,
  type ItemDefinition,
  type ItemInstance,
} from './types';
import { createEmptyInventory, effectiveStackLimit } from './state';

/** Draft for a Personal definition that migration needs the persistence layer to create. */
export interface MigratedPersonalDefinitionDraft {
  /** Temporary key used inside the migration result before a stable id is assigned. */
  fingerprint: string;
  name: string;
  description: string;
  type: InventoryItemType;
  load: ItemDefinition['load'];
  cost: ItemDefinition['cost'];
  stackLimit: number;
  damage?: string;
  damageType?: string;
  protection?: ItemDefinition['protection'];
  requirements?: ItemDefinition['requirements'];
  traits?: string[];
}

export interface LegacyMigrationResult {
  state: InventoryState;
  /** Unique Personal drafts that must exist before the state is marked v2. */
  personalDrafts: MigratedPersonalDefinitionDraft[];
  /**
   * Maps each temporary instance `definitionId` of the form `pending:<fingerprint>`
   * (or an already-resolved Core id) so the persistence layer can rewrite
   * pending references to stable `personal:<uuid>` ids after insert.
   */
  pendingDefinitionKeys: string[];
}

const LEGACY_TYPES = new Set<InventoryItemType>([
  'weapon',
  'armor',
  'shield',
  'tool',
  'consumable',
  'misc',
]);

/**
 * Migrate a flat legacy inventory into Inventory v2.
 *
 * Lossless: every unit is preserved. First 20 stacks fill the base grid; the
 * rest become `legacyOverflow`. Nothing is equipped, quick-slotted or placed
 * in a container. Idempotent when fed the same input: fingerprints and stack
 * splits are deterministic.
 */
export function migrateLegacyInventory(items: readonly ItemDto[] | null | undefined): LegacyMigrationResult {
  const state = createEmptyInventory();
  const draftsByFingerprint = new Map<string, MigratedPersonalDefinitionDraft>();
  const pendingDefinitionKeys: string[] = [];
  const core = listCoreItemDefinitions();

  let instanceCounter = 0;
  const stacks: { definitionId: string; quantity: number }[] = [];

  for (const raw of items ?? []) {
    if (!raw || typeof raw !== 'object') continue;
    const quantity = normalizeQuantity(raw.quantity);
    if (quantity < 1) continue;

    const resolved = resolveDefinition(raw, core, draftsByFingerprint);
    if (resolved.kind === 'pending') {
      if (!pendingDefinitionKeys.includes(resolved.definitionId)) {
        pendingDefinitionKeys.push(resolved.definitionId);
      }
    }

    const stackLimit = resolved.stackLimit;
    let remaining = quantity;
    while (remaining > 0) {
      const take = Math.min(remaining, stackLimit);
      stacks.push({ definitionId: resolved.definitionId, quantity: take });
      remaining -= take;
    }
  }

  stacks.forEach((stack, index) => {
    instanceCounter += 1;
    const instanceId = `mig-${instanceCounter}`;
    const instance: ItemInstance = {
      instanceId,
      definitionId: stack.definitionId,
      quantity: stack.quantity,
    };
    state.instances[instanceId] = instance;
    if (index < BASE_SLOT_COUNT) {
      state.baseSlots[index] = instanceId;
    } else {
      state.legacyOverflow.push(instanceId);
    }
  });

  return {
    state: {
      ...state,
      schemaVersion: INVENTORY_V2_SCHEMA_VERSION,
    },
    personalDrafts: Array.from(draftsByFingerprint.values()),
    pendingDefinitionKeys,
  };
}

/**
 * Rewrite `pending:<fingerprint>` definition ids in a migrated state to the
 * stable ids returned by the persistence layer after creating Personal drafts.
 * Pure: returns a new state.
 */
export function bindPendingDefinitions(
  state: InventoryState,
  fingerprintToStableId: ReadonlyMap<string, string>,
): InventoryState {
  const instances: Record<string, ItemInstance> = {};
  for (const [instanceId, instance] of Object.entries(state.instances)) {
    const bound = bindDefinitionId(instance.definitionId, fingerprintToStableId);
    instances[instanceId] = bound === instance.definitionId
      ? instance
      : { ...instance, definitionId: bound };
  }
  return { ...state, instances };
}

function bindDefinitionId(
  definitionId: string,
  fingerprintToStableId: ReadonlyMap<string, string>,
): string {
  if (!definitionId.startsWith('pending:')) return definitionId;
  const fingerprint = definitionId.slice('pending:'.length);
  return fingerprintToStableId.get(fingerprint) ?? definitionId;
}

function resolveDefinition(
  raw: ItemDto,
  core: readonly ItemDefinition[],
  draftsByFingerprint: Map<string, MigratedPersonalDefinitionDraft>,
): { kind: 'core' | 'pending'; definitionId: string; stackLimit: number } {
  const normalized = normalizeLegacyItem(raw);
  const coreMatch = core.find((definition) => matchesCore(definition, normalized));
  if (coreMatch) {
    return {
      kind: 'core',
      definitionId: coreMatch.id,
      stackLimit: effectiveStackLimit(coreMatch),
    };
  }

  const stackLimit = defaultPersonalStackLimit(normalized.type, normalized.quantity);
  const draft: MigratedPersonalDefinitionDraft = {
    fingerprint: '',
    name: normalized.name,
    description: normalized.description,
    type: normalized.type,
    load: normalized.load,
    cost: normalized.cost,
    stackLimit,
    ...(normalized.damage ? { damage: normalized.damage } : {}),
    ...(normalized.damageType ? { damageType: normalized.damageType } : {}),
    ...(normalized.protection ? { protection: normalized.protection } : {}),
    ...(normalized.minimumStrength
      ? { requirements: { minimumStrength: normalized.minimumStrength } }
      : {}),
    ...(normalized.traits.length > 0 ? { traits: [...normalized.traits] } : {}),
  };
  draft.fingerprint = fingerprintOf(draft);
  if (!draftsByFingerprint.has(draft.fingerprint)) {
    draftsByFingerprint.set(draft.fingerprint, draft);
  }
  return {
    kind: 'pending',
    definitionId: `pending:${draft.fingerprint}`,
    stackLimit,
  };
}

interface NormalizedLegacy {
  name: string;
  description: string;
  type: InventoryItemType;
  quantity: number;
  load: 0 | 1 | 2 | 3;
  cost: 0 | 1 | 2 | 3 | 4 | 5;
  damage?: string;
  damageType?: string;
  protection?: 1 | 2 | 3;
  minimumStrength?: 1 | 2 | 4;
  traits: string[];
}

function normalizeLegacyItem(raw: ItemDto): NormalizedLegacy {
  const type = LEGACY_TYPES.has(raw.type as InventoryItemType)
    ? (raw.type as InventoryItemType)
    : 'misc';
  const traits = Array.isArray(raw.traits)
    ? Array.from(new Set(raw.traits.filter((trait): trait is string => typeof trait === 'string' && trait.trim().length > 0).map((trait) => trait.trim()))).sort((a, b) => a.localeCompare(b, 'de'))
    : [];
  return {
    name: normalizeName(raw.name),
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    type,
    quantity: normalizeQuantity(raw.quantity),
    load: ([0, 1, 2, 3] as const).includes(raw.load as 0 | 1 | 2 | 3) ? (raw.load as 0 | 1 | 2 | 3) : 1,
    cost: ([0, 1, 2, 3, 4, 5] as const).includes(raw.cost as 0 | 1 | 2 | 3 | 4 | 5)
      ? (raw.cost as 0 | 1 | 2 | 3 | 4 | 5)
      : 0,
    damage: typeof raw.damage === 'string' && raw.damage.trim() ? raw.damage.trim() : undefined,
    damageType: typeof raw.damage_type === 'string' && raw.damage_type.trim()
      ? raw.damage_type.trim()
      : undefined,
    protection: ([1, 2, 3] as const).includes(raw.protection as 1 | 2 | 3)
      ? (raw.protection as 1 | 2 | 3)
      : undefined,
    minimumStrength: ([1, 2, 4] as const).includes(raw.minimum_strength as 1 | 2 | 4)
      ? (raw.minimum_strength as 1 | 2 | 4)
      : undefined,
    traits,
  };
}

function matchesCore(definition: ItemDefinition, legacy: NormalizedLegacy): boolean {
  if (normalizeName(definition.name) !== legacy.name) return false;
  if (definition.type !== legacy.type) return false;
  if (definition.load !== legacy.load) return false;
  if (definition.cost !== legacy.cost) return false;
  if ((definition.damage ?? undefined) !== legacy.damage) return false;
  if ((definition.damageType ?? undefined) !== legacy.damageType) return false;
  if ((definition.protection ?? undefined) !== legacy.protection) return false;
  if ((definition.requirements?.minimumStrength ?? undefined) !== legacy.minimumStrength) return false;
  const coreTraits = [...(definition.traits ?? [])].sort((a, b) => a.localeCompare(b, 'de'));
  if (JSON.stringify(coreTraits) !== JSON.stringify(legacy.traits)) return false;
  return true;
}

function fingerprintOf(draft: Omit<MigratedPersonalDefinitionDraft, 'fingerprint'>): string {
  return JSON.stringify([
    draft.name,
    draft.description,
    draft.type,
    draft.load,
    draft.cost,
    draft.stackLimit,
    draft.damage ?? null,
    draft.damageType ?? null,
    draft.protection ?? null,
    draft.requirements?.minimumStrength ?? null,
    draft.traits ?? [],
  ]);
}

function defaultPersonalStackLimit(type: InventoryItemType, quantity: number): number {
  if (type === 'consumable') return Math.min(99, Math.max(1, quantity));
  return 1;
}

function normalizeQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1;
  return Math.max(1, Math.round(value));
}

function normalizeName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Detect whether a persisted payload is a usable Inventory v2 state.
 * Invalid/missing payloads must fall back to the legacy reader with a log —
 * never silently overwrite a valid v2 state.
 */
export function isInventoryV2State(value: unknown): value is InventoryState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<InventoryState>;
  if (candidate.schemaVersion !== INVENTORY_V2_SCHEMA_VERSION) return false;
  if (!candidate.instances || typeof candidate.instances !== 'object' || Array.isArray(candidate.instances)) {
    return false;
  }
  if (!candidate.containers || typeof candidate.containers !== 'object' || Array.isArray(candidate.containers)) {
    return false;
  }
  if (!candidate.equipment || typeof candidate.equipment !== 'object' || Array.isArray(candidate.equipment)) {
    return false;
  }
  if (!Array.isArray(candidate.baseSlots) || candidate.baseSlots.length !== BASE_SLOT_COUNT) return false;
  if (!Array.isArray(candidate.quickSlots) || candidate.quickSlots.length !== QUICK_SLOT_COUNT) return false;
  if (!Array.isArray(candidate.legacyOverflow)) return false;

  for (const [instanceId, instance] of Object.entries(candidate.instances)) {
    if (!instance || typeof instance !== 'object') return false;
    if (typeof instance.instanceId !== 'string' || instance.instanceId !== instanceId) return false;
    if (typeof instance.definitionId !== 'string' || !instance.definitionId) return false;
    if (!Number.isInteger(instance.quantity) || instance.quantity < 1) return false;
  }
  return true;
}
