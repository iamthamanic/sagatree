# MIG-701 — Dornhain dual-run parity window

After MIG-700 Freeze→import, run a **defined observation window** with
**read-only** parity against a shadow copy. Exactly one write authority.

## Rules

| Rule | Meaning |
| --- | --- |
| Single writer | Host (post-cutover) is authority; shadow is compare-only |
| Same revision | Both sides compared at one confirmed revision |
| Shadow reads | SELECT/fingerprint only — no business writes during compare |
| Discrepancy | Report `recordId`, `kind`, `revision`, `discrepancyKind` |
| Shutdown gate | Any discrepancy ⇒ `shutdownPredecessorMet: false` (MIG-702 blocked) |
| Rollback | Above runbook threshold ⇒ restore last consistent authority + archive decision |

## Threshold (fixture)

- Default fixture threshold: **any** digest/revision/missing discrepancy.
- Decision archived under the drill `archiveDir` as `parity-rollback-*.json`
  (duration, result, responsible decision, revision, discrepancy count).

## Local proof

```bash
node --experimental-strip-types scripts/mig-701-parity-window.self-test.mjs
```

Code: `server/src/migration/cutover/parity-window.ts`

## Non-claims

- Not a live Supabase dual-write.
- Not production shutdown (MIG-702).
- Not GATE-05 desktop APPROVED.
