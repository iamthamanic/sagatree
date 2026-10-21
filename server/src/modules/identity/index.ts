/**
 * identity module public API — actor resolution stub (MIG-014 fills Better Auth).
 * Location: server/src/modules/identity/index.ts
 */
export type Actor = { readonly kind: 'solo-local'; readonly actorId: string };

export type IdentityPorts = {
  readonly resolveSoloActor: () => Actor;
};

export function createIdentityPorts(actorId: string): IdentityPorts {
  return {
    resolveSoloActor: () => ({ kind: 'solo-local', actorId }),
  };
}
