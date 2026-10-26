/**
 * list_world_atlas_maps use-case (RPC-ATLAS-MAPS / #862).
 * Location: server/src/application/world-atlas/list_world_atlas_maps/index.ts
 *
 * Successor fix: saga membership required before party projection (RPC-SEC-CROSS-SAGA-REVEAL).
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { WorldPorts } from '../../../modules/world/index.ts';

export function listWorldAtlasMapsUseCase(world: WorldPorts) {
  return (
    actor: Actor,
    worldProfileId: string,
    playerView = false,
    sagaPublicId: string | null = null,
  ) => world.listWorldAtlasMaps(actor, worldProfileId, playerView, sagaPublicId);
}
