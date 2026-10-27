/**
 * delete_world_node use-case (RPC-WORLD-DESTRUCTIVE / #866).
 * Location: server/src/application/world-destructive/delete_world_node/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { DeleteWorldNodeInput, WorldPorts } from '../../../modules/world/index.ts';

export function deleteWorldNodeUseCase(world: WorldPorts) {
  return (actor: Actor, input: DeleteWorldNodeInput) => world.deleteWorldNode(actor, input);
}
