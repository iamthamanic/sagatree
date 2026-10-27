/**
 * preview_world_node_consequences use-case (RPC-WORLD-DESTRUCTIVE / #866).
 * Location: server/src/application/world-destructive/preview_world_node_consequences/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type {
  PreviewWorldNodeConsequencesInput,
  WorldPorts,
} from '../../../modules/world/index.ts';

export function previewWorldNodeConsequencesUseCase(world: WorldPorts) {
  return (actor: Actor, input: PreviewWorldNodeConsequencesInput) =>
    world.previewWorldNodeConsequences(actor, input);
}
