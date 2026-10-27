/**
 * upsert_world_place use-case (RPC-WORLD-PLACES / #863).
 * Location: server/src/application/world-places/upsert_world_place/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { UpsertWorldPlaceInput, WorldPorts } from '../../../modules/world/index.ts';

export function upsertWorldPlaceUseCase(world: WorldPorts) {
  return (actor: Actor, input: UpsertWorldPlaceInput) => world.upsertWorldPlace(actor, input);
}
