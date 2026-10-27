/**
 * reparent_world_node use-case (RPC-WORLD-RESTRUCTURE / #865).
 * Location: server/src/application/world-restructure/reparent_world_node/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { ReparentWorldNodeInput, WorldPorts } from '../../../modules/world/index.ts';

export function reparentWorldNodeUseCase(world: WorldPorts) {
  return (actor: Actor, input: ReparentWorldNodeInput) => world.reparentWorldNode(actor, input);
}
