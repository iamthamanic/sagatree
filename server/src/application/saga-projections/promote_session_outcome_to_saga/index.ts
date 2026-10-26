/**
 * promote_session_outcome_to_saga use-case (RPC-SAGA-PROJECTIONS / #876).
 * Location: server/src/application/saga-projections/promote_session_outcome_to_saga/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function promoteSessionOutcomeToSagaUseCase(saga: SagaPorts) {
  return (actor: Actor, sessionId: string, consequenceId: string) =>
    saga.promoteSessionOutcomeToSaga(actor, sessionId, consequenceId);
}
