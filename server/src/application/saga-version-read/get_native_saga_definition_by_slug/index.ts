/**
 * get_native_saga_definition_by_slug use-case — latest published native by slug (#872).
 * Location: server/src/application/saga-version-read/get_native_saga_definition_by_slug/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function getNativeSagaDefinitionBySlugUseCase(saga: SagaPorts) {
  return (actor: Actor, slug: string) => saga.getNativeSagaDefinitionBySlug(actor, slug);
}
