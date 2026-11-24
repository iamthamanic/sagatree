/**
 * Frozen mechanical snapshots of Core archetypes for builtin-standard items.
 * Values are copied at authoring time — no runtime merge with Core (#137).
 * Location: src/domains/items/packs/core-snapshots.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type {
  EquipmentSlot,
  InventoryItemType,
  ItemCost,
  ItemLoad,
  ItemMechanics,
  ItemRequirements,
} from '../../character/inventory-v2/primitives';

/** Mechanical fields copied from a Core archetype into a standard item. */
export interface CoreMechanicSnapshot extends ItemMechanics {
  type: InventoryItemType;
  load: ItemLoad;
  cost: ItemCost;
  stackLimit: number;
  requirements?: ItemRequirements;
  equipSlots?: EquipmentSlot[];
  twoHanded?: boolean;
  containerCapacity?: number;
}

/**
 * Snapshots keyed by Core definition id. Keep in sync with
 * `inventory-v2/core-catalog.ts` when Core mechanics change (new issue).
 */
export const CORE_MECHANIC_SNAPSHOTS: Readonly<Record<string, CoreMechanicSnapshot>> =
  Object.freeze({
    'core.weapon.light-melee': Object.freeze({
      type: 'weapon' as const,
      load: 1 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 1,
      equipSlots: ['mainHand', 'offHand'] as EquipmentSlot[],
      damage: 'd6+1',
      damageType: 'Kinetisch',
      traits: ['Finesse'],
    }),
    'core.weapon.standard-melee': Object.freeze({
      type: 'weapon' as const,
      load: 1 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
      equipSlots: ['mainHand', 'offHand'] as EquipmentSlot[],
      damage: 'd8+2',
      damageType: 'Kinetisch',
    }),
    'core.weapon.heavy-melee': Object.freeze({
      type: 'weapon' as const,
      load: 2 as ItemLoad,
      cost: 3 as ItemCost,
      stackLimit: 1,
      equipSlots: ['mainHand', 'offHand'] as EquipmentSlot[],
      twoHanded: true,
      damage: 'd10+3',
      damageType: 'Kinetisch',
    }),
    'core.weapon.reach-melee': Object.freeze({
      type: 'weapon' as const,
      load: 2 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
      equipSlots: ['mainHand', 'offHand'] as EquipmentSlot[],
      twoHanded: true,
      damage: 'd8+2',
      damageType: 'Kinetisch',
      traits: ['Reichweite'],
    }),
    'core.weapon.light-ranged': Object.freeze({
      type: 'weapon' as const,
      load: 1 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
      equipSlots: ['mainHand', 'offHand'] as EquipmentSlot[],
      damage: 'd6+1',
      damageType: 'Kinetisch',
    }),
    'core.weapon.standard-ranged': Object.freeze({
      type: 'weapon' as const,
      load: 1 as ItemLoad,
      cost: 3 as ItemCost,
      stackLimit: 1,
      equipSlots: ['mainHand', 'offHand'] as EquipmentSlot[],
      damage: 'd8+2',
      damageType: 'Kinetisch',
    }),
    'core.weapon.heavy-ranged': Object.freeze({
      type: 'weapon' as const,
      load: 2 as ItemLoad,
      cost: 4 as ItemCost,
      stackLimit: 1,
      equipSlots: ['mainHand', 'offHand'] as EquipmentSlot[],
      twoHanded: true,
      damage: 'd10+3',
      damageType: 'Kinetisch',
    }),
    'core.weapon.armor-piercing': Object.freeze({
      type: 'weapon' as const,
      load: 2 as ItemLoad,
      cost: 4 as ItemCost,
      stackLimit: 1,
      equipSlots: ['mainHand', 'offHand'] as EquipmentSlot[],
      twoHanded: true,
      damage: 'd8+2',
      damageType: 'Kinetisch',
      traits: ['Durchdringung 1'],
    }),
    'core.armor.light': Object.freeze({
      type: 'armor' as const,
      load: 1 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
      equipSlots: ['body'] as EquipmentSlot[],
      protection: 1 as const,
      requirements: { minimumStrength: 1 as const },
    }),
    'core.armor.medium': Object.freeze({
      type: 'armor' as const,
      load: 2 as ItemLoad,
      cost: 3 as ItemCost,
      stackLimit: 1,
      equipSlots: ['body'] as EquipmentSlot[],
      protection: 2 as const,
      requirements: { minimumStrength: 2 as const },
    }),
    'core.armor.heavy': Object.freeze({
      type: 'armor' as const,
      load: 3 as ItemLoad,
      cost: 4 as ItemCost,
      stackLimit: 1,
      equipSlots: ['body'] as EquipmentSlot[],
      protection: 3 as const,
      requirements: { minimumStrength: 4 as const },
    }),
    'core.shield.standard': Object.freeze({
      type: 'shield' as const,
      load: 1 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
      equipSlots: ['mainHand', 'offHand'] as EquipmentSlot[],
      traits: ['+1 Verteidigung', '1 Hand'],
    }),
    'core.tool.medical': Object.freeze({
      type: 'tool' as const,
      load: 1 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
    }),
    'core.tool.repair': Object.freeze({
      type: 'tool' as const,
      load: 1 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
    }),
    'core.tool.precision': Object.freeze({
      type: 'tool' as const,
      load: 1 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
    }),
    'core.tool.survival': Object.freeze({
      type: 'tool' as const,
      load: 1 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
    }),
    'core.tool.climbing': Object.freeze({
      type: 'tool' as const,
      load: 2 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
    }),
    'core.tool.navigation': Object.freeze({
      type: 'tool' as const,
      load: 1 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
    }),
    'core.tool.research': Object.freeze({
      type: 'tool' as const,
      load: 1 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
    }),
    'core.tool.craft': Object.freeze({
      type: 'tool' as const,
      load: 2 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
    }),
    'core.consumable.medical': Object.freeze({
      type: 'consumable' as const,
      load: 0 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 5,
    }),
    'core.consumable.repair': Object.freeze({
      type: 'consumable' as const,
      load: 0 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 5,
    }),
    'core.consumable.ration': Object.freeze({
      type: 'consumable' as const,
      load: 0 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 5,
    }),
    'core.consumable.energy': Object.freeze({
      type: 'consumable' as const,
      load: 0 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 5,
    }),
    'core.consumable.general': Object.freeze({
      type: 'consumable' as const,
      load: 0 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 5,
    }),
    'core.container.pouch': Object.freeze({
      type: 'container' as const,
      load: 0 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 1,
      containerCapacity: 2,
    }),
    'core.container.bag': Object.freeze({
      type: 'container' as const,
      load: 1 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 1,
      containerCapacity: 4,
    }),
    'core.container.backpack': Object.freeze({
      type: 'container' as const,
      load: 1 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
      containerCapacity: 6,
    }),
    'core.container.transport': Object.freeze({
      type: 'container' as const,
      load: 2 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
      containerCapacity: 10,
    }),
    'core.misc.light-source': Object.freeze({
      type: 'misc' as const,
      load: 0 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 3,
    }),
    'core.misc.rope': Object.freeze({
      type: 'misc' as const,
      load: 1 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 2,
    }),
    'core.misc.documentation': Object.freeze({
      type: 'misc' as const,
      load: 0 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 3,
    }),
    'core.misc.communicator': Object.freeze({
      type: 'misc' as const,
      load: 0 as ItemLoad,
      cost: 2 as ItemCost,
      stackLimit: 1,
      equipSlots: ['accessory1', 'accessory2'] as EquipmentSlot[],
    }),
    'core.misc.headgear': Object.freeze({
      type: 'misc' as const,
      load: 1 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 1,
      equipSlots: ['head'] as EquipmentSlot[],
    }),
    'core.misc.special-device': Object.freeze({
      type: 'misc' as const,
      load: 1 as ItemLoad,
      cost: 3 as ItemCost,
      stackLimit: 1,
      equipSlots: ['special'] as EquipmentSlot[],
    }),
    'core.misc.footwear': Object.freeze({
      type: 'misc' as const,
      load: 1 as ItemLoad,
      cost: 1 as ItemCost,
      stackLimit: 1,
      equipSlots: ['feet'] as EquipmentSlot[],
    }),
  });
