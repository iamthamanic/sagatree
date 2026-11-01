# Acceptance — stack-migration-mig-702 (#851 / MIG-702)

## Intent

Dornhain-scoped **Supabase shutdown readiness** after MIG-700 restore + MIG-701
parity: predecessors must present hashed completionEvidence (labels alone do not
unlock); remaining Supabase network calls are blockers; restore + permission
negatives proven; productive shutdown only with linked Freigabe A.

## Acceptance tier

`isolated-contract`. SLICE DONE does **not** imply a live production wipe was
executed — productive authorization is the Freigabe-linked flag only.

## Preconditions

- MIG-700/#849, MIG-701/#850, ATLAS-LIVE-E2E/#770, MIG-603/#848 DONE with evidence.
- Owner RELEASE: `docs/architecture/migration-owner-release-2026-11-01-dornhain.md`
  (`APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF`).

## Happy path

- Relabeled `agent-done` without evidence paths → `shutdownReady: false`.
- Leftover Supabase network call → explicit blocker.
- Full preds + cleared matrix + restore + Freigabe → `shutdownReady` and
  `productiveShutdownAuthorized`; Dornhain catalog intact.
- Decision archived under drill `archiveDir` as `shutdown-decision-*.json`.

## Required Tests

- [x] Missing/spoofed predecessor evidence blocks (labels do not bypass).
- [x] Call-path matrix: successors or approved retirement; leftover Supabase calls block.
- [x] Restore + permission negative (stranger cannot authorize); Freigabe required for productive.
- [x] `node --experimental-strip-types scripts/mig-702-shutdown-readiness.self-test.mjs` → PASS.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Security Coverage

| ID | How |
| --- | --- |
| Evidence over labels | `claimedAgentDoneLabels` without paths → `missing-predecessor-evidence` |
| Fail-closed matrix | `supabase-network-blocker` / `operation-without-successor` |
| Permission negative | `strangerCanAuthorizeShutdown` must be false |
| Dornhain catalog | `catalogIntact` required for ready |
| Productive gate | Freigabe link + status; never from intake labels alone |

## Composition Gate

See `.qa/runs/composition-gate-stack-migration-mig-702.md`.

## Non-claims

- No automatic live Supabase project deletion in CI.
- No GATE-05 full desktop APPROVED / MIG-703 ship.
- No claim that every historical Edge path is already retired outside the fixture matrix.
