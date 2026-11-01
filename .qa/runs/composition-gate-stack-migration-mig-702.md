# Composition Gate — stack-migration-mig-702 (#851 / MIG-702)

- HEAD_SHA: 7157b86a5e461a085e9d00bf0d4ebc65e2701951
- BASE_SHA: af6a2f2e7e2b9bea3307dd87f4d628ebef0121b8
- Date: 2026-11-01
- Verdict: CLEAR
- Note: Dornhain-scoped Supabase shutdown readiness after MIG-700/701 proof.
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

Predecessor completionEvidence (hashed) → non-empty call-path matrix → restore +
Dornhain catalog presence → permission negatives → bind CUTOVER-DORHAIN Freigabe
from architecture-approvals → archive shutdown decision with approval provenance.

## Hop chain

1. Producer: `loadPredecessorEvidenceFromDisk` / completion JSON schema+artifact hashes
2. Matrix: host successors or approved retirement; live `supabaseNetworkCall` always blocks
3. Restore: catalog presence + restoreDrillPass
4. Policy: empty matrix / stranger auth / unbound Freigabe fail-closed
5. Consumer: `archiveShutdownDecision` JSON under ops archive dir

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | owner may authorize after proof; stranger never | permission negative | pass |
| Invalid/missing | missing preds / empty matrix / broken catalog / forged Freigabe | blockers | pass |
| Two consumers / crash | decision archive after ready path | sha256 + approval fields | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: live production wipe remains human-operated with archive
- SLICE DONE does not imply automatic Supabase project deletion
