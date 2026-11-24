/**
 * inventory-v2 operations — pure Inventory v2 domain operations (issue #106).
 * Add, move, split, merge, sort, container moves, equip/unequip, quick slots,
 * consume and remove. Every operation returns a new state or a typed error and
 * never mutates its input; a rule violation leaves the original state intact.
 * Location: src/domains/character/inventory-v2/operations.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type {
  EquipmentSlot,
  InventoryOperationError,
  InventoryOperationResult,
  InventoryState,
  ItemDefinition,
  ItemDefinitionLookup,
  ItemInstance,
} from './types';
import { EQUIPMENT_SLOTS, HAND_SLOTS, SORT_TYPE_ORDER } from './types';
import {
  allocateInstanceId,
  clearQuickSlotReferences,
  cloneInventory,
  containerHasContents,
  containerCapacityOf,
  deleteInstance,
  effectiveStackLimit,
  equipmentSlotsOf,
  findInstanceLocation,
  freeBaseSlotIndices,
  isBaseSlotIndex,
  isContainerInstance,
  isQuickSlotIndex,
  isSameStackFamily,
  stackStateKey,
} from './state';

// ---------------------------------------------------------------------------
// Result helpers
// ---------------------------------------------------------------------------

function succeed(state: InventoryState): InventoryOperationResult {
  return { ok: true, state };
}

function refuse(error: InventoryOperationError, reason: string): InventoryOperationResult {
  return { ok: false, error, reason };
}

// ---------------------------------------------------------------------------
// Stacking helpers
// ---------------------------------------------------------------------------

/**
 * Partial stacks that a freshly added unit of `definition` may top up: same
 * definition, no per-instance state, below the stack limit. Overflow stacks are
 * excluded — overflow is repair-only state.
 */
function toppableStacks(state: InventoryState, definition: ItemDefinition): ItemInstance[] {
  const stackLimit = effectiveStackLimit(definition);
  if (stackLimit <= 1) return [];
  const overflow = new Set(state.legacyOverflow);
  const references: (string | null)[] = [
    ...state.baseSlots,
    ...Object.values(state.containers).flat(),
    ...EQUIPMENT_SLOTS.map((slot) => state.equipment[slot] ?? null),
  ];

  const result: ItemInstance[] = [];
  const seen = new Set<string>();
  for (const instanceId of references) {
    if (instanceId === null || seen.has(instanceId) || overflow.has(instanceId)) continue;
    seen.add(instanceId);
    const instance = state.instances[instanceId];
    if (!instance) continue;
    if (instance.definitionId !== definition.id) continue;
    if (stackStateKey(instance) !== '') continue;
    if (instance.quantity >= stackLimit) continue;
    result.push(instance);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Add
// ---------------------------------------------------------------------------

/**
 * Add `quantity` units of a definition. Compatible existing partial stacks are
 * filled first, then new stacks are created in free base slots.
 *
 * Atomic: when the complete quantity does not fit, nothing is added. While
 * `legacyOverflow` is non-empty, creating a NEW base stack is blocked — topping
 * up an existing partial stack stays allowed.
 */
export function addItems(
  state: InventoryState,
  lookup: ItemDefinitionLookup,
  definitionId: string,
  quantity: number,
): InventoryOperationResult {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return refuse('INVALID_INPUT', `Ungültige Menge: ${String(quantity)}`);
  }
  const definition = lookup(definitionId);
  if (!definition) return refuse('UNKNOWN_DEFINITION', `Unbekannte Definition: ${definitionId}`);
  if (!Number.isInteger(definition.stackLimit) || definition.stackLimit < 1) {
    return refuse('INVALID_INPUT', `Ungültiges Stapellimit für ${definition.id}.`);
  }
  const stackLimit = effectiveStackLimit(definition);

  const partials = toppableStacks(state, definition);
  const topUpCapacity = partials.reduce(
    (sum, instance) => sum + (stackLimit - instance.quantity),
    0,
  );
  const freeSlots = freeBaseSlotIndices(state);

  if (quantity > topUpCapacity && state.legacyOverflow.length > 0) {
    return refuse(
      'OVERFLOW_NOT_EMPTY',
      'Legacy-Overflow ist nicht leer — neue Basis-Stapel sind blockiert.',
    );
  }
  const totalCapacity = topUpCapacity + freeSlots.length * stackLimit;
  if (quantity > totalCapacity) {
    return refuse(
      'BASE_SLOTS_FULL',
      `Nur ${totalCapacity} Einheit(en) von ${definition.name} passen — ${quantity} angefordert, kein Teil-Hinzufügen.`,
    );
  }

  const next = cloneInventory(state);
  const reserved = new Set<string>();
  let remaining = quantity;

  for (const partial of partials) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, stackLimit - partial.quantity);
    next.instances[partial.instanceId] = {
      ...next.instances[partial.instanceId],
      quantity: partial.quantity + take,
    };
    remaining -= take;
  }

  const availableSlots = [...freeSlots];
  while (remaining > 0) {
    const slotIndex = availableSlots.shift();
    if (slotIndex === undefined) {
      return refuse('BASE_SLOTS_FULL', 'Basis-Kapazität erschöpft — Aktion atomar blockiert.');
    }
    const instanceId = allocateInstanceId(next, reserved);
    const take = Math.min(remaining, stackLimit);
    next.instances[instanceId] = { instanceId, definitionId: definition.id, quantity: take };
    next.baseSlots[slotIndex] = instanceId;
    if (definition.type === 'container') {
      next.containers[instanceId] = Array.from(
        { length: containerCapacityOf(definition) },
        () => null,
      );
    }
    remaining -= take;
  }

  return succeed(next);
}

