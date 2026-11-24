/**
 * inventory-v2 types — Inventory v2 domain contracts (issue #106).
 * Item instances, slots, and operation results live here. ItemDefinition is
 * owned by `domains/items` (#134) and re-exported for compatibility.
 * Primitives (scopes, slots, mechanics) live in `./primitives` to avoid a
 * circular import with the items domain.
 * Location: src/domains/character/inventory-v2/types.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { EquipmentSlot } from './primitives';
import type { ItemDefinition } from '../../items/definition';

export type {
  EquipmentSlot,
  InventoryItemType,
  ItemCost,
  ItemDefinitionScope,
  ItemLoad,
  ItemMechanics,
  ItemProtection,
  ItemRequirements,
  MinimumStrength,
} from './primitives';

export {
  BASE_SLOT_COUNT,
  EQUIPMENT_SLOTS,
  HAND_SLOTS,
  INVENTORY_V2_SCHEMA_VERSION,
  QUICK_SLOT_COUNT,
  SORT_TYPE_ORDER,
} from './primitives';

export type { ItemDefinition } from '../../items/definition';

/**
 * Per-instance state that can genuinely differ between two instances of the
 * same definition (e.g. an engraving or a bound owner). Stack-relevant: two
 * instances with differing state never merge.
 */
export type ItemInstanceState = Record<string, string | number | boolean | null>;

/** A concrete item instance owned by a character. */
export interface ItemInstance {
  /** Unique within one character's inventory state. */
  instanceId: string;
  definitionId: string;
  /** Units in this stack; always >= 1. */
  quantity: number;
  /** Absent when the instance is a pure definition mirror. */
  state?: ItemInstanceState;
}

/**
 * The single physical location of an instance. A two-handed instance is
 * reported at `mainHand`; its `offHand` reference is not a second location.
 * Quick slots are references only and are never a physical location.
 */
export type InventoryLocation =
  | { kind: 'base'; slotIndex: number }
  | { kind: 'container'; containerInstanceId: string; positionIndex: number }
  | { kind: 'equipment'; slot: EquipmentSlot }
  | { kind: 'overflow' };

/** Container contents keyed by container instance id; values are ordered capacity positions (`null` = free). */
export type ContainerContentsMap = Record<string, (string | null)[]>;

/** Equipment references keyed by slot. A two-handed instance appears under both hand slots. */
export type EquipmentMap = Partial<Record<EquipmentSlot, string>>;

/** Character inventory state — the aggregate every Inventory v2 operation reads and returns. */
export interface InventoryState {
  schemaVersion: number;
  /** Instance records by instance id. */
  instances: Record<string, ItemInstance>;
  /** Exactly `BASE_SLOT_COUNT` ordered positions; `null` = explicitly empty. */
  baseSlots: (string | null)[];
  containers: ContainerContentsMap;
  equipment: EquipmentMap;
  /** Exactly `QUICK_SLOT_COUNT` ordered references; `null` = unassigned. */
  quickSlots: (string | null)[];
  /** Legacy overflow — read/repair only, counts toward load, nothing is ever deleted into it. */
  legacyOverflow: string[];
}

/** Why a pure operation refused to change state. Operations never throw on rule violations. */
export type InventoryOperationError =
  | 'INVALID_INPUT'
  | 'UNKNOWN_INSTANCE'
  | 'UNKNOWN_DEFINITION'
  | 'BASE_SLOTS_FULL'
  | 'SLOT_OCCUPIED'
  | 'NOT_STACKABLE'
  | 'STACK_LIMIT_REACHED'
  | 'INCOMPATIBLE_STACK'
  | 'NOT_A_CONTAINER'
  | 'CONTAINER_FULL'
  | 'CONTAINER_NESTING_FORBIDDEN'
  | 'NOT_IN_BASE_INVENTORY'
  | 'NOT_EQUIPPABLE'
  | 'REQUIREMENT_NOT_MET'
  | 'NOT_QUICK_SLOT_ELIGIBLE'
  | 'NOT_A_CONSUMABLE'
  | 'OVERFLOW_NOT_EMPTY';

/**
 * Result of a pure operation. Discriminated on `ok` so callers cannot read a
 * state that was never produced.
 */
export type InventoryOperationResult =
  | { ok: true; state: InventoryState }
  | { ok: false; error: InventoryOperationError; reason: string };

/**
 * Resolve a definition id to its definition. Implementations are provided by the
 * catalog layer (#107/#108); this contract stays pure and synchronous.
 */
export type ItemDefinitionLookup = (definitionId: string) => ItemDefinition | undefined;

/** An invariant violation found by validation, or a repair applied by normalization. */
export type InventoryInvariantCode =
  | 'INVALID_SCHEMA_VERSION'
  | 'INVALID_BASE_SLOT_COUNT'
  | 'INVALID_QUICK_SLOT_COUNT'
  | 'INVALID_EQUIPMENT_SLOT'
  | 'INVALID_QUANTITY'
  | 'INVALID_STACK_LIMIT'
  | 'INVALID_CONTAINER_CAPACITY'
  | 'DANGLING_REFERENCE'
  | 'DUPLICATE_LOCATION'
  | 'UNPLACED_INSTANCE'
  | 'UNKNOWN_DEFINITION'
  | 'CONTAINER_NESTING'
  | 'INCOMPATIBLE_EQUIPMENT'
  | 'INVALID_TWO_HANDED_REFERENCE'
  | 'QUICK_SLOT_NOT_ELIGIBLE';

/** A single invariant finding with the offending reference. */
export interface InventoryInvariantFinding {
  code: InventoryInvariantCode;
  /** Instance id, slot name or index that triggered the finding. */
  detail: string;
}

/** Validation verdict. `ok` is true exactly when `findings` is empty. */
export interface InventoryValidationReport {
  ok: boolean;
  findings: InventoryInvariantFinding[];
}

/**
 * Normalization outcome: a structurally valid state plus the repairs needed to
 * get there.
 *
 * `repairs` lists only changes that were actually applied, so re-normalizing an
 * already normalized state yields an empty list. Instances whose definition the
 * catalog cannot resolve are kept (normalization is lossless) but reported in
 * `unresolved` instead of `repairs` — the domain cannot invent a definition, so
 * this is a catalog problem for the caller to surface, not a repairable one.
 */
export interface InventoryNormalizationResult {
  state: InventoryState;
  repairs: InventoryInvariantFinding[];
  /** Instance ids kept in the state whose `definitionId` the catalog does not know. */
  unresolved: string[];
}

/** An instance together with its resolved physical location. */
export interface InventoryPlacement {
  instanceId: string;
  location: InventoryLocation;
}
