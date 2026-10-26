/**
 * permissions module public API — sole host policy entry (deny-by-default) + saga governance (#875).
 * Location: server/src/modules/permissions/index.ts
 */
import type { Actor } from '../identity/index.ts';
import type { HostDatabase } from '../../persistence/open-database.ts';
import type { ProjectPorts } from '../project/index.ts';
import {
  PolicyService,
  type PolicyDecision,
  type PolicyOp,
  type PolicyResource,
  type SagaAccessLookup,
} from './internal/policy-service.ts';
import { SagaGovernanceStore } from './internal/saga-governance-store.ts';

export type { PolicyDecision, PolicyOp, PolicyResource, SagaAccessLookup };

export type PermissionsPorts = {
  readonly authorize: (op: PolicyOp, actor: Actor, resource?: PolicyResource) => PolicyDecision;
  readonly sagaGovernance: SagaGovernanceStore | null;
};

export function createPermissionsPorts(
  db: HostDatabase | null = null,
  sagaAccess: SagaAccessLookup | null = null,
  project: ProjectPorts | null = null,
): PermissionsPorts {
  const policy = new PolicyService(db, sagaAccess);
  const sagaGovernance = db && project ? new SagaGovernanceStore(db, project) : null;
  return {
    authorize: (op, actor, resource = {}) =>
      policy.authorize(
        op,
        actor
          ? {
              actorId: actor.actorId,
              linkedSoloActorIds:
                actor.kind === 'remote-account' ? actor.linkedSoloActorIds : undefined,
            }
          : null,
        resource,
      ),
    sagaGovernance,
  };
}

/** Resolve primary + linked solo identities for governance ACL (#875 P2). */
export function actorIdsForGovernance(actor: Actor | null | undefined): readonly string[] {
  if (!actor?.actorId) return [];
  if (actor.kind === 'remote-account' && Array.isArray(actor.linkedSoloActorIds)) {
    return [actor.actorId, ...actor.linkedSoloActorIds.filter((id) => typeof id === 'string' && id.length > 0)];
  }
  return [actor.actorId];
}
