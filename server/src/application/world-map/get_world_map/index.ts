/**
 * get_world_map use-case (RPC-WORLD-MAP / #861).
 * Location: server/src/application/world-map/get_world_map/index.ts
 *
 * Safer successor: non-editors always get player pin filtering (not only when
 * p_player_view=true). Editors may request player view explicitly.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { WorldPorts } from '../../../modules/world/index.ts';

export function getWorldMapUseCase(world: WorldPorts) {
  return (actor: Actor, worldProfileId: string, playerView = false) =>
    world.getWorldMap(actor, worldProfileId, playerView);
}
