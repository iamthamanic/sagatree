/**
 * Deny-by-default SagaTree Policy Service (GATE-01 / MIG-013).
 * Private — import only from permissions module public API / composition root.
 * Location: server/src/modules/permissions/internal/policy-service.ts
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type PolicyActor = {
  readonly actorId: string;
};

export type PolicyResource = {
  readonly worldId?: string;
  readonly projectId?: string;
  readonly sessionId?: string;
};

export type PolicyDecision = {
  readonly allow: boolean;
  readonly reason: string;
};

export type PolicyOp =
  | 'host.health.read'
  | 'host.ping.write'
  | 'world.edit'
  | 'session.gm'
  | 'player.project.read'
  | string;

type WorldRow = { id: string; owner_user_id: string };
type ProjectRow = { id: string; world_id: string; gm_user_id: string };
type MemberRow = { project_id: string; user_id: string; role: string; active: number };

function deny(reason: string): PolicyDecision {
  return { allow: false, reason };
}

function allow(reason: string): PolicyDecision {
  return { allow: true, reason };
}

export class PolicyService {
  readonly #db: HostDatabase | null;

  constructor(db: HostDatabase | null) {
    this.#db = db;
  }

  authorize(op: PolicyOp, actor: PolicyActor | null | undefined, resource: PolicyResource = {}): PolicyDecision {
    if (!actor || typeof actor.actorId !== 'string' || actor.actorId.length === 0) {
      return deny('missing-actor');
    }

    if (op === 'host.health.read') return allow('public-health');
    if (op === 'host.ping.write') return allow('solo-mutation');

    if (!this.#db) return deny('deny-by-default');

    switch (op) {
      case 'world.edit':
        return this.#authorizeWorldEdit(actor.actorId, resource);
      case 'session.gm':
        return this.#authorizeSessionGm(actor.actorId, resource);
      case 'player.project.read':
        return this.#authorizePlayerProjectRead(actor.actorId, resource);
      default:
        return deny('unknown-operation');
    }
  }

  #authorizeWorldEdit(actorId: string, resource: PolicyResource): PolicyDecision {
    const worldId = resource.worldId?.trim();
    if (!worldId) return deny('missing-world');

    const world = this.#db!.prepare(`SELECT id, owner_user_id FROM worlds WHERE id = ?`).get(worldId) as
      | WorldRow
      | undefined;
    if (!world) return deny('world-not-found');
    if (world.owner_user_id !== actorId) return deny('not-world-owner');
    return allow('world-owner');
  }

  #authorizeSessionGm(actorId: string, resource: PolicyResource): PolicyDecision {
    const projectId = resource.projectId?.trim();
    if (!projectId) return deny('missing-project');

    const project = this.#db!.prepare(`SELECT id, world_id, gm_user_id FROM projects WHERE id = ?`).get(projectId) as
      | ProjectRow
      | undefined;
    if (!project) return deny('project-not-found');

    const member = this.#db!.prepare(
      `SELECT project_id, user_id, role, active FROM project_members WHERE project_id = ? AND user_id = ?`,
    ).get(projectId, actorId) as MemberRow | undefined;

    if (!member || member.active !== 1) return deny('inactive-or-missing-membership');
    if (project.gm_user_id !== actorId || member.role !== 'gm') return deny('not-project-gm');
    return allow('project-gm');
  }

  #authorizePlayerProjectRead(actorId: string, resource: PolicyResource): PolicyDecision {
    const projectId = resource.projectId?.trim();
    if (!projectId) return deny('missing-project');

    const project = this.#db!.prepare(`SELECT id, world_id, gm_user_id FROM projects WHERE id = ?`).get(projectId) as
      | ProjectRow
      | undefined;
    if (!project) return deny('project-not-found');

    const world = this.#db!.prepare(`SELECT id, owner_user_id FROM worlds WHERE id = ?`).get(project.world_id) as
      | WorldRow
      | undefined;
    if (!world) return deny('world-not-found');

    if (world.owner_user_id === actorId) return allow('world-owner-read');

    const member = this.#db!.prepare(
      `SELECT project_id, user_id, role, active FROM project_members WHERE project_id = ? AND user_id = ?`,
    ).get(projectId, actorId) as MemberRow | undefined;

    if (!member || member.active !== 1) return deny('inactive-or-missing-membership');
    return allow('active-member-read');
  }
}
