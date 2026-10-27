/**
 * list_world_place_map_links use-case (RPC-WORLD-PLACES / #863).
 * Location: server/src/application/world-places/list_world_place_map_links/index.ts
 *
 * Successor fix: saga membership required before party projection (RPC-SEC-CROSS-SAGA-REVEAL).
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { WorldPorts } from '../../../modules/world/index.ts';

export function listWorldPlaceMapLinksUseCase(world: WorldPorts) {
  return (
    actor: Actor,
    worldProfileId: string,
    playerView = false,
    sagaPublicId: string | null = null,
  ) => world.listWorldPlaceMapLinks(actor, worldProfileId, playerView, sagaPublicId);
}
