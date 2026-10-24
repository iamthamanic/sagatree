/**
 * Isolated fixtures for RPC-SAGA-VERSION-READ (#872) — knowledgeFacts GM filtering.
 * Location: server/src/application/saga-version-read/__tests__/fixtures.ts
 */
export const VERSION_READ_PAYLOAD_WITH_GM_FACTS = {
  packageId: null,
  title: 'Dornhain',
  blurb: 'Starter',
  synopsis: 'Starter',
  knowledgeFacts: [
    { id: 'public-1', visibility: 'public', summary: 'Öffentlich' },
    { id: 'gm-1', visibility: 'gm_only', summary: 'Nur GM' },
    { id: 'shared-1', visibility: 'shared', summary: 'Geteilt' },
  ],
  locations: [],
  pregens: [],
} as const;
