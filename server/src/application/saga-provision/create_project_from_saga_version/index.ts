/**
 * create_project_from_saga_version use-case (RPC-SAGA-PROVISION / #873).
 * Location: server/src/application/saga-provision/create_project_from_saga_version/index.ts
 *
 * Product decision (explicit): published origin=user sagas remain instantiable by any
 * authenticated actor (legacy parity). private_backfill stays owner-only.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { ProjectPorts } from '../../../modules/project/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';

export function createProjectFromSagaVersionUseCase(deps: {
  readonly saga: SagaPorts;
  readonly project: ProjectPorts;
}) {
  const { saga, project } = deps;

  return (
    actor: Actor,
    sagaId: string,
    versionId: string,
    name?: string | null,
  ) => {
    if (!actor?.actorId) return { ok: false as const, error: '42501' };

    const looked = saga.lookupPublishedVersionForProvision(sagaId, versionId);
    if (!looked.ok) return looked;

    const { origin, ownerUserId, title, synopsis, adventureRuntime } = looked.value;

    // Parity with 063_saga_definitions.sql: native + user open to authenticated;
    // other origins (private_backfill) require ownership.
    if (origin !== 'native' && origin !== 'user') {
      if (ownerUserId !== actor.actorId) {
        return { ok: false as const, error: '42501' };
      }
    }

    const trimmed = typeof name === 'string' ? name.trim() : '';
    const projectTitle = trimmed.length > 0 ? trimmed : `${title} · Gruppe`;

    return project.createFromSagaVersion(actor, {
      sagaId: looked.value.sagaId,
      sagaVersionId: looked.value.versionId,
      title: projectTitle,
      description: synopsis || null,
      adventureRuntime,
    });
  };
}
