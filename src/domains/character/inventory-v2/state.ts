/**
 * inventory-v2 state helpers — shared, pure primitives for Inventory v2 (issue #106).
 * Single implementation of cloning, location lookup, stack identity, instance-id
 * allocation and load summation. `operations.ts` and `validation.ts` both build
 * on this module so the "exactly one physical location" rule exists once.
 * Location: src/domains/character/inventory-v2/state.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type {
  ContainerContentsMap,
  EquipmentSlot,
  InventoryLocation,
  InventoryPlacement,
  InventoryState,
  ItemDefinition,
  ItemDefinitionLookup,
  ItemInstance,
} from './types';
import {
  BASE_SLOT_COUNT,
  EQUIPMENT_SLOTS,
  HAND_SLOTS,
  INVENTORY_V2_SCHEMA_VERSION,
  QUICK_SLOT_COUNT,
} from './types';

/** An empty, valid inventory: 20 explicit empty base slots and 4 unassigned quick slots. */
export function createEmptyInventory(): InventoryState {
  return {
    schemaVersion: INVENTORY_V2_SCHEMA_VERSION,
    instances: {},
    baseSlots: Array.from({ length: BASE_SLOT_COUNT }, () => null),
    containers: {},
    equipment: {},
    quickSlots: Array.from({ length: QUICK_SLOT_COUNT }, () => null),
    legacyOverflow: [],
  };
}

/** Structural clone of inventory state. Plain JSON data only, so a shallow-per-level copy is enough. */
export function cloneInventory(state: InventoryState): InventoryState {
  const containers: ContainerContentsMap = {};
  for (const [containerId, positions] of Object.entries(state.containers)) {
    containers[containerId] = [...positions];
  }
  const instances: Record<string, ItemInstance> = {};
  for (const [instanceId, instance] of Object.entries(state.instances)) {
    instances[instanceId] = instance.state
      ? { ...instance, state: { ...instance.state } }
      : { ...instance };
  }
  return {
    schemaVersion: state.schemaVersion,
    instances,
    baseSlots: [...state.baseSlots],
    containers,
    equipment: { ...state.equipment },
    quickSlots: [...state.quickSlots],
    legacyOverflow: [...state.legacyOverflow],
  };
}

/**
 * Stable key for the stack-relevant part of an instance. Two instances merge
 * only when definition id AND this key match.
 */
export function stackStateKey(instance: ItemInstance): string {
  const state = instance.state;
  if (!state) return '';
  const keys = Object.keys(state).sort();
  if (keys.length === 0) return '';
  // A sorted list of [key, value] pairs rather than a `k=v|k=v` string: the
  // delimiter form is not injective for arbitrary values, so `{a: 'x|b=y'}` and
  // `{a: 'x', b: 'y'}` — or `{x: 1}` and `{x: '1'}` — would compare as the same
  // stack and let mergeStacks silently discard one of the two states.
  return JSON.stringify(keys.map((key) => [key, state[key]]));
}

/** Same definition and identical stack-relevant state. */
export function isSameStackFamily(a: ItemInstance, b: ItemInstance): boolean {
  return a.definitionId === b.definitionId && stackStateKey(a) === stackStateKey(b);
}

/**
 * Allocate an instance id that collides with neither the persisted state nor
 * ids reserved earlier in the same operation. Deterministic and pure — no
 * module-level counter, so reloading persisted state can never reissue an id.
 */
export function allocateInstanceId(state: InventoryState, reserved: Set<string>): string {
  let counter = Object.keys(state.instances).length + reserved.size + 1;
  let candidate = `inv2-${counter}`;
  while (state.instances[candidate] !== undefined || reserved.has(candidate)) {
    counter += 1;
    candidate = `inv2-${counter}`;
  }
  reserved.add(candidate);
  return candidate;
}

/**
 * Stack limit actually enforced for a definition.
 *
 * A container carries its own capacity positions, so one instance must mean one
 * container. A catalog author who sets `stackLimit > 1` on a container
 * definition (#108/#112) would otherwise produce a single instance of quantity
 * N sharing one capacity map — so containers are pinned to 1 here rather than
 * trusting the definition.
 */
export function effectiveStackLimit(definition: ItemDefinition): number {
  if (definition.type === 'container') return 1;
  if (!Number.isInteger(definition.stackLimit) || definition.stackLimit < 1) return 1;
  return definition.stackLimit;
}

/** Capacity positions a container definition provides (at least one). */
export function containerCapacityOf(definition: ItemDefinition): number {
  const declared = definition.containerCapacity;
  if (typeof declared !== 'number' || !Number.isInteger(declared) || declared < 1) return 1;
  return declared;
}

/** Is `index` a valid base-slot index (0 … BASE_SLOT_COUNT - 1)? */
export function isBaseSlotIndex(index: unknown): index is number {
  return (
    typeof index === 'number' &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < BASE_SLOT_COUNT
  );
}

/** Is `index` a valid quick-slot index? */
export function isQuickSlotIndex(index: unknown): index is number {
  return (
    typeof index === 'number' &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < QUICK_SLOT_COUNT
  );
}

/** Is `value` one of the eight named equipment slots? */
export function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return typeof value === 'string' && EQUIPMENT_SLOTS.includes(value as EquipmentSlot);
}

/**
 * The single physical location of an instance, or `null` when it is unplaced.
 * A two-handed instance reports `mainHand`; its `offHand` reference is the same
 * physical item, not a second location.
 */
