/**
 * promote_session_outcome_to_world use-case (RPC-SAGA-PROJECTIONS / #876).
 * Location: server/src/application/saga-projections/promote_session_outcome_to_world/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function promoteSessionOutcomeToWorldUseCase(saga: SagaPorts) {
  return (actor: Actor, sessionId: string, consequenceId: string) =>
    saga.promoteSessionOutcomeToWorld(actor, sessionId, consequenceId);
}
