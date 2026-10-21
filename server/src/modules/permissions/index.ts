/**
 * permissions module public API — deny-by-default policy stub (MIG-013 fills matrix).
 * Location: server/src/modules/permissions/index.ts
 */
import type { Actor } from '../identity/index.ts';

export type PolicyDecision = { readonly allow: boolean; readonly reason: string };

export type PermissionsPorts = {
  readonly authorize: (op: string, actor: Actor) => PolicyDecision;
};

export function createPermissionsPorts(): PermissionsPorts {
  return {
    authorize: (op, actor) => {
      if (!actor?.actorId) return { allow: false, reason: 'missing-actor' };
      if (op === 'host.health.read') return { allow: true, reason: 'public-health' };
      if (op === 'host.ping.write') return { allow: true, reason: 'solo-mutation' };
      return { allow: false, reason: 'deny-by-default' };
    },
  };
}
