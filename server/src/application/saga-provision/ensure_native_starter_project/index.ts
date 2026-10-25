/**
 * ensure_native_starter_project use-case (RPC-SAGA-PROVISION / #873).
 * Location: server/src/application/saga-provision/ensure_native_starter_project/index.ts
 *
 * Delegates create through create_project_from_saga_version semantics (initialAdventure).
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { ProjectPorts } from '../../../modules/project/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';
import type { WorldPorts } from '../../../modules/world/index.ts';
import { createProjectFromSagaVersionUseCase } from '../create_project_from_saga_version/index.ts';

const DEFAULT_SLUG = 'dornhain.whisper';

export function ensureNativeStarterProjectUseCase(deps: {
  readonly saga: SagaPorts;
  readonly project: ProjectPorts;
  readonly world: WorldPorts;
}) {
  const { saga, project, world } = deps;
  const create = createProjectFromSagaVersionUseCase({ saga, project, world });

  return (actor: Actor, slugRaw?: string | null) => {
    if (!actor?.actorId) return { ok: false as const, error: '42501' };

    const trimmed = typeof slugRaw === 'string' ? slugRaw.trim() : '';
    const slug = trimmed === '' ? DEFAULT_SLUG : trimmed;

    const native = saga.findLatestPublishedNativeBySlug(slug);
    if (!native.ok) return { ok: false as const, error: 'P0002' };

    const existing = project.findActiveGmProjectForSaga(actor.actorId, native.value.sagaId);
    if (existing.ok) {
      return {
        ok: true as const,
        value: {
          id: existing.value.id,
          publicId: existing.value.publicId,
          created: false,
          name: existing.value.title,
          sagaId: existing.value.sagaId,
          sagaVersionId: existing.value.sagaVersionId || native.value.versionId,
        },
      };
    }

    const created = create(actor, native.value.sagaId, native.value.versionId, native.value.title);
    if (!created.ok) return created;

    return {
      ok: true as const,
      value: {
        id: created.value.id,
        publicId: created.value.publicId,
        created: true,
        name: created.value.title,
        sagaId: created.value.sagaId,
        sagaVersionId: created.value.sagaVersionId,
      },
    };
  };
}