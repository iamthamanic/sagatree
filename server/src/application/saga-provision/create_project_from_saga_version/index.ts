/**
 * create_project_from_saga_version use-case (RPC-SAGA-PROVISION / #873).
 * Location: server/src/application/saga-provision/create_project_from_saga_version/index.ts
 *
 * Product decision (explicit): published origin=user sagas remain instantiable by any
 * authenticated actor (legacy parity). private_backfill stays owner-only (incl. linked solo).
 * Coordinates world.createOwnedWorld → project.createFromSagaVersion.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { ProjectPorts } from '../../../modules/project/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';
import type { WorldPorts } from '../../../modules/world/index.ts';

function actorOwnsOwner(
  actor: Actor,
  ownerUserId: string | null,
): boolean {
  if (!ownerUserId) return false;
  if (actor.actorId === ownerUserId) return true;
  if (actor.kind === 'remote-account' && actor.linkedSoloActorIds?.includes(ownerUserId)) {
    return true;
  }
  return false;
}

export function createProjectFromSagaVersionUseCase(deps: {
  readonly saga: SagaPorts;
  readonly project: ProjectPorts;
  readonly world: WorldPorts;
}) {
  const { saga, project, world } = deps;

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
    // other origins (private_backfill) require ownership (incl. linked solo).
    if (origin !== 'native' && origin !== 'user') {
      if (!actorOwnsOwner(actor, ownerUserId)) {
        return { ok: false as const, error: '42501' };
      }
    }

    const trimmed = typeof name === 'string' ? name.trim() : '';
    const projectTitle = trimmed.length > 0 ? trimmed : `${title} · Gruppe`;

    const ownedWorld = world.createOwnedWorld(actor, projectTitle);
    if (!ownedWorld.ok) {
      return { ok: false as const, error: ownedWorld.error === 'missing-actor' ? '42501' : 'P0001' };
    }

    return project.createFromSagaVersion(actor, {
      worldId: ownedWorld.value.id,
      sagaId: looked.value.sagaId,
      sagaVersionId: looked.value.versionId,
      title: projectTitle,
      description: synopsis || null,
      adventureRuntime,
    });
  };
}
