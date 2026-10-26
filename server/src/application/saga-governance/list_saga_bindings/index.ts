/**
 * list_saga_bindings use-case (RPC-SAGA-GOVERNANCE / #875).
 * Location: server/src/application/saga-governance/list_saga_bindings/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import {
  actorIdsForGovernance,
  type PermissionsPorts,
} from '../../../modules/permissions/index.ts';

export function listSagaBindingsUseCase(deps: { readonly permissions: PermissionsPorts }) {
  return (actor: Actor, publicId: string, assetKind?: string | null) => {
    const store = deps.permissions.sagaGovernance;
    if (!store) return { ok: false as const, error: 'store-unavailable' };
    const ids = actorIdsForGovernance(actor);
    if (ids.length === 0) return { ok: false as const, error: 'not authenticated' };
    return store.listBindings(ids, publicId, assetKind ?? null);
  };
}
