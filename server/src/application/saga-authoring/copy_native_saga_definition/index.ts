/**
 * copy_native_saga_definition use-case — clone native published → user saga (#871).
 * Location: server/src/application/saga-authoring/copy_native_saga_definition/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function copyNativeSagaDefinitionUseCase(saga: SagaPorts) {
  return (actor: Actor, sourceSagaId: string) => saga.copyNativeSagaDefinition(actor, sourceSagaId);
}
