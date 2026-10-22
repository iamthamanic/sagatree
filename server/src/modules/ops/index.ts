/**
 * ops module public API — host lifecycle / health ports.
 * Location: server/src/modules/ops/index.ts
 */
export type HostHealth = {
  readonly ready: boolean;
  readonly mode: 'solo';
  readonly dataDirFingerprint: string;
};

export type OpsPorts = {
  readonly getHealth: () => HostHealth;
  readonly acceptMutations: () => boolean;
};

export function createOpsPorts(deps: {
  isReady: () => boolean;
  acceptMutations: () => boolean;
  dataDirFingerprint: string;
}): OpsPorts {
  return {
    getHealth: () => ({
      ready: deps.isReady(),
      mode: 'solo',
      dataDirFingerprint: deps.dataDirFingerprint,
    }),
    acceptMutations: deps.acceptMutations,
  };
}
