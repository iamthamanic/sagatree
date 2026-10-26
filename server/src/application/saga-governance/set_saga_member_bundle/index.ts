/**
 * set_saga_member_bundle use-case (RPC-SAGA-GOVERNANCE / #875).
 * Location: server/src/application/saga-governance/set_saga_member_bundle/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import {
  actorIdsForGovernance,
  type PermissionsPorts,
} from '../../../modules/permissions/index.ts';

export function setSagaMemberBundleUseCase(deps: { readonly permissions: PermissionsPorts }) {
  return (actor: Actor, projectId: string, memberId: string, bundleId: string) => {
    const store = deps.permissions.sagaGovernance;
    if (!store) return { ok: false as const, error: 'store-unavailable' };
    const ids = actorIdsForGovernance(actor);
    if (ids.length === 0) return { ok: false as const, error: 'not authenticated' };
    return store.setMemberBundle(ids, projectId, memberId, bundleId);
  };
}
