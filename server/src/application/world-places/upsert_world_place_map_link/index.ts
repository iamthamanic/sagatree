/**
 * upsert_world_place_map_link use-case (RPC-WORLD-PLACES / #863).
 * Location: server/src/application/world-places/upsert_world_place_map_link/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type {
  UpsertWorldPlaceMapLinkInput,
  WorldPorts,
} from '../../../modules/world/index.ts';

export function upsertWorldPlaceMapLinkUseCase(world: WorldPorts) {
  return (actor: Actor, input: UpsertWorldPlaceMapLinkInput) =>
    world.upsertWorldPlaceMapLink(actor, input);
}
