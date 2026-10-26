/**
 * upsert_world_atlas_map use-case (RPC-ATLAS-MAPS / #862).
 * Location: server/src/application/world-atlas/upsert_world_atlas_map/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { UpsertWorldAtlasMapInput, WorldPorts } from '../../../modules/world/index.ts';

export function upsertWorldAtlasMapUseCase(world: WorldPorts) {
  return (actor: Actor, input: UpsertWorldAtlasMapInput) =>
    world.upsertWorldAtlasMap(actor, input);
}
