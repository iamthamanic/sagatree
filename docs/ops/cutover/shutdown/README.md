# MIG-702 — Legacy-stack shutdown readiness (Dornhain)

> **Historisch — abgeschlossenes Runbook, nicht Produkt-Stack.** The former hosted backend was shut down
> after the Dornhain cutover (owner release 2026-11-01). The product runs host-only. Kept so the
> MIG-702 readiness contract stays traceable (#1328).

The legacy stack could exit **only after** predecessor proof + restore + call-path
clearance, and **productive** shutdown needed the linked Dornhain Freigabe.

## Rules

| Rule | Meaning |
| --- | --- |
| Evidence not labels | Relabeled `agent-done` without `completionEvidence` still blocks |
| Predecessors | MIG-700, MIG-701, ATLAS-LIVE-E2E, MIG-603 must PASS on disk |
| Call matrix | Every operation has a verified host successor **or** human-approved retirement |
| Legacy leftovers | Remaining legacy network calls are explicit blockers until retired |
| Restore | MIG-700 rollback + MIG-701 parity archive; Dornhain catalog intact |
| Permission negative | Stranger must not authorize shutdown |
| Productive auth | Linked Freigabe (`APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF`) required |

## Hard content requirement

Dornhain world, saga, characters, default items, monsters, and NPCs must remain
intact. Other tenant/user data may be omitted (owner Freigabe A, 2026-11-01).

## Local proof

```bash
node --experimental-strip-types scripts/mig-702-shutdown-readiness.self-test.mjs
```

Code: `server/src/migration/cutover/shutdown-readiness.ts`

## Productive live execute (done)

The productive live shutdown was a separate Freigabe-Handlung, recorded in
[`migration-owner-release-2026-11-01-legacy-baas-shutdown.md`](../../../architecture/migration-owner-release-2026-11-01-legacy-baas-shutdown.md).
Its one-off execute script and runbook were removed after execution (#1328; see Git history).

## Non-claims

- This slice (MIG-702) does **not** wipe a live production project by itself.
- CUTOVER-DORHAIN `APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF` is drill Freigabe, not “already wiped.”
- Desktop Product/Store ship is a separate RELEASE (`DESKTOP-PRODUCT-STORE`).
