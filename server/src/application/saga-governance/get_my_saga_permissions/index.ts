/**
 * get_my_saga_permissions use-case (RPC-SAGA-GOVERNANCE / #875).
 * Location: server/src/application/saga-governance/get_my_saga_permissions/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import {
  actorIdsForGovernance,
  type PermissionsPorts,
} from '../../../modules/permissions/index.ts';

export function getMySagaPermissionsUseCase(deps: { readonly permissions: PermissionsPorts }) {
  return (actor: Actor, publicId: string) => {
    const store = deps.permissions.sagaGovernance;
    if (!store) return { ok: false as const, error: 'store-unavailable' };
    const ids = actorIdsForGovernance(actor);
    if (ids.length === 0) return { ok: false as const, error: 'not authenticated' };
    return store.getMyPermissions(ids, publicId);
  };
}
