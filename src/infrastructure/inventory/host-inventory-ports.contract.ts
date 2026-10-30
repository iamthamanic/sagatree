/**
 * Host-aligned inventory ports contract (MIG-303 / #802).
 * Location: src/infrastructure/inventory/host-inventory-ports.contract.ts
 *
 * Transport-free DTO mirror of `server/src/modules/inventory` infra ports.
 * Supabase facades remain live until cutover.
 */

export type HostInventoryResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string };

export type HostInventoryStateRecord = {
  readonly characterId: string;
  readonly schemaVersion: number;
  readonly inventory: Readonly<Record<string, unknown>>;
  readonly updatedAt: string;
};

export type HostInventoryDefinitionRecord = {
  readonly id: string;
  readonly publicId: string;
  readonly origin: 'standard' | 'personal' | 'world';
  readonly ownerUserId: string | null;
  readonly worldProfileId: string | null;
  readonly status: 'active' | 'archived';
  readonly name: string;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type HostInventoryDefinitionDraft = {
  readonly name?: unknown;
  readonly origin?: unknown;
  readonly worldProfileId?: unknown;
  readonly payload?: unknown;
};

export type HostInventoryPorts = {
  readonly getOwnedInventory: (
    actorId: string,
    characterId: string,
  ) => Promise<HostInventoryResult<HostInventoryStateRecord | null>>;
  readonly putOwnedInventory: (
    actorId: string,
    characterId: string,
    inventory: unknown,
  ) => Promise<HostInventoryResult<HostInventoryStateRecord>>;
  readonly listCatalog: (
    actorId: string,
    options?: { readonly worldProfileId?: string | null; readonly query?: string },
  ) => Promise<HostInventoryResult<readonly HostInventoryDefinitionRecord[]>>;
  readonly createDefinition: (
    actorId: string,
    draft: HostInventoryDefinitionDraft,
  ) => Promise<HostInventoryResult<HostInventoryDefinitionRecord>>;
};

export const HOST_INVENTORY_OPS = [
  'getOwnedInventory',
  'putOwnedInventory',
  'listCatalog',
  'createDefinition',
] as const;
