# Composition Gate — stack-migration-mig-701 (#850 / MIG-701)

- HEAD_SHA: 42cccd0f1eccfa95eb2613a4b74c1b0cc6022002
- BASE_SHA: 5b5de3f20e82057b1073aa36b2c3eb63584f86b5
- Date: 2026-11-01
- Verdict: CLEAR
- Note: Read-only Dornhain parity window after MIG-700; discrepancy blocks MIG-702 shutdown predecessor.
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

MIG-700 authority host → seed Dornhain catalog → clone shadow → revision-pinned
compare → inject digest poison → fail-closed shutdown flag → rollback clone +
archive decision under `docs/ops/cutover/parity-window`.

## Hop chain

1. Producer: `seedDornhainParityAuthority` / MIG-700 catalog on authority HostDatabase
2. Shadow clone: table copy (delete/insert order) — not a second writer for live traffic
3. Compare: `captureParitySnapshot` + `compareParitySnapshots` at confirmed revision
4. Negative: intentional shadow character name poison → digest-mismatch
5. Policy: `shutdownPredecessorMet` false while discrepancies remain
6. Consumer: rollback re-clone + `archiveParityRollbackDecision` JSON

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | authority owner only | owner-scoped SELECTs | pass |
| Invalid/missing | empty shadow / digest poison | discrepancies + shutdown false | pass |
| Two consumers / crash | rollback after inject | parity restored + archive | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: live observation window / MIG-702 shutdown
- SLICE DONE does not imply RELEASE APPROVED

## Non-claims

No production dual-write; no Supabase wipe; Dornhain catalog must stay on authority.