// ---------------------------------------------------------------------------
// Base grid: move, sort
// ---------------------------------------------------------------------------

/**
 * Reorder inside the base grid. Occupied target slots swap with the source;
 * empty targets are a plain move. Stacks are never merged or created here.
 */
export function moveBaseSlot(
  state: InventoryState,
  fromSlot: number,
  toSlot: number,
): InventoryOperationResult {
  if (!isBaseSlotIndex(fromSlot) || !isBaseSlotIndex(toSlot)) {
    return refuse('INVALID_INPUT', `Ungültiger Slot-Index: ${String(fromSlot)} → ${String(toSlot)}`);
  }
  if (state.baseSlots[fromSlot] === null) {
    return refuse('UNKNOWN_INSTANCE', `Quell-Slot ${fromSlot} ist leer.`);
  }
  const next = cloneInventory(state);
  const moving = next.baseSlots[fromSlot];
  next.baseSlots[fromSlot] = next.baseSlots[toSlot];
  next.baseSlots[toSlot] = moving;
  return succeed(next);
}

const nameCollator = new Intl.Collator('de-DE');

function typeRank(definition: ItemDefinition): number {
  const rank = SORT_TYPE_ORDER.indexOf(definition.type);
  return rank === -1 ? SORT_TYPE_ORDER.length : rank;
}

/**
 * Deterministic sort of the BASE grid only: type order, then localized name
 * (`de-DE`), then definition id as stable tie-breaker. Occupied entries are
 * compacted to the front and remaining positions become explicit `null`s.
 * Container, equipment and overflow positions are untouched, and stacks are
 * never merged.
 */
export function sortBaseGrid(
  state: InventoryState,
  lookup: ItemDefinitionLookup,
): InventoryOperationResult {
  const next = cloneInventory(state);
  const entries: { instanceId: string; definition: ItemDefinition | undefined }[] = [];
  for (const instanceId of next.baseSlots) {
    if (instanceId === null) continue;
    const instance = next.instances[instanceId];
    entries.push({
      instanceId,
      definition: instance ? lookup(instance.definitionId) : undefined,
    });
  }

  entries.sort((a, b) => {
    // Entries the catalog cannot resolve keep a stable position at the end.
    if (!a.definition || !b.definition) {
      if (a.definition) return -1;
      if (b.definition) return 1;
      return a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0;
    }
    const byType = typeRank(a.definition) - typeRank(b.definition);
    if (byType !== 0) return byType;
    const byName = nameCollator.compare(a.definition.name, b.definition.name);
    if (byName !== 0) return byName;
    if (a.definition.id !== b.definition.id) return a.definition.id < b.definition.id ? -1 : 1;
    return a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0;
  });

  for (let index = 0; index < next.baseSlots.length; index += 1) {
    next.baseSlots[index] = index < entries.length ? entries[index].instanceId : null;
  }
  return succeed(next);
}

