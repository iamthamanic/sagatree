# Acceptance — stack-migration-mig-700 (#849 / MIG-700)

## Intent

Owner-scoped Dornhain cutover **drill**: Freeze → host import → single-writer
authority switch → Rollback, with hard catalog presence (world, saga, characters,
items, monsters, NPCs). Unlocks agent-ready after Freigabe A (2026-11-01);
production Supabase shutdown remains MIG-702 after proof.

## Acceptance tier

`release-gate` (drill / evidence aggregation). SLICE DONE for fixture drill does
**not** imply RELEASE APPROVED for live production cutover.

## Preconditions

- Waves 0–6 + ATLAS-LIVE-E2E + MIG-602/#847 DONE (intake preds).
- Owner RELEASE: `docs/architecture/migration-owner-release-2026-11-01-dornhain.md`
  + `architecture-approvals.json` (`GATE-05` APPROVED_TO_EXECUTE,
  `releases.CUTOVER-DORHAIN` APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF).
- GATE-01 Host Drizzle + CI import-boundary evidence already green in cutover checklist.

## Happy path

- Synthetic Dornhain source seeds world + saga + characters + monsters + items + NPCs.
- Freeze export → target import preserves catalog (zero missing keys).
- Exactly one writer during freeze; stranger cannot see Dornhain world after switch.
- Poisoned target rolls back to last good import; catalog still present.

## Edge / security

- Missing any hard-requirement catalog key fails the drill (fail-closed).
- Stranger owner_user_id yields zero Dornhain worlds after import.
- Production shutdown not executed in this slice (MIG-702 gated).

## Required Tests

- [x] Owner RELEASE unlocks GATE-05 + MIG-700 to agent-ready when preds DONE
      (`architecture-approvals` + intake renderer).
- [x] Freeze→import: single writer; IDs/checksums comparable; Dornhain catalog intact.
- [x] Rollback from poisoned target restores last good stand + catalog.
- [x] Cutover ops docs under `docs/ops/cutover/**`; host code under `server/src/migration/cutover/**`.
- [x] `node --experimental-strip-types scripts/mig-700-dornhain-cutover-drill.self-test.mjs` → PASS.
- [x] `node --test scripts/stack-migration-contract-validation.test.mjs` → PASS (errors=0).
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Security Coverage

| ID | How |
| --- | --- |
| Owner scope | Source/target/restore owner IDs distinct; stranger world count = 0 |
| Catalog integrity | `assertDornhainCatalogPresent` after import + rollback |
| Single writer | Drill report `writerDuringFreeze` pinned |
| Fail-closed | Missing catalog key → self-test fail |

### Launch Checklist (SC)

N/A for live production — drill only. MIG-702 executes Supabase exit after proof.

## Composition Gate

See `.qa/runs/composition-gate-stack-migration-mig-700.md`.

## Non-claims

- No live Supabase wipe in this PR.
- No desktop binary ship (GATE-05 PoC remains #788).
- No claim that non-Dornhain tenant data was migrated.
