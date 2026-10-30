/**
 * host-inventory-adapter — Binds infra HostInventoryPorts to an injected host impl (MIG-303).
 * Location: src/infrastructure/inventory/host-inventory-adapter.ts
 *
 * Production UI still calls Supabase inventory facades. Dual-path seam only.
 */
import type { HostInventoryPorts } from './host-inventory-ports.contract';
import { HOST_INVENTORY_OPS } from './host-inventory-ports.contract';

export type HostInventoryAdapter = HostInventoryPorts & {
  readonly transport: 'host';
  readonly ops: typeof HOST_INVENTORY_OPS;
};

export function createHostInventoryAdapter(ports: HostInventoryPorts): HostInventoryAdapter {
  return {
    transport: 'host',
    ops: HOST_INVENTORY_OPS,
    getOwnedInventory: (actorId, characterId) => ports.getOwnedInventory(actorId, characterId),
    putOwnedInventory: (actorId, characterId, inventory) =>
      ports.putOwnedInventory(actorId, characterId, inventory),
    listCatalog: (actorId, options) => ports.listCatalog(actorId, options),
    createDefinition: (actorId, draft) => ports.createDefinition(actorId, draft),
  };
}
