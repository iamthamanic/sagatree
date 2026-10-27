/**
 * rename_world_node use-case (RPC-WORLD-CREATE / #864).
 * Location: server/src/application/world-create/rename_world_node/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { RenameWorldNodeInput, WorldPorts } from '../../../modules/world/index.ts';

export function renameWorldNodeUseCase(world: WorldPorts) {
  return (actor: Actor, input: RenameWorldNodeInput) => world.renameWorldNode(actor, input);
}
