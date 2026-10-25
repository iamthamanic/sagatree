/**
 * save_world_map use-case (RPC-WORLD-MAP / #861).
 * Location: server/src/application/world-map/save_world_map/index.ts
 *
 * Product decision: expectedRevision NULL/negative bypasses CAS (legacy parity).
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { WorldPorts } from '../../../modules/world/index.ts';

export function saveWorldMapUseCase(world: WorldPorts) {
  return (
    actor: Actor,
    worldProfileId: string,
    expectedRevision: number | null,
    mapData: Record<string, unknown>,
  ) => world.saveWorldMap(actor, worldProfileId, expectedRevision, mapData);
}
