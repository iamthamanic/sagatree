/**
 * Deny-by-default SagaTree Policy Service (GATE-01 / MIG-013).
 * Private — import only from permissions module public API / composition root.
 * Location: server/src/modules/permissions/internal/policy-service.ts
 */
import type { HostDatabase } from '../../../persistence/open-database.ts';

export type PolicyActor = {
  readonly actorId: string;
  /** Explicit MIG-015 solo→remote links; never inferred from client claims. */
  readonly linkedSoloActorIds?: readonly string[];
};

/** Host-minted solo ids use the `solo-` prefix (see server/src/auth/solo). */
function isSoloOwnedId(ownerUserId: string): boolean {
  return ownerUserId.startsWith('solo-') && ownerUserId.length > 5;
}

function actorMatchesOwner(actor: PolicyActor, ownerUserId: string): boolean {
  if (actor.actorId === ownerUserId) return true;
  return actor.linkedSoloActorIds?.includes(ownerUserId) === true;
}

function denyForOwnerMismatch(actor: PolicyActor, ownerUserId: string, foreignReason: string): PolicyDecision {
  if (isSoloOwnedId(ownerUserId) && !actorMatchesOwner(actor, ownerUserId)) {
    return deny('ACCOUNT_LINK_REQUIRED');
  }
  return deny(foreignReason);
}

export type PolicyResource = {
  readonly worldId?: string;
  readonly projectId?: string;
  readonly sessionId?: string;
  readonly assetId?: string;
  readonly rulesetId?: string;
};

export type PolicyDecision = {
  readonly allow: boolean;
  readonly reason: string;
};

export type PolicyOp =
  | 'host.health.read'
  | 'host.ping.write'
  | 'world.read'
  | 'world.edit'
  | 'session.gm'
  | 'player.project.read'
  | 'asset.publish'
  | 'asset.read'
  | 'ruleset.read'
  | 'ruleset.write'
  | string;

type WorldRow = { id: string; owner_user_id: string };
type ProjectRow = { id: string; world_id: string; gm_user_id: string };
type MemberRow = { project_id: string; user_id: string; role: string; active: number };
type AssetRow = { id: string; owner_user_id: string; published: number };
type RulesetRow = {
  id: string;
  creator_user_id: string | null;
  is_official: number;
  is_public: number;
};

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
      case 'world.read':
        return this.#authorizeWorldOwner(actor, resource, 'world-owner-read');
      case 'world.edit':
        return this.#authorizeWorldOwner(actor, resource, 'world-owner');
      case 'session.gm':
        return this.#authorizeSessionGm(actor, resource);
      case 'player.project.read':
        return this.#authorizePlayerProjectRead(actor, resource);
      case 'asset.publish':
        // Publish always stores under the caller's actorId; presence is enough.
        return allow('asset-owner-publish');
      case 'asset.read':
        return this.#authorizeAssetOwner(actor, resource);
      case 'ruleset.read':
        return this.#authorizeRulesetRead(actor, resource);
      case 'ruleset.write':
        return this.#authorizeRulesetWrite(actor, resource);
      default:
        return deny('unknown-operation');
    }
  }

  #authorizeRulesetRead(actor: PolicyActor, resource: PolicyResource): PolicyDecision {
    const rulesetId = resource.rulesetId?.trim();
    if (!rulesetId) {
      // List/catalog read: any authenticated actor may load public/official + own customs.
      return allow('ruleset-catalog-read');
    }
    const row = this.#db!.prepare(
      `SELECT id, creator_user_id, is_official, is_public FROM rulesets WHERE id = ?`,
    ).get(rulesetId) as RulesetRow | undefined;
    if (!row) return deny('ruleset-not-found');
    if (row.is_official === 1 || row.is_public === 1) return allow('ruleset-public-read');
    if (row.creator_user_id && actorMatchesOwner(actor, row.creator_user_id)) {
      return allow('ruleset-owner-read');
    }
    return deny('not-ruleset-owner');
  }

  #authorizeRulesetWrite(actor: PolicyActor, resource: PolicyResource): PolicyDecision {
    const rulesetId = resource.rulesetId?.trim();
    if (!rulesetId) {
      // Create custom: authenticated actor becomes owner.
      return allow('ruleset-owner-create');
    }
    const row = this.#db!.prepare(
      `SELECT id, creator_user_id, is_official, is_public FROM rulesets WHERE id = ?`,
    ).get(rulesetId) as RulesetRow | undefined;
    if (!row) return deny('ruleset-not-found');
    if (row.is_official === 1) return deny('official-immutable');
    if (!row.creator_user_id) return deny('not-ruleset-owner');
    if (!actorMatchesOwner(actor, row.creator_user_id)) {
      return denyForOwnerMismatch(actor, row.creator_user_id, 'not-ruleset-owner');
    }
    return allow('ruleset-owner-write');
  }

  #authorizeAssetOwner(actor: PolicyActor, resource: PolicyResource): PolicyDecision {
    const assetId = resource.assetId?.trim();
    if (!assetId) return deny('missing-asset');

    const asset = this.#db!.prepare(
      `SELECT id, owner_user_id, published FROM assets WHERE id = ?`,
    ).get(assetId) as AssetRow | undefined;
    if (!asset || asset.published !== 1) return deny('asset-not-found');
    if (!actorMatchesOwner(actor, asset.owner_user_id)) {
      return denyForOwnerMismatch(actor, asset.owner_user_id, 'not-asset-owner');
    }
    return allow('asset-owner-read');
  }

  #authorizeWorldOwner(
    actor: PolicyActor,
    resource: PolicyResource,
    allowReason: string,
  ): PolicyDecision {
    const worldId = resource.worldId?.trim();
    if (!worldId) return deny('missing-world');

    const world = this.#db!.prepare(`SELECT id, owner_user_id FROM worlds WHERE id = ?`).get(worldId) as
      | WorldRow
      | undefined;
    if (!world) return deny('world-not-found');
    if (!actorMatchesOwner(actor, world.owner_user_id)) {
      return denyForOwnerMismatch(actor, world.owner_user_id, 'not-world-owner');
    }
    return allow(allowReason);
  }

  #authorizeSessionGm(actor: PolicyActor, resource: PolicyResource): PolicyDecision {
    const projectId = resource.projectId?.trim();
    if (!projectId) return deny('missing-project');

    const project = this.#db!.prepare(`SELECT id, world_id, gm_user_id FROM projects WHERE id = ?`).get(projectId) as
      | ProjectRow
      | undefined;
    if (!project) return deny('project-not-found');

    const member = this.#db!.prepare(
      `SELECT project_id, user_id, role, active FROM project_members WHERE project_id = ? AND user_id = ?`,
    ).get(projectId, actor.actorId) as MemberRow | undefined;

    if (!member || member.active !== 1) return deny('inactive-or-missing-membership');
    // Solo→remote link does not mint GM seats — membership + gm_user_id must match the remote actor.
    if (project.gm_user_id !== actor.actorId || member.role !== 'gm') return deny('not-project-gm');
    return allow('project-gm');
  }

  #authorizePlayerProjectRead(actor: PolicyActor, resource: PolicyResource): PolicyDecision {
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

    if (actorMatchesOwner(actor, world.owner_user_id)) return allow('world-owner-read');

    const member = this.#db!.prepare(
      `SELECT project_id, user_id, role, active FROM project_members WHERE project_id = ? AND user_id = ?`,
    ).get(projectId, actor.actorId) as MemberRow | undefined;

    if (!member || member.active !== 1) return deny('inactive-or-missing-membership');
    return allow('active-member-read');
  }
}
