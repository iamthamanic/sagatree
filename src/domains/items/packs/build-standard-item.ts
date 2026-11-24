/**
 * buildStandardItem — construct a read-only builtin-standard ItemDefinition.
 * Optionally snapshots mechanics from a Core archetype id (no runtime merge).
 * Location: src/domains/items/packs/build-standard-item.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type {
  EquipmentSlot,
  InventoryItemType,
  ItemCost,
  ItemLoad,
  ItemRequirements,
} from '../../character/inventory-v2/primitives';
import type { ItemDefinition } from '../definition';
import type {
  ItemCapability,
  ItemContext,
  ItemKindKey,
  ItemRole,
  ItemSettingTag,
  ItemTechLevel,
} from '../taxonomy';
import { CORE_MECHANIC_SNAPSHOTS } from './core-snapshots';

/** Authoring input for a builtin-standard catalog entry. */
export interface StandardItemInput {
  id: string;
  name: string;
  description: string;
  settingTags: readonly ItemSettingTag[];
  techLevel: ItemTechLevel;
  contexts?: readonly ItemContext[];
  capabilities?: readonly ItemCapability[];
  roles?: readonly ItemRole[];
  kindKey?: ItemKindKey;
  /** When set, mechanical fields are copied from CORE_MECHANIC_SNAPSHOTS. */
  basedOnDefinitionId?: string;
  /** Required when basedOnDefinitionId is absent (narrative-only item). */
  type?: InventoryItemType;
  load?: ItemLoad;
  cost?: ItemCost;
  stackLimit?: number;
  requirements?: ItemRequirements;
  equipSlots?: EquipmentSlot[];
  twoHanded?: boolean;
  containerCapacity?: number;
  damage?: string;
  damageType?: string;
  protection?: ItemDefinition['protection'];
  traits?: string[];
  /**
   * Static SVG slug under `/assets/items/{iconKey}.svg`.
   * Defaults to definition id with dots → hyphens (`builtin.fantasy.longsword` → `builtin-fantasy-longsword`).
   */
  iconKey?: string;
}

/**
 * `builtin.fantasy.longsword` → `builtin-fantasy-longsword` for public SVG path.
 */
export function builtinDefinitionIdToIconKey(definitionId: string): string {
  return definitionId.replace(/\./g, '-');
}

/**
 * Build a scope=core / origin=builtin-standard definition.
 * Throws at module load if basedOnDefinitionId is unknown — fail closed.
 */
export function buildStandardItem(input: StandardItemInput): ItemDefinition {
  const iconKey = input.iconKey ?? builtinDefinitionIdToIconKey(input.id);
  const basedOn = input.basedOnDefinitionId;
  if (basedOn !== undefined) {
    const snapshot = CORE_MECHANIC_SNAPSHOTS[basedOn];
    if (!snapshot) {
      throw new Error(`buildStandardItem: unknown Core snapshot ${basedOn} for ${input.id}`);
    }
    return {
      id: input.id,
      scope: 'core',
      origin: 'builtin-standard',
      basedOnDefinitionId: basedOn,
      name: input.name,
      description: input.description,
      type: snapshot.type,
      load: snapshot.load,
      cost: snapshot.cost,
      stackLimit: snapshot.stackLimit,
      requirements: snapshot.requirements,
      equipSlots: snapshot.equipSlots,
      twoHanded: snapshot.twoHanded,
      containerCapacity: snapshot.containerCapacity,
      damage: snapshot.damage,
      damageType: snapshot.damageType,
      protection: snapshot.protection,
      traits: snapshot.traits,
      iconKey,
      kindKey: input.kindKey,
      settingTags: [...input.settingTags],
      techLevel: input.techLevel,
      contexts: input.contexts ? [...input.contexts] : undefined,
      capabilities: input.capabilities ? [...input.capabilities] : undefined,
      roles: input.roles ? [...input.roles] : undefined,
    };
  }

  if (input.type === undefined || input.load === undefined || input.cost === undefined) {
    throw new Error(
      `buildStandardItem: narrative item ${input.id} requires type, load, and cost`,
    );
  }

  return {
    id: input.id,
    scope: 'core',
    origin: 'builtin-standard',
    name: input.name,
    description: input.description,
    type: input.type,
    load: input.load,
    cost: input.cost,
    stackLimit: input.stackLimit ?? 1,
    requirements: input.requirements,
    equipSlots: input.equipSlots,
    twoHanded: input.twoHanded,
    containerCapacity: input.containerCapacity,
    damage: input.damage,
    damageType: input.damageType,
    protection: input.protection,
    traits: input.traits,
    iconKey,
    kindKey: input.kindKey,
    settingTags: [...input.settingTags],
    techLevel: input.techLevel,
    contexts: input.contexts ? [...input.contexts] : undefined,
    capabilities: input.capabilities ? [...input.capabilities] : undefined,
    roles: input.roles ? [...input.roles] : undefined,
  };
}
