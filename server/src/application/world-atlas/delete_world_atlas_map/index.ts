/**
 * delete_world_atlas_map use-case (ATL2-E01 / #1219).
 * Location: server/src/application/world-atlas/delete_world_atlas_map/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { WorldPorts } from '../../../modules/world/index.ts';

export function deleteWorldAtlasMapUseCase(world: WorldPorts) {
  return (actor: Actor, worldProfileId: string, mapId: string) =>
    world.deleteWorldAtlasMap(actor, worldProfileId, mapId);
}
