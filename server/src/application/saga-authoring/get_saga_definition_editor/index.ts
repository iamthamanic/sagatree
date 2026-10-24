/**
 * get_saga_definition_editor use-case — ensure draft for owner; native read-only (#871).
 * Location: server/src/application/saga-authoring/get_saga_definition_editor/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function getSagaDefinitionEditorUseCase(saga: SagaPorts) {
  return (actor: Actor, sagaId: string) => saga.getSagaDefinitionEditor(actor, sagaId);
}