// ---------------------------------------------------------------------------
// Stacks: split, merge
// ---------------------------------------------------------------------------

/** Destination of a stack split — a free base slot or a free container position. */
export type SplitDestination =
  | { kind: 'base'; slotIndex: number }
  | { kind: 'container'; containerInstanceId: string; positionIndex: number };

/**
 * Split a stack into a new instance carrying the same per-instance state.
 * Requires `0 < splitQuantity < source.quantity` and a free destination
 * position. Splitting into a base slot creates a new base stack and is
 * therefore blocked while `legacyOverflow` is non-empty.
 */
export function splitStack(
  state: InventoryState,
  lookup: ItemDefinitionLookup,
  sourceInstanceId: string,
  splitQuantity: number,
  destination: SplitDestination,
): InventoryOperationResult {
  if (!Number.isInteger(splitQuantity) || splitQuantity <= 0) {
    return refuse('INVALID_INPUT', `Ungültige Teilmenge: ${String(splitQuantity)}`);
  }
  const source = state.instances[sourceInstanceId];
  if (!source) return refuse('UNKNOWN_INSTANCE', `Unbekannte Instanz: ${sourceInstanceId}`);
  if (splitQuantity >= source.quantity) {
    return refuse(
      'INVALID_INPUT',
      `Teilmenge ${splitQuantity} muss kleiner als die Stapelgröße ${source.quantity} sein.`,
    );
  }
  const definition = lookup(source.definitionId);
  if (!definition) {
    return refuse('UNKNOWN_DEFINITION', `Unbekannte Definition: ${source.definitionId}`);
  }
  if (effectiveStackLimit(definition) <= 1) {
    return refuse('NOT_STACKABLE', `${definition.name} ist nicht stapelbar.`);
  }

  if (destination.kind === 'base') {
    if (!isBaseSlotIndex(destination.slotIndex)) {
      return refuse('INVALID_INPUT', `Ungültiger Basis-Slot: ${String(destination.slotIndex)}`);
    }
    if (state.baseSlots[destination.slotIndex] !== null) {
      return refuse('SLOT_OCCUPIED', `Basis-Slot ${destination.slotIndex} ist belegt.`);
    }
    if (state.legacyOverflow.length > 0) {
      return refuse(
        'OVERFLOW_NOT_EMPTY',
        'Legacy-Overflow ist nicht leer — neue Basis-Stapel sind blockiert.',
      );
    }
  } else {
    const positions = state.containers[destination.containerInstanceId];
    if (!positions) {
      return refuse(
        'NOT_A_CONTAINER',
        `Instanz ${destination.containerInstanceId} ist kein Behälter.`,
      );
    }
    if (
      !Number.isInteger(destination.positionIndex) ||
      destination.positionIndex < 0 ||
      destination.positionIndex >= positions.length
    ) {
      return refuse(
        'INVALID_INPUT',
        `Ungültige Behälter-Position: ${String(destination.positionIndex)}`,
      );
    }
    if (positions[destination.positionIndex] !== null) {
      return refuse('CONTAINER_FULL', `Behälter-Position ${destination.positionIndex} ist belegt.`);
    }
  }

  const next = cloneInventory(state);
  const newInstanceId = allocateInstanceId(next, new Set<string>());
  next.instances[newInstanceId] = {
    instanceId: newInstanceId,
    definitionId: source.definitionId,
    quantity: splitQuantity,
    ...(source.state ? { state: { ...source.state } } : {}),
  };
  next.instances[sourceInstanceId] = {
    ...next.instances[sourceInstanceId],
    quantity: source.quantity - splitQuantity,
  };
  if (destination.kind === 'base') {
    next.baseSlots[destination.slotIndex] = newInstanceId;
  } else {
    next.containers[destination.containerInstanceId][destination.positionIndex] = newInstanceId;
  }
  return succeed(next);
}

/**
 * Merge the source stack into the target stack. Requires the same definition
 * AND identical stack-relevant per-instance state, a stackable definition and
 * enough remaining target capacity. A container holding contents can never be
 * merged. The source instance and all its references are removed.
 */
