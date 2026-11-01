# Acceptance — stack-migration-mig-701 (#850 / MIG-701)

## Intent

After MIG-700 authority switch, run a defined **read-only** dual-run parity
window: same confirmed revision on authority vs shadow; discrepancies identify
record/revision/kind and block shutdown-ready; rollback restores last consistent
authority and archives the decision.

## Acceptance tier

`isolated-contract`. SLICE DONE does **not** imply RELEASE APPROVED or MIG-702.

## Preconditions

- MIG-700/#849 DONE (Dornhain cutover drill + Freigabe A).
- Dornhain catalog hard requirement remains binding on authority.

## Happy path

- Clean clone compares equal at revision N; shadow SELECTs do not mutate fingerprints.
- Injected character digest mismatch reports `digest-mismatch` with recordId + revision.
- `shutdownPredecessorMet === false` while discrepancies exist.
- Rollback re-clones authority → parity restored; archive JSON records duration,
  result, responsible decision, revision, discrepancy count.

## Required Tests

- [x] Same confirmed revision compare; shadow reads cause no business writes.
- [x] Discrepancy report identifies record, revision, kind; blocks shutdown predecessor.
- [x] Rollback fixture restores authority + archives observation decision.
- [x] `node --experimental-strip-types scripts/mig-701-parity-window.self-test.mjs` → PASS.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Security Coverage

| ID | How |
| --- | --- |
| Single writer | Authority is sole write source; shadow compare read-only until intentional inject |
| Fail-closed shutdown | Any discrepancy ⇒ `shutdownPredecessorMet: false` |
| Dornhain catalog | `catalogIntactOnAuthority` after drill |

## Composition Gate

See `.qa/runs/composition-gate-stack-migration-mig-701.md`.

## Non-claims

- No live Supabase dual-write.
- No production Supabase shutdown (MIG-702).
- No GATE-05 full APPROVED / MIG-703.
