/**
 * get_saga_definition_version use-case — published/authorized version with GM projection (#872).
 * Location: server/src/application/saga-version-read/get_saga_definition_version/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function getSagaDefinitionVersionUseCase(saga: SagaPorts) {
  return (actor: Actor, versionId: string) => saga.getSagaDefinitionVersion(actor, versionId);
}