export function mergeStacks(
  state: InventoryState,
  lookup: ItemDefinitionLookup,
  sourceInstanceId: string,
  targetInstanceId: string,
): InventoryOperationResult {
  if (sourceInstanceId === targetInstanceId) {
    return refuse('INVALID_INPUT', 'Quelle und Ziel sind identisch.');
  }
  const source = state.instances[sourceInstanceId];
  if (!source) return refuse('UNKNOWN_INSTANCE', `Unbekannte Instanz: ${sourceInstanceId}`);
  const target = state.instances[targetInstanceId];
  if (!target) return refuse('UNKNOWN_INSTANCE', `Unbekannte Instanz: ${targetInstanceId}`);
  const definition = lookup(target.definitionId);
  if (!definition) {
    return refuse('UNKNOWN_DEFINITION', `Unbekannte Definition: ${target.definitionId}`);
  }
  if (!isSameStackFamily(source, target)) {
    return refuse(
      'INCOMPATIBLE_STACK',
      'Definition oder Instanz-Zustand unterscheiden sich — kein Zusammenlegen.',
    );
  }
  const stackLimit = effectiveStackLimit(definition);
  if (stackLimit <= 1) {
    return refuse('NOT_STACKABLE', `${definition.name} ist nicht stapelbar.`);
  }
  const capacity = stackLimit - target.quantity;
  if (source.quantity > capacity) {
    return refuse(
      'STACK_LIMIT_REACHED',
      `Ziel-Stapel nimmt nur ${capacity} weitere Einheit(en) auf.`,
    );
  }
  if (containerHasContents(state, sourceInstanceId) || containerHasContents(state, targetInstanceId)) {
    return refuse('INCOMPATIBLE_STACK', 'Behälter mit Inhalt kann nicht zusammengelegt werden.');
  }

  const next = cloneInventory(state);
  next.instances[targetInstanceId] = {
    ...next.instances[targetInstanceId],
    quantity: target.quantity + source.quantity,
  };
  deleteInstance(next, sourceInstanceId);
  return succeed(next);
}

// ---------------------------------------------------------------------------
// Containers
// ---------------------------------------------------------------------------

/**
 * Move an instance from the base grid or equipment INTO a container position.
 * Container-in-container is forbidden, overflow instances must be recovered
 * into the base grid first, and quick-slot references to the moved instance are
 * cleared because container items are not quick-slot eligible.
 */
export function moveIntoContainer(
  state: InventoryState,
  lookup: ItemDefinitionLookup,
  instanceId: string,
  containerInstanceId: string,
  positionIndex: number,
): InventoryOperationResult {
  if (instanceId === containerInstanceId) {
    return refuse('INVALID_INPUT', 'Ein Behälter kann nicht in sich selbst verschoben werden.');
  }
  if (!state.instances[instanceId]) {
    return refuse('UNKNOWN_INSTANCE', `Unbekannte Instanz: ${instanceId}`);
  }
  if (!state.instances[containerInstanceId]) {
    return refuse('UNKNOWN_INSTANCE', `Unbekannter Behälter: ${containerInstanceId}`);
  }
  if (!isContainerInstance(state, containerInstanceId, lookup)) {
    return refuse('NOT_A_CONTAINER', `Instanz ${containerInstanceId} ist kein Behälter.`);
  }
  const positions = state.containers[containerInstanceId];
  if (!positions) {
    return refuse('NOT_A_CONTAINER', `Behälter ${containerInstanceId} hat keine Kapazitätspositionen.`);
  }
  if (!Number.isInteger(positionIndex) || positionIndex < 0 || positionIndex >= positions.length) {
    return refuse('INVALID_INPUT', `Ungültige Behälter-Position: ${String(positionIndex)}`);
  }
  if (positions[positionIndex] !== null) {
    return refuse('CONTAINER_FULL', `Behälter-Position ${positionIndex} ist belegt.`);
  }
  if (isContainerInstance(state, instanceId, lookup)) {
    return refuse('CONTAINER_NESTING_FORBIDDEN', 'Behälter-in-Behälter ist in V2 verboten.');
  }

  const location = findInstanceLocation(state, instanceId);
  if (!location) return refuse('UNKNOWN_INSTANCE', `Instanz ${instanceId} hat keinen physischen Ort.`);
  if (location.kind === 'overflow') {
    return refuse(
      'NOT_IN_BASE_INVENTORY',
      'Overflow-Instanzen müssen erst in ein freies Basis-Fach zurückgeholt werden.',
    );
  }
  if (location.kind === 'container') {
    return refuse('CONTAINER_NESTING_FORBIDDEN', 'Behälter-in-Behälter ist in V2 verboten.');
  }

  const next = cloneInventory(state);
  if (location.kind === 'base') next.baseSlots[location.slotIndex] = null;
  if (location.kind === 'equipment') {
    for (const slot of equipmentSlotsOf(next, instanceId)) delete next.equipment[slot];
  }
  next.containers[containerInstanceId][positionIndex] = instanceId;
  clearQuickSlotReferences(next, instanceId);
  return succeed(next);
}

