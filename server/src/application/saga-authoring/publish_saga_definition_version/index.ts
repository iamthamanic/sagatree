/**
 * publish_saga_definition_version use-case — revision-checked immutable publish (#871).
 * Location: server/src/application/saga-authoring/publish_saga_definition_version/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function publishSagaDefinitionVersionUseCase(saga: SagaPorts) {
  return (actor: Actor, sagaId: string, expectedRevision: number) =>
    saga.publishSagaDefinitionVersion(actor, sagaId, expectedRevision);
}
