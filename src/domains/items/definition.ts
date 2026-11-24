/**
 * ItemDefinition — catalog definition owned by the items domain (#134).
 * Inventory v2 keeps ItemInstance / InventoryState and consumes definitions
 * via public re-exports.
 * Location: src/domains/items/definition.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type {
  EquipmentSlot,
  InventoryItemType,
  ItemCost,
  ItemDefinitionScope,
  ItemLoad,
  ItemMechanics,
  ItemRequirements,
} from '../character/inventory-v2/primitives';
import type {
  ItemCapability,
  ItemContext,
  ItemKindKey,
  ItemOrigin,
  ItemRole,
  ItemSettingTag,
  ItemTechLevel,
} from './taxonomy';

/**
 * Catalog definition of an item — shared and scope-owned. Instances reference a
 * definition by id; the definition never changes per character.
 *
 * InventoryItemType describes inventory behavior; semantic meaning lives in the
 * optional taxonomy fields (kindKey, settingTags, contexts, …).
 */
export interface ItemDefinition extends ItemMechanics {
  /** Stable catalog id, e.g. `core:shortsword`. */
  id: string;
  /**
   * Immutable public item id (IT-XXXXX). Persisted Personal/World rows get it
   * from the DB trigger; Core/builtin Library rows may carry a derived stable id.
   * Never stored inside the JSON payload.
   */
  publicId?: string;
  scope: ItemDefinitionScope;
  name: string;
  description: string;
  type: InventoryItemType;
  load: ItemLoad;
  cost: ItemCost;
  /** Maximum units per stack; `1` means non-stackable. */
  stackLimit: number;
  requirements?: ItemRequirements;
  /** Equipment positions this definition may occupy. Absent/empty = not equippable. */
  equipSlots?: EquipmentSlot[];
  /** A two-handed item is one instance occupying both hand references. */
  twoHanded?: boolean;
  /** Capacity positions of a container definition; required when `type === 'container'`. */
  containerCapacity?: number;
  /** Future-facing visual metadata. Library/Inventory use assetKey only — never model3d. */
  iconKey?: string;
  assetKey?: string;
  /** Optional Workbench 3D GLB key (`model3d:{uuid}`). Display-only; not used as thumbnail. */
  model3d?: string;

  /** Semantic kind — may diverge from `type` (e.g. kindKey=device with type=tool). */
  kindKey?: ItemKindKey;
  /** Setting filters/recommendations; not a usage ban. */
  settingTags?: ItemSettingTag[];
  techLevel?: ItemTechLevel;
  contexts?: ItemContext[];
  capabilities?: ItemCapability[];
  roles?: ItemRole[];
  /** Provenance; Core catalog normalizes to `core-archetype`. */
  origin?: ItemOrigin;
  /** Optional parent archetype id — reference only, no runtime inheritance. */
  basedOnDefinitionId?: string;
}
