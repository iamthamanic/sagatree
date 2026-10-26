/**
 * get_world_atlas_map use-case (RPC-ATLAS-MAPS / #862).
 * Location: server/src/application/world-atlas/get_world_atlas_map/index.ts
 *
 * Three-parameter contract only (optional p_saga_public_id); no legacy two-arg overload.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { WorldPorts } from '../../../modules/world/index.ts';

export function getWorldAtlasMapUseCase(world: WorldPorts) {
  return (
    actor: Actor,
    mapId: string,
    playerView = false,
    sagaPublicId: string | null = null,
  ) => world.getWorldAtlasMap(actor, mapId, playerView, sagaPublicId);
}
