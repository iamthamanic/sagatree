/**
 * inventory-v2 validation — invariant validation and normalization (issue #106).
 * `validateInventory` reports every invariant violation without changing state.
 * `normalizeInventory` rebuilds a guaranteed-valid state under an explicit,
 * lossless repair policy: nothing is deleted, unplaceable items become visible
 * legacy overflow.
 * Location: src/domains/character/inventory-v2/validation.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type {
  ContainerContentsMap,
  EquipmentMap,
  EquipmentSlot,
  InventoryInvariantCode,
  InventoryInvariantFinding,
  InventoryNormalizationResult,
  InventoryState,
  InventoryValidationReport,
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
import {
  containerCapacityOf,
  createEmptyInventory,
  effectiveStackLimit,
  findInstanceLocation,
  isEquipmentSlot,
} from './state';

function finding(code: InventoryInvariantCode, detail: string): InventoryInvariantFinding {
  return { code, detail };
}

/** Is the value a usable stack quantity? */
function isValidQuantity(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

// ---------------------------------------------------------------------------
// Validation (read-only)
// ---------------------------------------------------------------------------

/**
 * Report every Inventory v2 invariant violation:
 *
 * 1. schema version, exactly 20 base slots and exactly 4 quick slots;
 * 2. equipment only in the seven named slots, with a declaring definition;
 * 3. no dangling references anywhere (base, container, equipment, quick, overflow);
 * 4. every instance placed exactly once — a two-handed item holding both hand
 *    references is one location, not a duplicate;
 * 5. container maps only for container instances, position count matching the
 *    definition capacity, and no container inside a container;
 * 6. quantities >= 1 and within the definition's stack limit;
 * 7. quick slots only reference base-grid or equipment instances;
 * 8. overflow instances are neither equipped, contained nor quick-slotted.
 */
export function validateInventory(
  state: InventoryState,
  lookup: ItemDefinitionLookup,
): InventoryValidationReport {
  const findings: InventoryInvariantFinding[] = [];

  if (state.schemaVersion !== INVENTORY_V2_SCHEMA_VERSION) {
    findings.push(
      finding('INVALID_SCHEMA_VERSION', `schemaVersion=${String(state.schemaVersion)}`),
    );
  }
  if (!Array.isArray(state.baseSlots) || state.baseSlots.length !== BASE_SLOT_COUNT) {
    findings.push(
      finding('INVALID_BASE_SLOT_COUNT', `baseSlots.length=${String(state.baseSlots?.length)}`),
    );
  }
  if (!Array.isArray(state.quickSlots) || state.quickSlots.length !== QUICK_SLOT_COUNT) {
    findings.push(
      finding('INVALID_QUICK_SLOT_COUNT', `quickSlots.length=${String(state.quickSlots?.length)}`),
    );
  }

  // Instance records: quantity and stack-limit conformance.
  for (const [instanceId, instance] of Object.entries(state.instances)) {
    if (instance.instanceId !== instanceId) {
      findings.push(finding('DANGLING_REFERENCE', `instances[${instanceId}].instanceId mismatch`));
    }
    if (!isValidQuantity(instance.quantity)) {
      findings.push(finding('INVALID_QUANTITY', `${instanceId}: quantity=${String(instance.quantity)}`));
      continue;
    }
    const definition = lookup(instance.definitionId);
    if (!definition) {
      findings.push(finding('UNKNOWN_DEFINITION', `${instanceId}: ${instance.definitionId}`));
      continue;
    }
    if (!Number.isInteger(definition.stackLimit) || definition.stackLimit < 1) {
      findings.push(finding('INVALID_STACK_LIMIT', `${definition.id}: ${String(definition.stackLimit)}`));
      continue;
    }
    const stackLimit = effectiveStackLimit(definition);
    if (instance.quantity > stackLimit) {
      findings.push(finding('INVALID_QUANTITY', `${instanceId}: ${instance.quantity} > ${stackLimit}`));
    }
    // Driven from the instances, not from `state.containers`: a container whose
    // capacity map is missing entirely would otherwise pass validation while
    // `moveIntoContainer` rejects it for having no positions.
    if (definition.type === 'container' && !Array.isArray(state.containers[instanceId])) {
      findings.push(finding('INVALID_CONTAINER_CAPACITY', `${instanceId}: keine Kapazitätsliste`));
    }
  }

  // Reference integrity + exactly-one-location.
  const locationCount = new Map<string, number>();
  const countLocation = (instanceId: string): void => {
    locationCount.set(instanceId, (locationCount.get(instanceId) ?? 0) + 1);
  };

  state.baseSlots.forEach((reference, index) => {
    if (reference === null) return;
    if (!state.instances[reference]) {
      findings.push(finding('DANGLING_REFERENCE', `baseSlots[${index}] → ${reference}`));
      return;
    }
    countLocation(reference);
  });

  for (const [containerInstanceId, positions] of Object.entries(state.containers)) {
    const containerInstance = state.instances[containerInstanceId];
    if (!containerInstance) {
      findings.push(finding('DANGLING_REFERENCE', `containers[${containerInstanceId}]`));
      continue;
    }
    const containerDefinition = lookup(containerInstance.definitionId);
    if (!containerDefinition || containerDefinition.type !== 'container') {
      findings.push(finding('INVALID_CONTAINER_CAPACITY', `${containerInstanceId} ist kein Behälter`));
      continue;
    }
    if (positions.length !== containerCapacityOf(containerDefinition)) {
      findings.push(
        finding(
          'INVALID_CONTAINER_CAPACITY',
          `${containerInstanceId}: ${positions.length} ≠ ${containerCapacityOf(containerDefinition)}`,
        ),
      );
    }
    positions.forEach((reference, positionIndex) => {
      if (reference === null) return;
      const contained = state.instances[reference];
      if (!contained) {
        findings.push(
          finding('DANGLING_REFERENCE', `containers[${containerInstanceId}][${positionIndex}] → ${reference}`),
        );
        return;
      }
      if (lookup(contained.definitionId)?.type === 'container') {
        findings.push(finding('CONTAINER_NESTING', `${reference} in ${containerInstanceId}`));
      }
      countLocation(reference);
    });
  }

  for (const key of Object.keys(state.equipment)) {
    if (!isEquipmentSlot(key)) {
      findings.push(finding('INVALID_EQUIPMENT_SLOT', key));
    }
  }
  for (const slot of EQUIPMENT_SLOTS) {
    const reference = state.equipment[slot];
    if (!reference) continue;
    const instance = state.instances[reference];
    if (!instance) {
      findings.push(finding('DANGLING_REFERENCE', `equipment.${slot} → ${reference}`));
      continue;
    }
    const definition = lookup(instance.definitionId);
    if (definition && !(definition.equipSlots ?? []).includes(slot)) {
      findings.push(finding('INCOMPATIBLE_EQUIPMENT', `${reference} in ${slot}`));
    }
    countLocation(reference);
  }

  // A two-handed item legitimately holds both hand references: discount one.
  for (const slot of HAND_SLOTS) {
    const reference = state.equipment[slot];
    if (!reference) continue;
    const instance = state.instances[reference];
    const definition = instance ? lookup(instance.definitionId) : undefined;
    if (!definition?.twoHanded) continue;
    const heldHands = HAND_SLOTS.filter((handSlot) => state.equipment[handSlot] === reference);
    if (heldHands.length === HAND_SLOTS.length && slot === HAND_SLOTS[1]) {
      locationCount.set(reference, (locationCount.get(reference) ?? 1) - 1);
    }
    if (heldHands.length !== HAND_SLOTS.length) {
      findings.push(
        finding('INVALID_TWO_HANDED_REFERENCE', `${reference}: belegt ${heldHands.join(', ')}`),
      );
    }
  }

  // A two-handed item occupies both hands wherever it is declared. A definition
  // listing a non-hand slot passes the equipSlots check above, so without this
  // the validator would accept a shape that equipItem and normalizeInventory
  // both reject.
  for (const slot of EQUIPMENT_SLOTS) {
    if ((HAND_SLOTS as readonly EquipmentSlot[]).includes(slot)) continue;
    const reference = state.equipment[slot];
    if (!reference) continue;
    const instance = state.instances[reference];
    const definition = instance ? lookup(instance.definitionId) : undefined;
    if (!definition?.twoHanded) continue;
    findings.push(
      finding('INVALID_TWO_HANDED_REFERENCE', `${reference} in ${slot} statt in beiden Händen`),
    );
  }

  const overflowSeen = new Set<string>();
  for (const reference of state.legacyOverflow) {
    if (!state.instances[reference]) {
      findings.push(finding('DANGLING_REFERENCE', `legacyOverflow → ${reference}`));
      continue;
    }
    if (overflowSeen.has(reference)) {
      findings.push(finding('DUPLICATE_LOCATION', `legacyOverflow → ${reference}`));
      continue;
    }
    overflowSeen.add(reference);
    countLocation(reference);
  }

  for (const [instanceId, count] of locationCount) {
    if (count > 1) {
      findings.push(finding('DUPLICATE_LOCATION', `${instanceId}: ${count} Orte`));
    }
  }
  for (const instanceId of Object.keys(state.instances)) {
    if (!locationCount.has(instanceId)) {
      findings.push(finding('UNPLACED_INSTANCE', instanceId));
    }
  }

  state.quickSlots.forEach((reference, index) => {
    if (reference === null) return;
    if (!state.instances[reference]) {
      findings.push(finding('DANGLING_REFERENCE', `quickSlots[${index}] → ${reference}`));
      return;
    }
    const location = findInstanceLocation(state, reference);
    if (!location || location.kind === 'container' || location.kind === 'overflow') {
      findings.push(finding('QUICK_SLOT_NOT_ELIGIBLE', `quickSlots[${index}] → ${reference}`));
    }
  });

  return { ok: findings.length === 0, findings };
}

// ---------------------------------------------------------------------------
// Normalization (repair)
// ---------------------------------------------------------------------------

/** Mutable working set while rebuilding a valid state. */
interface NormalizationContext {
  instances: Record<string, ItemInstance>;
  claimed: Set<string>;
  repairs: InventoryInvariantFinding[];
  unresolved: string[];
  lookup: ItemDefinitionLookup;
}

/** Definition of an instance in the working set. */
function definitionFor(
  context: NormalizationContext,
  instanceId: string,
): ItemDefinition | undefined {
  const instance = context.instances[instanceId];
  if (!instance) return undefined;
  return context.lookup(instance.definitionId);
}

/**
 * Sanitize instance records: drop malformed entries, clamp quantities to the
 * stack limit and spill the excess into extra instances so no unit is lost.
 */
function sanitizeInstances(
  raw: Record<string, ItemInstance> | undefined,
  context: NormalizationContext,
): string[] {
  const spilled: string[] = [];
  const entries = raw && typeof raw === 'object' ? Object.entries(raw) : [];

  for (const [key, candidate] of entries) {
    if (!candidate || typeof candidate !== 'object' || typeof candidate.definitionId !== 'string') {
      context.repairs.push(finding('DANGLING_REFERENCE', `instances[${key}] verworfen`));
      continue;
    }
    // Key by the record key, never by the embedded `instanceId`. Two records can
    // carry the same embedded id, and writing both under it would drop one — the
    // opposite of a lossless repair. The map key is unique by construction and is
    // also what baseSlots/containers/equipment/quickSlots reference.
    if (candidate.instanceId !== key) {
      context.repairs.push(
        finding('DANGLING_REFERENCE', `instances[${key}].instanceId=${String(candidate.instanceId)} → ${key}`),
      );
    }
    let quantity = candidate.quantity;
    if (!isValidQuantity(quantity)) {
      context.repairs.push(finding('INVALID_QUANTITY', `${key}: ${String(quantity)} → 1`));
      quantity = 1;
    }
    context.instances[key] = {
      instanceId: key,
      definitionId: candidate.definitionId,
      quantity,
      ...(candidate.state && typeof candidate.state === 'object' ? { state: { ...candidate.state } } : {}),
    };
  }

  // Split quantities above the stack limit into additional instances (lossless).
  let spillCounter = 0;
  for (const instanceId of Object.keys(context.instances)) {
    const instance = context.instances[instanceId];
    const definition = context.lookup(instance.definitionId);
    if (!definition) {
      // Kept, not dropped — but reported separately: normalization cannot invent
      // a definition, so listing this as a "repair" on every load would make an
      // unchanged state look freshly repaired forever.
      context.unresolved.push(instanceId);
      continue;
    }
    const stackLimit = effectiveStackLimit(definition);
    // Only a malformed declaration is a repair. Pinning a container to 1 is a
    // domain rule, so a valid `stackLimit > 1` on a container must stay silent —
    // otherwise loading a healthy save would report corruption on every read.
    if (!Number.isInteger(definition.stackLimit) || definition.stackLimit < 1) {
      context.repairs.push(finding('INVALID_STACK_LIMIT', `${definition.id} → ${stackLimit}`));
    }
    if (instance.quantity <= stackLimit) continue;

    context.repairs.push(
      finding('INVALID_QUANTITY', `${instanceId}: ${instance.quantity} > ${stackLimit} — Rest ausgelagert`),
    );
    let remaining = instance.quantity - stackLimit;
    context.instances[instanceId] = { ...instance, quantity: stackLimit };
    while (remaining > 0) {
      spillCounter += 1;
      let spillId = `${instanceId}-split${spillCounter}`;
      while (context.instances[spillId] !== undefined) {
        spillCounter += 1;
        spillId = `${instanceId}-split${spillCounter}`;
      }
      const take = Math.min(remaining, stackLimit);
      context.instances[spillId] = {
        instanceId: spillId,
        definitionId: instance.definitionId,
        quantity: take,
        ...(instance.state ? { state: { ...instance.state } } : {}),
      };
      spilled.push(spillId);
      remaining -= take;
    }
  }

  return spilled;
}

/** Claim non-hand equipment slots that hold a validly declaring instance. */
function normalizeEquipment(
  raw: EquipmentMap | undefined,
  context: NormalizationContext,
): EquipmentMap {
  const equipment: EquipmentMap = {};
  const source = raw && typeof raw === 'object' ? raw : {};

  for (const key of Object.keys(source)) {
    if (!isEquipmentSlot(key)) {
      context.repairs.push(finding('INVALID_EQUIPMENT_SLOT', key));
    }
  }

  const claimSlot = (slot: EquipmentSlot): void => {
    const reference = source[slot];
    if (typeof reference !== 'string' || !reference) return;
    if (!context.instances[reference]) {
      context.repairs.push(finding('DANGLING_REFERENCE', `equipment.${slot} → ${reference}`));
      return;
    }
    if (context.claimed.has(reference)) {
      context.repairs.push(finding('DUPLICATE_LOCATION', `equipment.${slot} → ${reference}`));
      return;
    }
    const definition = definitionFor(context, reference);
    if (!definition || !(definition.equipSlots ?? []).includes(slot)) {
      context.repairs.push(finding('INCOMPATIBLE_EQUIPMENT', `${reference} in ${slot}`));
      return;
    }
    if (definition.twoHanded && !HAND_SLOTS.includes(slot)) {
      context.repairs.push(
        finding('INCOMPATIBLE_EQUIPMENT', `${reference} ist zweihändig und passt nicht in ${slot}`),
      );
      return;
    }
    if (definition.twoHanded) return; // hand references are claimed as a pair below
    equipment[slot] = reference;
    context.claimed.add(reference);
  };

  for (const slot of EQUIPMENT_SLOTS) {
    if (HAND_SLOTS.includes(slot)) continue;
    claimSlot(slot);
  }

  // Hands: a two-handed instance must own both hand references or be unequipped.
  const handCandidates = HAND_SLOTS.map((slot) => ({ slot, reference: source[slot] }));
  const twoHanded = handCandidates.find(({ reference }) => {
    if (typeof reference !== 'string' || !reference) return false;
    if (context.claimed.has(reference)) return false;
    const definition = definitionFor(context, reference);
    return Boolean(definition?.twoHanded);
  });

  if (twoHanded && typeof twoHanded.reference === 'string') {
    const definition = definitionFor(context, twoHanded.reference);
    const declared = definition?.equipSlots ?? [];
    const declaresBothHands = HAND_SLOTS.every((slot) => declared.includes(slot));
    if (declaresBothHands) {
      for (const slot of HAND_SLOTS) {
        const displaced = source[slot];
        if (typeof displaced === 'string' && displaced && displaced !== twoHanded.reference) {
          context.repairs.push(
            finding('INVALID_TWO_HANDED_REFERENCE', `${displaced} von ${slot} verdrängt`),
          );
        }
        equipment[slot] = twoHanded.reference;
      }
      context.claimed.add(twoHanded.reference);
    } else {
      context.repairs.push(
        finding('INVALID_TWO_HANDED_REFERENCE', `${twoHanded.reference} deklariert nicht beide Hände`),
      );
    }
  } else {
    for (const slot of HAND_SLOTS) claimSlot(slot);
  }

  return equipment;
}

/** Rebuild base slots at their persisted index; entries beyond position 20 spill out. */
function normalizeBaseSlots(
  raw: (string | null)[] | undefined,
  context: NormalizationContext,
): { baseSlots: (string | null)[]; spilled: string[] } {
  const baseSlots: (string | null)[] = Array.from({ length: BASE_SLOT_COUNT }, () => null);
  const spilled: string[] = [];
  const source = Array.isArray(raw) ? raw : [];

  if (source.length !== BASE_SLOT_COUNT) {
    context.repairs.push(
      finding('INVALID_BASE_SLOT_COUNT', `${source.length} → ${BASE_SLOT_COUNT}`),
    );
  }

  source.forEach((reference, index) => {
    if (typeof reference !== 'string' || !reference) return;
    if (!context.instances[reference]) {
      context.repairs.push(finding('DANGLING_REFERENCE', `baseSlots[${index}] → ${reference}`));
      return;
    }
    if (context.claimed.has(reference)) {
      context.repairs.push(finding('DUPLICATE_LOCATION', `baseSlots[${index}] → ${reference}`));
      return;
    }
    if (index < BASE_SLOT_COUNT && baseSlots[index] === null) {
      baseSlots[index] = reference;
      context.claimed.add(reference);
      return;
    }
    // Spilled entries stay unclaimed so a later pass — or the relocation queue —
    // can still find them a single valid location.
    spilled.push(reference);
  });

  return { baseSlots, spilled };
}

/** Rebuild container maps at the declared capacity; nested containers and excess spill out. */
function normalizeContainers(
  raw: ContainerContentsMap | undefined,
  context: NormalizationContext,
): { containers: ContainerContentsMap; spilled: string[] } {
  const containers: ContainerContentsMap = {};
  const spilled: string[] = [];
  const source = raw && typeof raw === 'object' ? raw : {};

  // Every container instance gets a capacity map, whether or not one was persisted.
  for (const instanceId of Object.keys(context.instances)) {
    const definition = definitionFor(context, instanceId);
    if (definition?.type !== 'container') continue;
    containers[instanceId] = Array.from({ length: containerCapacityOf(definition) }, () => null);
  }

  for (const [containerInstanceId, positions] of Object.entries(source)) {
    const target = containers[containerInstanceId];
    if (!target) {
      context.repairs.push(
        finding('INVALID_CONTAINER_CAPACITY', `${containerInstanceId} ist kein Behälter`),
      );
      if (Array.isArray(positions)) {
        for (const reference of positions) {
          if (typeof reference === 'string' && reference && context.instances[reference]) {
            spilled.push(reference);
          }
        }
      }
      continue;
    }
    if (!Array.isArray(positions)) continue;
    if (positions.length !== target.length) {
      context.repairs.push(
        finding('INVALID_CONTAINER_CAPACITY', `${containerInstanceId}: ${positions.length} → ${target.length}`),
      );
    }

    let nextFree = 0;
    for (const reference of positions) {
      if (typeof reference !== 'string' || !reference) continue;
      if (!context.instances[reference]) {
        context.repairs.push(
          finding('DANGLING_REFERENCE', `containers[${containerInstanceId}] → ${reference}`),
        );
        continue;
      }
      if (context.claimed.has(reference)) {
        context.repairs.push(
          finding('DUPLICATE_LOCATION', `containers[${containerInstanceId}] → ${reference}`),
        );
        continue;
      }
      if (definitionFor(context, reference)?.type === 'container') {
        context.repairs.push(finding('CONTAINER_NESTING', `${reference} in ${containerInstanceId}`));
        continue;
      }
      if (nextFree >= target.length) {
        context.repairs.push(
          finding('INVALID_CONTAINER_CAPACITY', `${containerInstanceId} voll — ${reference} ausgelagert`),
        );
        spilled.push(reference);
        continue;
      }
      target[nextFree] = reference;
      nextFree += 1;
      context.claimed.add(reference);
    }
  }

  return { containers, spilled };
}

/**
 * Rebuild a guaranteed-valid inventory state from a possibly corrupt candidate.
 *
 * Repair policy (explicit and lossless — nothing is deleted):
 * - base slots are pinned to 20 positions and keep their persisted index;
 * - equipment is limited to the seven named slots holding a declaring
 *   definition; a half-equipped two-handed item is completed to both hand
 *   references and any other hand occupant is displaced;
 * - containers get exactly their declared capacity, hold no container, and
 *   excess contents are relocated;
 * - every instance ends up in exactly one location; whatever no longer fits the
 *   base grid becomes visible `legacyOverflow`;
 * - quantities above the stack limit are split into extra stacks;
 * - quick slots keep only base-grid or equipment references.
 *
 * Only repairs that were actually applied are reported, so normalization is
 * idempotent: re-running it on its own output returns an empty `repairs` list
 * and an unchanged state. Instances whose definition the catalog cannot resolve
 * are the one thing normalization cannot fix — they are kept and listed in
 * `unresolved`, and `validateInventory` keeps reporting them as
 * `UNKNOWN_DEFINITION` until the catalog supplies the definition.
 */
export function normalizeInventory(
  candidate: Partial<InventoryState> | undefined,
  lookup: ItemDefinitionLookup,
): InventoryNormalizationResult {
  if (!candidate || typeof candidate !== 'object') {
    return {
      state: createEmptyInventory(),
      repairs: [finding('INVALID_SCHEMA_VERSION', 'kein Zustand')],
      unresolved: [],
    };
  }

  const context: NormalizationContext = {
    instances: {},
    claimed: new Set<string>(),
    repairs: [],
    unresolved: [],
    lookup,
  };

  const quantitySpill = sanitizeInstances(candidate.instances, context);
  const equipment = normalizeEquipment(candidate.equipment, context);
  const base = normalizeBaseSlots(candidate.baseSlots, context);
  const containerResult = normalizeContainers(candidate.containers, context);

  const overflow: string[] = [];
  const pushOverflow = (instanceId: string): void => {
    if (!overflow.includes(instanceId)) overflow.push(instanceId);
  };

  for (const reference of Array.isArray(candidate.legacyOverflow) ? candidate.legacyOverflow : []) {
    if (typeof reference !== 'string' || !reference) continue;
    if (!context.instances[reference]) {
      context.repairs.push(finding('DANGLING_REFERENCE', `legacyOverflow → ${reference}`));
      continue;
    }
    if (context.claimed.has(reference)) {
      context.repairs.push(finding('DUPLICATE_LOCATION', `legacyOverflow → ${reference}`));
      continue;
    }
    context.claimed.add(reference);
    pushOverflow(reference);
  }

  // Relocate everything that lost its place, then anything never referenced.
  // The queue is deduplicated so an instance mentioned by several corrupt
  // references still ends up in exactly one location.
  const unplaced: string[] = [];
  const enqueue = (instanceId: string): void => {
    if (!context.instances[instanceId]) return;
    if (context.claimed.has(instanceId)) return;
    if (unplaced.includes(instanceId)) return;
    unplaced.push(instanceId);
  };
  for (const instanceId of base.spilled) enqueue(instanceId);
  for (const instanceId of containerResult.spilled) enqueue(instanceId);
  for (const instanceId of quantitySpill) enqueue(instanceId);
  for (const instanceId of Object.keys(context.instances)) enqueue(instanceId);

  for (const instanceId of unplaced) {
    context.claimed.add(instanceId);
    const freeIndex = base.baseSlots.indexOf(null);
    if (freeIndex !== -1) {
      base.baseSlots[freeIndex] = instanceId;
      context.repairs.push(finding('UNPLACED_INSTANCE', `${instanceId} → baseSlots[${freeIndex}]`));
      continue;
    }
    pushOverflow(instanceId);
    context.repairs.push(finding('UNPLACED_INSTANCE', `${instanceId} → legacyOverflow`));
  }

  const state: InventoryState = {
    schemaVersion: INVENTORY_V2_SCHEMA_VERSION,
    instances: context.instances,
    baseSlots: base.baseSlots,
    containers: containerResult.containers,
    equipment,
    quickSlots: Array.from({ length: QUICK_SLOT_COUNT }, () => null),
    legacyOverflow: overflow,
  };

  if (candidate.schemaVersion !== INVENTORY_V2_SCHEMA_VERSION) {
    context.repairs.push(
      finding('INVALID_SCHEMA_VERSION', `${String(candidate.schemaVersion)} → ${INVENTORY_V2_SCHEMA_VERSION}`),
    );
  }

  // Quick slots are re-applied last, against the final locations.
  const rawQuickSlots = Array.isArray(candidate.quickSlots) ? candidate.quickSlots : [];
  if (rawQuickSlots.length !== QUICK_SLOT_COUNT) {
    context.repairs.push(
      finding('INVALID_QUICK_SLOT_COUNT', `${rawQuickSlots.length} → ${QUICK_SLOT_COUNT}`),
    );
  }
  rawQuickSlots.slice(0, QUICK_SLOT_COUNT).forEach((reference, index) => {
    if (typeof reference !== 'string' || !reference) return;
    if (!state.instances[reference]) {
      context.repairs.push(finding('DANGLING_REFERENCE', `quickSlots[${index}] → ${reference}`));
      return;
    }
    const location = findInstanceLocation(state, reference);
    if (!location || location.kind === 'container' || location.kind === 'overflow') {
      context.repairs.push(finding('QUICK_SLOT_NOT_ELIGIBLE', `quickSlots[${index}] → ${reference}`));
      return;
    }
    state.quickSlots[index] = reference;
  });

  return { state, repairs: context.repairs, unresolved: context.unresolved };
}
