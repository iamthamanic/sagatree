/**
 * get_saga_overview use-case (RPC-SAGA-PROJECTIONS / #876).
 * Location: server/src/application/saga-projections/get_saga_overview/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function getSagaOverviewUseCase(saga: SagaPorts) {
  return (actor: Actor, publicId: string) => saga.getSagaOverview(actor, publicId);
}