export function findInstanceLocation(
  state: InventoryState,
  instanceId: string,
): InventoryLocation | null {
  const baseIndex = state.baseSlots.indexOf(instanceId);
  if (baseIndex !== -1) return { kind: 'base', slotIndex: baseIndex };

  for (const [containerInstanceId, positions] of Object.entries(state.containers)) {
    const positionIndex = positions.indexOf(instanceId);
    if (positionIndex !== -1) {
      return { kind: 'container', containerInstanceId, positionIndex };
    }
  }

  for (const slot of EQUIPMENT_SLOTS) {
    if (state.equipment[slot] === instanceId) return { kind: 'equipment', slot };
  }

  if (state.legacyOverflow.includes(instanceId)) return { kind: 'overflow' };
  return null;
}

/** Every placed instance with its physical location, each instance exactly once. */
export function listPlacements(state: InventoryState): InventoryPlacement[] {
  const placements: InventoryPlacement[] = [];
  const seen = new Set<string>();
  for (const instanceId of Object.keys(state.instances)) {
    const location = findInstanceLocation(state, instanceId);
    if (!location || seen.has(instanceId)) continue;
    seen.add(instanceId);
    placements.push({ instanceId, location });
  }
  return placements;
}

/** Every equipment slot currently referencing an instance (two-handed items yield both hands). */
export function equipmentSlotsOf(state: InventoryState, instanceId: string): EquipmentSlot[] {
  return EQUIPMENT_SLOTS.filter((slot) => state.equipment[slot] === instanceId);
}

/** Definition of an instance, or `undefined` when the catalog does not know it. */
export function definitionOf(
  state: InventoryState,
  instanceId: string,
  lookup: ItemDefinitionLookup,
): ItemDefinition | undefined {
  const instance = state.instances[instanceId];
  if (!instance) return undefined;
  return lookup(instance.definitionId);
}

/** Does the instance's definition mark it as a container? */
export function isContainerInstance(
  state: InventoryState,
  instanceId: string,
  lookup: ItemDefinitionLookup,
): boolean {
  return definitionOf(state, instanceId, lookup)?.type === 'container';
}

/** Does the container instance currently hold anything? */
export function containerHasContents(state: InventoryState, containerInstanceId: string): boolean {
  const positions = state.containers[containerInstanceId];
  return Boolean(positions?.some((reference) => reference !== null));
}

/** Base-slot indices that are explicitly empty, in ascending order. */
export function freeBaseSlotIndices(state: InventoryState): number[] {
  const indices: number[] = [];
  state.baseSlots.forEach((reference, index) => {
    if (reference === null) indices.push(index);
  });
  return indices;
}

/** Clear every quick-slot reference to an instance (remove / consume / moved-out-of-eligibility policy). */
export function clearQuickSlotReferences(state: InventoryState, instanceId: string): void {
  state.quickSlots = state.quickSlots.map((reference) =>
    reference === instanceId ? null : reference,
  );
}

/**
 * Remove every reference to an instance — base slots, container positions,
 * equipment (both hands for two-handed items), overflow and quick slots.
 * The instance record itself is left to the caller.
 */
export function clearAllReferences(state: InventoryState, instanceId: string): void {
  state.baseSlots = state.baseSlots.map((reference) =>
    reference === instanceId ? null : reference,
  );
  for (const [containerInstanceId, positions] of Object.entries(state.containers)) {
    state.containers[containerInstanceId] = positions.map((reference) =>
      reference === instanceId ? null : reference,
    );
  }
  for (const slot of EQUIPMENT_SLOTS) {
    if (state.equipment[slot] === instanceId) delete state.equipment[slot];
  }
  state.legacyOverflow = state.legacyOverflow.filter((reference) => reference !== instanceId);
  clearQuickSlotReferences(state, instanceId);
}

/**
 * Remove an instance from the character entirely: all references plus the
 * instance record, and its container capacity map when it was a container.
 * Contents of a removed container are removed with it — callers that must keep
 * the contents move them out first.
 */
export function deleteInstance(state: InventoryState, instanceId: string): void {
  const positions = state.containers[instanceId];
  if (positions) {
    delete state.containers[instanceId];
    for (const contained of positions) {
      if (contained !== null) deleteInstance(state, contained);
    }
  }
  clearAllReferences(state, instanceId);
  delete state.instances[instanceId];
}

/**
 * Total load across every physical location exactly once: base slots,
 * container contents, equipment and legacy overflow. Quantity multiplies unit
 * load; a two-handed instance referenced by both hands counts once.
 *
 * Instances whose definition the catalog cannot resolve contribute 0, because a
 * pure sum cannot invent a load. That is a corrupt-state case, not a valid
 * result: callers that display this number must also surface
 * `validateInventory`, which reports it as `UNKNOWN_DEFINITION`.
 */
export function calculateTotalLoad(state: InventoryState, lookup: ItemDefinitionLookup): number {
  const counted = new Set<string>();
  const references: (string | null)[] = [
    ...state.baseSlots,
    ...Object.values(state.containers).flat(),
    ...EQUIPMENT_SLOTS.map((slot) => state.equipment[slot] ?? null),
    ...state.legacyOverflow,
  ];

  let total = 0;
  for (const instanceId of references) {
    if (instanceId === null || counted.has(instanceId)) continue;
    counted.add(instanceId);
    const instance = state.instances[instanceId];
    if (!instance) continue;
    const definition = lookup(instance.definitionId);
    if (!definition) continue;
    total += definition.load * instance.quantity;
  }
  return total;
}

/**
 * Is this equipment reference pair a legitimate two-handed item rather than a
 * duplicate location? True only when both hand slots reference the same
 * two-handed instance.
 */
export function isTwoHandedHandPair(
  state: InventoryState,
  instanceId: string,
  lookup: ItemDefinitionLookup,
): boolean {
  const definition = definitionOf(state, instanceId, lookup);
  if (!definition?.twoHanded) return false;
  return HAND_SLOTS.every((slot) => state.equipment[slot] === instanceId);
}
