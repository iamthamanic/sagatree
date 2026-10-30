/**
 * Host-side Inventory v2 shape guard (mirrors FE isInventoryV2State).
 * Location: server/src/modules/inventory/internal/inventory-v2-shape.ts
 *
 * Manual validation — server has no zod dependency (same pattern as session-media-token).
 */
export const HOST_INVENTORY_V2_SCHEMA_VERSION = 1 as const;
export const HOST_BASE_SLOT_COUNT = 20 as const;
export const HOST_QUICK_SLOT_COUNT = 4 as const;

/**
 * Detect whether a payload is a usable Inventory v2 state before durable write.
 * Invalid payloads must be rejected — never flip schema_version=2 on garbage.
 */
export function isHostInventoryV2State(value: unknown): value is Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== HOST_INVENTORY_V2_SCHEMA_VERSION) return false;
  if (
    !candidate.instances ||
    typeof candidate.instances !== 'object' ||
    Array.isArray(candidate.instances)
  ) {
    return false;
  }
  if (
    !candidate.containers ||
    typeof candidate.containers !== 'object' ||
    Array.isArray(candidate.containers)
  ) {
    return false;
  }
  if (
    !candidate.equipment ||
    typeof candidate.equipment !== 'object' ||
    Array.isArray(candidate.equipment)
  ) {
    return false;
  }
  if (!Array.isArray(candidate.baseSlots) || candidate.baseSlots.length !== HOST_BASE_SLOT_COUNT) {
    return false;
  }
  if (
    !Array.isArray(candidate.quickSlots) ||
    candidate.quickSlots.length !== HOST_QUICK_SLOT_COUNT
  ) {
    return false;
  }
  if (!Array.isArray(candidate.legacyOverflow)) return false;

  for (const [instanceId, instance] of Object.entries(
    candidate.instances as Record<string, unknown>,
  )) {
    if (!instance || typeof instance !== 'object' || Array.isArray(instance)) return false;
    const row = instance as Record<string, unknown>;
    if (typeof row.instanceId !== 'string' || row.instanceId !== instanceId) return false;
    if (typeof row.definitionId !== 'string' || !row.definitionId) return false;
    if (!Number.isInteger(row.quantity) || (row.quantity as number) < 1) return false;
  }
  return true;
}

/** Collect definition ids referenced by a validated v2 state. */
export function collectDefinitionIds(state: Readonly<Record<string, unknown>>): readonly string[] {
  const instances = state.instances as Record<string, { definitionId: string }>;
  const ids = new Set<string>();
  for (const instance of Object.values(instances)) {
    if (instance.definitionId) ids.add(instance.definitionId);
  }
  return [...ids];
}
