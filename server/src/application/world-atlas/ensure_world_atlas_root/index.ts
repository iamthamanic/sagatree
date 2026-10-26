/**
 * ensure_world_atlas_root use-case (RPC-ATLAS-MAPS / #862).
 * Location: server/src/application/world-atlas/ensure_world_atlas_root/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { WorldPorts } from '../../../modules/world/index.ts';

export function ensureWorldAtlasRootUseCase(world: WorldPorts) {
  return (actor: Actor, worldProfileId: string) =>
    world.ensureWorldAtlasRoot(actor, worldProfileId);
}
