/**
 * duplicate_world_node use-case (RPC-WORLD-RESTRUCTURE / #865).
 * Location: server/src/application/world-restructure/duplicate_world_node/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { DuplicateWorldNodeInput, WorldPorts } from '../../../modules/world/index.ts';

export function duplicateWorldNodeUseCase(world: WorldPorts) {
  return (actor: Actor, input: DuplicateWorldNodeInput) => world.duplicateWorldNode(actor, input);
}
