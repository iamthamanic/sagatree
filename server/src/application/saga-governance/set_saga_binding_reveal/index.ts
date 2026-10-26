/**
 * set_saga_binding_reveal use-case (RPC-SAGA-GOVERNANCE / #875).
 * Location: server/src/application/saga-governance/set_saga_binding_reveal/index.ts
 */
import type { Actor } from '../../../modules/identity/index.ts';
import type { PermissionsPorts } from '../../../modules/permissions/index.ts';

export function setSagaBindingRevealUseCase(deps: { readonly permissions: PermissionsPorts }) {
  return (actor: Actor, projectId: string, bindingId: string, reveal: string) => {
    const store = deps.permissions.sagaGovernance;
    if (!store) return { ok: false as const, error: 'store-unavailable' };
    if (!actor?.actorId) return { ok: false as const, error: 'not authenticated' };
    return store.setBindingReveal(actor.actorId, projectId, bindingId, reveal);
  };
}
