/**
 * list_saga_member_permission_state use-case (RPC-SAGA-GOVERNANCE / #875).
 * Location: server/src/application/saga-governance/list_saga_member_permission_state/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import {
  actorIdsForGovernance,
  type PermissionsPorts,
} from '../../../modules/permissions/index.ts';

export function listSagaMemberPermissionStateUseCase(deps: { readonly permissions: PermissionsPorts }) {
  return (actor: Actor, publicId: string) => {
    const store = deps.permissions.sagaGovernance;
    if (!store) return { ok: false as const, error: 'store-unavailable' };
    const ids = actorIdsForGovernance(actor);
    if (ids.length === 0) return { ok: false as const, error: 'not authenticated' };
    return store.listMemberPermissionState(ids, publicId);
  };
}
