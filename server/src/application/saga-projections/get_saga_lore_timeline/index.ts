/**
 * get_saga_lore_timeline use-case (RPC-SAGA-PROJECTIONS / #876).
 * Location: server/src/application/saga-projections/get_saga_lore_timeline/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function getSagaLoreTimelineUseCase(saga: SagaPorts) {
  return (actor: Actor, publicId: string) => saga.getSagaLoreTimeline(actor, publicId);
}
