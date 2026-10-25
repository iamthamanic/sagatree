/**
 * duplicate_saga_playthrough use-case (RPC-SAGA-PROVISION / #873).
 * Location: server/src/application/saga-provision/duplicate_saga_playthrough/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { ProjectPorts } from '../../../modules/project/index.ts';
import type { SagaPorts } from '../../../modules/saga/index.ts';
import type { WorldPorts } from '../../../modules/world/index.ts';

export function duplicateSagaPlaythroughUseCase(deps: {
  readonly saga: SagaPorts;
  readonly project: ProjectPorts;
  readonly world: WorldPorts;
}) {
  const { saga, project, world } = deps;

  return (actor: Actor, projectId: string, modeRaw?: string | null) => {
    if (!actor?.actorId) return { ok: false as const, error: '42501' };

    const mode = String(modeRaw ?? 'fresh').trim().toLowerCase();
    if (mode !== 'fresh' && mode !== 'with_progress') {
      return { ok: false as const, error: '22023' };
    }

    const src = project.getProject(projectId);
    if (!src.ok) return { ok: false as const, error: 'P0002' };
    if (src.value.gmUserId !== actor.actorId) {
      return { ok: false as const, error: '42501' };
    }
    if (!src.value.sagaId || !src.value.sagaVersionId) {
      return { ok: false as const, error: '22023' };
    }

    const looked = saga.lookupPublishedVersionForProvision(
      src.value.sagaId,
      src.value.sagaVersionId,
    );
    if (!looked.ok) return looked;

    let adventureRuntime: Record<string, unknown> = {};
    if (mode === 'with_progress') {
      adventureRuntime = { ...src.value.adventureRuntime };
    } else {
      adventureRuntime = { ...looked.value.adventureRuntime };
    }

    let copyTitle = `${src.value.title} · Kopie`;
    if (copyTitle.length > 120) {
      copyTitle = `${src.value.title.slice(0, 110)} · Kopie`;
    }

    const ownedWorld = world.createOwnedWorld(actor, copyTitle);
    if (!ownedWorld.ok) {
      return { ok: false as const, error: ownedWorld.error === 'missing-actor' ? '42501' : 'P0001' };
    }

    const created = project.createFromSagaVersion(actor, {
      worldId: ownedWorld.value.id,
      sagaId: src.value.sagaId,
      sagaVersionId: src.value.sagaVersionId,
      title: copyTitle,
      description: src.value.description,
      adventureRuntime,
    });
    if (!created.ok) return created;
    return {
      ok: true as const,
      value: { id: created.value.id, publicId: created.value.publicId },
    };
  };
}
