/**
 * archive_world_node_subtree use-case (RPC-WORLD-DESTRUCTIVE / #866).
 * Location: server/src/application/world-destructive/archive_world_node_subtree/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { ArchiveWorldNodeSubtreeInput, WorldPorts } from '../../../modules/world/index.ts';

export function archiveWorldNodeSubtreeUseCase(world: WorldPorts) {
  return (actor: Actor, input: ArchiveWorldNodeSubtreeInput) =>
    world.archiveWorldNodeSubtree(actor, input);
}
