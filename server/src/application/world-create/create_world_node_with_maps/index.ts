/**
 * create_world_node_with_maps use-case (RPC-WORLD-CREATE / #864).
 * Location: server/src/application/world-create/create_world_node_with_maps/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { CreateWorldNodeInput, WorldPorts } from '../../../modules/world/index.ts';

export function createWorldNodeWithMapsUseCase(world: WorldPorts) {
  return (actor: Actor, input: CreateWorldNodeInput) =>
    world.createWorldNodeWithMaps(actor, input);
}
