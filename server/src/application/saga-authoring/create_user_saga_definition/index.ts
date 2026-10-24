/**
 * create_user_saga_definition use-case — owner-scoped user saga + draft (#871).
 * Location: server/src/application/saga-authoring/create_user_saga_definition/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function createUserSagaDefinitionUseCase(saga: SagaPorts) {
  return (actor: Actor, title: string, blurb = '') =>
    saga.createUserSagaDefinition(actor, title, blurb);
}
