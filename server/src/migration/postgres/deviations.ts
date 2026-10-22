/**
 * Known legacy permission defects documented as dry-run deviations.
 * These MUST NOT be imported as production data or treated as secure parity.
 * Location: server/src/migration/postgres/deviations.ts
 */

export type LegacyPermissionDeviation = {
  readonly id: string;
  readonly observationId: string;
  readonly severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  readonly summary: string;
  readonly sourceEvidence: string;
  readonly requiredSuccessorAcceptance: string;
  /** Explicit: dry-run does not copy production rows that exhibit this defect. */
  readonly importPolicy: 'document-only-no-production-import';
};

/**
 * Frozen set of known defects from RPC intake / isolated PG observations.
 * MIG-503 records them on every dry-run report; it does not reproduce or ship them.
 */
export const KNOWN_LEGACY_PERMISSION_DEVIATIONS: readonly LegacyPermissionDeviation[] = Object.freeze([
  {
    id: 'RPC-SEC-LEGACY-MAP-FLAG',
    observationId: 'BASELINE-SEC-LEGACY-MAP',
    severity: 'High',
    summary:
      'Nicht-Editor mit Welt-Leserecht kann undiscovered Pins mit p_player_view=false lesen.',
    sourceEvidence:
      'supabase/migrations/068_world_maps.sql; .qa/intake/rpc-contracts/legacy-observations.json',
    requiredSuccessorAcceptance:
      'Player-Filter serverseitig anhand Editor-Recht erzwingen; true/false/NULL als Player prüfen. Unsicheren Legacy-Response nicht als Parität übernehmen.',
    importPolicy: 'document-only-no-production-import',
  },
  {
    id: 'RPC-SEC-CROSS-SAGA-MAP',
    observationId: 'BASELINE-SEC-CROSS-SAGA',
    severity: 'High',
    summary:
      'Membership in saga A can observe a map revealed only in saga B (cross-saga leak).',
    sourceEvidence: '.qa/intake/rpc-contracts/legacy-observations.json',
    requiredSuccessorAcceptance:
      'Cross-saga map reveal must stay membership-scoped; do not import the leaking projection as parity.',
    importPolicy: 'document-only-no-production-import',
  },
]);
