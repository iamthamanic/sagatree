# Composition Gate — stack-migration-mig-700 (#849 / MIG-700)

- HEAD_SHA: WORKTREE
- BASE_SHA: (main at PR open)
- Date: 2026-11-01
- Verdict: CLEAR
- Note: Owner Freigabe A unlocks GATE-05 execute + Dornhain cutover drill.
  Hard catalog (world/saga/characters/items/monsters/NPCs) must survive
  Freeze→import→Rollback. No production Supabase shutdown in this hop.

## Event

Owner RELEASE → architecture-approvals (`GATE-05` APPROVED_TO_EXECUTE +
`releases.CUTOVER-DORHAIN`) → intake renderer agent-ready → MIG-700 drill
(seed Dornhain → freeze bundle → import host → catalog assert → poison →
rollback → catalog assert).

## Hop chain

1. Producer: `dornhainFixtureCatalog` + source HostDatabase seed
2. Freeze: `exportHostBundle` under single-writer lock
3. Authority switch: `importHostBundle` into target HostDatabase + data dir
4. Policy: stranger owner sees zero Dornhain worlds
5. Consumer: `assertDornhainCatalogPresent` + rollback restore path
6. Evidence: self-test + ops docs `docs/ops/cutover/dornhain-pilot.md`

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | owner / restore owner / stranger | drill strangers worldCount=0 | pass |
| Invalid/missing | omit character/item → missing[] non-empty | catalog assert | pass |
| Two consumers / crash | poison target → rollback restores catalog | drill phase rollback-ok | pass |

## Flags

- Acceptance tier: release-gate (drill)
- Deferred: live Supabase shutdown → MIG-702 after Dornhain proof
- Deferred: GATE-05 desktop ship → #788 PoC evidence
- SLICE DONE does not imply RELEASE APPROVED for production wipe

## Non-claims

No production cutover executed; no claim that unrelated user tenants were kept.