/**
 * Move an instance OUT of a container into a free base slot. A valid target
 * location is required — the move is blocked atomically otherwise.
 */
export function moveOutOfContainer(
  state: InventoryState,
  instanceId: string,
  containerInstanceId: string,
  targetSlot: number,
): InventoryOperationResult {
  if (!isBaseSlotIndex(targetSlot)) {
    return refuse('INVALID_INPUT', `Ungültiger Ziel-Slot: ${String(targetSlot)}`);
  }
  const positions = state.containers[containerInstanceId];
  if (!positions) {
    return refuse('NOT_A_CONTAINER', `Instanz ${containerInstanceId} ist kein Behälter.`);
  }
  const positionIndex = positions.indexOf(instanceId);
  if (positionIndex === -1) {
    return refuse(
      'UNKNOWN_INSTANCE',
      `Instanz ${instanceId} liegt nicht in Behälter ${containerInstanceId}.`,
    );
  }
  if (state.baseSlots[targetSlot] !== null) {
    return refuse('SLOT_OCCUPIED', `Ziel-Slot ${targetSlot} ist belegt.`);
  }

  const next = cloneInventory(state);
  next.containers[containerInstanceId][positionIndex] = null;
  next.baseSlots[targetSlot] = instanceId;
  return succeed(next);
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

/**
 * Equip an instance from the base grid (or re-slot an already equipped one).
 *
 * - The definition must declare the requested slot; a two-handed item must be
 *   equipped to a hand slot and then occupies both hand references.
 * - `minimumStrength` blocks equipping only — ownership stays valid without it.
 * - Displaced occupants return to the base grid, which needs one free position
 *   per displaced instance (the vacated source position counts). If capacity is
 *   missing the whole action is blocked and the original state is preserved.
 * - Overflow and container instances must reach the base grid first.
 */
export function equipItem(
  state: InventoryState,
  lookup: ItemDefinitionLookup,
  instanceId: string,
  slot: EquipmentSlot,
  characterStrength: number,
): InventoryOperationResult {
  const instance = state.instances[instanceId];
  if (!instance) return refuse('UNKNOWN_INSTANCE', `Unbekannte Instanz: ${instanceId}`);
  const definition = lookup(instance.definitionId);
  if (!definition) {
    return refuse('UNKNOWN_DEFINITION', `Unbekannte Definition: ${instance.definitionId}`);
  }
  if (!EQUIPMENT_SLOTS.includes(slot)) {
    return refuse('INVALID_INPUT', `Unbekannter Ausrüstungs-Slot: ${String(slot)}`);
  }

  const location = findInstanceLocation(state, instanceId);
  if (!location) return refuse('UNKNOWN_INSTANCE', `Instanz ${instanceId} hat keinen physischen Ort.`);
  if (location.kind === 'overflow') {
    return refuse('NOT_IN_BASE_INVENTORY', 'Overflow-Instanzen können nicht ausgerüstet werden.');
  }
  if (location.kind === 'container') {
    return refuse(
      'NOT_IN_BASE_INVENTORY',
      'Instanzen in Behältern müssen erst ins Basis-Inventar verschoben werden.',
    );
  }

  const declared = definition.equipSlots ?? [];
  if (declared.length === 0) {
    return refuse('NOT_EQUIPPABLE', `${definition.name} ist nicht ausrüstbar.`);
  }
  // No silent retargeting: an invalid slot request is refused rather than
  // redirected to a different valid slot.
  if (!declared.includes(slot)) {
    return refuse('NOT_EQUIPPABLE', `${definition.name} deklariert den Slot ${slot} nicht.`);
  }
  const targetSlots: EquipmentSlot[] = definition.twoHanded ? [...HAND_SLOTS] : [slot];
  if (definition.twoHanded) {
    if (!HAND_SLOTS.includes(slot)) {
      return refuse(
        'NOT_EQUIPPABLE',
        `${definition.name} ist zweihändig und gehört in eine Hand, nicht in ${slot}.`,
      );
    }
    const missing = HAND_SLOTS.filter((handSlot) => !declared.includes(handSlot));
    if (missing.length > 0) {
      return refuse(
        'NOT_EQUIPPABLE',
        `${definition.name} ist zweihändig, deklariert aber ${missing.join(', ')} nicht.`,
      );
    }
  }
  const minimumStrength = definition.requirements?.minimumStrength;
  if (minimumStrength !== undefined && characterStrength < minimumStrength) {
    return refuse(
      'REQUIREMENT_NOT_MET',
      `Mindeststärke ${minimumStrength} nicht erfüllt — Besitz bleibt gültig, Ausrüsten blockiert.`,
    );
  }

  const next = cloneInventory(state);

  // 1. Vacate the source position so it can absorb a displaced occupant.
  if (location.kind === 'base') next.baseSlots[location.slotIndex] = null;
  for (const equippedSlot of equipmentSlotsOf(next, instanceId)) {
    delete next.equipment[equippedSlot];
  }

  // 2. Collect distinct displaced occupants and release all their hand references.
  const displaced: string[] = [];
  for (const targetSlot of targetSlots) {
    const occupant = next.equipment[targetSlot];
    if (occupant && occupant !== instanceId && !displaced.includes(occupant)) {
      displaced.push(occupant);
    }
  }
  for (const occupant of displaced) {
    for (const occupiedSlot of equipmentSlotsOf(next, occupant)) {
      delete next.equipment[occupiedSlot];
    }
  }

  // 3. Displacement needs one free base position per displaced instance.
  const available = freeBaseSlotIndices(next);
  if (displaced.length > available.length) {
    return refuse(
      'BASE_SLOTS_FULL',
      `Nicht genug freie Basis-Plätze für ${displaced.length} verdrängte(s) Item(s) — Aktion atomar blockiert.`,
    );
  }
  displaced.forEach((occupant, index) => {
    next.baseSlots[available[index]] = occupant;
  });

  for (const targetSlot of targetSlots) next.equipment[targetSlot] = instanceId;
  return succeed(next);
}

/**
 * Unequip a slot back into the base grid. One free base position is required —
 * a two-handed instance is still a single stack and needs exactly one. Blocked
 * atomically when the base grid is full.
 */
export function unequipItem(state: InventoryState, slot: EquipmentSlot): InventoryOperationResult {
  if (!EQUIPMENT_SLOTS.includes(slot)) {
    return refuse('INVALID_INPUT', `Unbekannter Ausrüstungs-Slot: ${String(slot)}`);
  }
  const instanceId = state.equipment[slot];
  if (!instanceId) return refuse('UNKNOWN_INSTANCE', `Ausrüstungs-Slot ${slot} ist leer.`);
  if (!state.instances[instanceId]) {
    return refuse('UNKNOWN_INSTANCE', `Ausrüstungs-Slot ${slot} verweist auf eine unbekannte Instanz.`);
  }
  const freeSlots = freeBaseSlotIndices(state);
  if (freeSlots.length === 0) {
    return refuse('BASE_SLOTS_FULL', 'Kein freies Basis-Fach — Ablegen blockiert.');
  }

  const next = cloneInventory(state);
  for (const equippedSlot of equipmentSlotsOf(next, instanceId)) {
    delete next.equipment[equippedSlot];
  }
  next.baseSlots[freeSlots[0]] = instanceId;
  return succeed(next);
}

// ---------------------------------------------------------------------------
// Quick access
// ---------------------------------------------------------------------------

/**
 * Assign a quick-slot reference. Eligible sources are the base grid and
 * equipment only; container and overflow instances are refused. No instance,
 * stack or slot is created — quick slots are pure references.
 */
export function assignQuickSlot(
  state: InventoryState,
  quickSlotIndex: number,
  instanceId: string,
): InventoryOperationResult {
  if (!isQuickSlotIndex(quickSlotIndex)) {
    return refuse('INVALID_INPUT', `Ungültiger Schnellzugriff-Index: ${String(quickSlotIndex)}`);
  }
  if (!state.instances[instanceId]) {
    return refuse('UNKNOWN_INSTANCE', `Unbekannte Instanz: ${instanceId}`);
  }
  const location = findInstanceLocation(state, instanceId);
  if (!location) return refuse('UNKNOWN_INSTANCE', `Instanz ${instanceId} hat keinen physischen Ort.`);
  if (location.kind === 'container' || location.kind === 'overflow') {
    return refuse(
      'NOT_QUICK_SLOT_ELIGIBLE',
      'Nur Gegenstände im Basis-Inventar oder in der Ausrüstung sind schnellzugriff-fähig.',
    );
  }

  const next = cloneInventory(state);
  next.quickSlots[quickSlotIndex] = instanceId;
  return succeed(next);
}

/** Clear one quick-slot reference. */
export function clearQuickSlot(
  state: InventoryState,
  quickSlotIndex: number,
): InventoryOperationResult {
  if (!isQuickSlotIndex(quickSlotIndex)) {
    return refuse('INVALID_INPUT', `Ungültiger Schnellzugriff-Index: ${String(quickSlotIndex)}`);
  }
  const next = cloneInventory(state);
  next.quickSlots[quickSlotIndex] = null;
  return succeed(next);
}

// ---------------------------------------------------------------------------
// Consume, remove, overflow recovery
// ---------------------------------------------------------------------------

/**
 * Consume one unit of a consumable. At quantity zero the instance is removed
 * and every reference to it — including quick slots — is cleaned up.
 */
export function consumeItem(
  state: InventoryState,
  lookup: ItemDefinitionLookup,
  instanceId: string,
): InventoryOperationResult {
  const instance = state.instances[instanceId];
  if (!instance) return refuse('UNKNOWN_INSTANCE', `Unbekannte Instanz: ${instanceId}`);
  const definition = lookup(instance.definitionId);
  if (!definition) {
    return refuse('UNKNOWN_DEFINITION', `Unbekannte Definition: ${instance.definitionId}`);
  }
  if (definition.type !== 'consumable') {
    return refuse('NOT_A_CONSUMABLE', `${definition.name} ist kein Verbrauchsgut.`);
  }

  const next = cloneInventory(state);
  if (instance.quantity <= 1) {
    deleteInstance(next, instanceId);
    return succeed(next);
  }
  next.instances[instanceId] = { ...next.instances[instanceId], quantity: instance.quantity - 1 };
  return succeed(next);
}

/**
 * Remove an instance from the character. No world/ground-loot object is
 * created. All physical and quick-slot references are cleaned up; removing a
 * container removes its contents with it.
 */
export function removeItem(state: InventoryState, instanceId: string): InventoryOperationResult {
  if (!state.instances[instanceId]) {
    return refuse('UNKNOWN_INSTANCE', `Unbekannte Instanz: ${instanceId}`);
  }
  const next = cloneInventory(state);
  deleteInstance(next, instanceId);
  return succeed(next);
}

/**
 * Overflow recovery: move a legacy-overflow instance into a free base slot.
 * This reduces overflow and is therefore allowed while overflow is non-empty.
 */
export function recoverOverflowInstance(
  state: InventoryState,
  instanceId: string,
  targetSlot: number,
): InventoryOperationResult {
  if (!isBaseSlotIndex(targetSlot)) {
    return refuse('INVALID_INPUT', `Ungültiger Ziel-Slot: ${String(targetSlot)}`);
  }
  const overflowIndex = state.legacyOverflow.indexOf(instanceId);
  if (overflowIndex === -1) {
    return refuse('UNKNOWN_INSTANCE', `Instanz ${instanceId} liegt nicht im Legacy-Overflow.`);
  }
  if (state.baseSlots[targetSlot] !== null) {
    return refuse('SLOT_OCCUPIED', `Ziel-Slot ${targetSlot} ist belegt.`);
  }

  const next = cloneInventory(state);
  next.legacyOverflow.splice(overflowIndex, 1);
  next.baseSlots[targetSlot] = instanceId;
  return succeed(next);
}
