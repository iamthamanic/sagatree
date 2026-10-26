/**
 * create_project_session use-case (RPC-SESSION-LIFECYCLE / #868).
 * Location: server/src/application/session-lifecycle/create_project_session/index.ts
 *
 * Active GM/player member; scheduled status + adventure/knowledge world_state carry.
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { SessionPorts } from '../../../modules/session/index.ts';

export function createProjectSessionUseCase(session: SessionPorts) {
  return (
    actor: Actor,
    projectId: string,
    name?: string | null,
    notes?: string | null,
  ) => session.lifecycle.createProjectSession(actor, projectId, name ?? null, notes ?? null);
}
