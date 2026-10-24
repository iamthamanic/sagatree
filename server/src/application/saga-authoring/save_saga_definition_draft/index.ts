/**
 * save_saga_definition_draft use-case — revision-checked owner draft save (#871).
 * Location: server/src/application/saga-authoring/save_saga_definition_draft/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function saveSagaDefinitionDraftUseCase(saga: SagaPorts) {
  return (
    actor: Actor,
    sagaId: string,
    payload: Record<string, unknown>,
    expectedRevision: number,
  ) => saga.saveSagaDefinitionDraft(actor, sagaId, payload, expectedRevision);
}
