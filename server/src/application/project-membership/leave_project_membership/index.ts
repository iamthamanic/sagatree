/**
 * leave_project_membership — voluntary leave of an active project membership (#1158).
 * Location: server/src/application/project-membership/leave_project_membership/index.ts
 *
 * Deletes the caller's active membership row (Postgres leave policy parity).
 * Does not transfer or clear project gm_user_id ownership.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { ProjectPorts } from '../../../modules/project/index.ts';

export function leaveProjectMembershipUseCase(deps: { readonly project: ProjectPorts }) {
  const { project } = deps;

  return (
    actor: Actor,
    projectIdRaw: string,
  ): { readonly ok: true } | { readonly ok: false; readonly error: string } => {
    if (!actor?.actorId) return { ok: false, error: '42501' };
    return project.leaveMembership({
      actorId: actor.actorId,
      projectId: typeof projectIdRaw === 'string' ? projectIdRaw : '',
    });
  };
}
