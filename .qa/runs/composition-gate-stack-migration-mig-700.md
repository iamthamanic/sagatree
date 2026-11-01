# Composition Gate — stack-migration-mig-700 (#849 / MIG-700)

- HEAD_SHA: e1c8ae6d2ff67073f66478dc616e87d026c5d37c
- BASE_SHA: ee328db4484620ae550002d6ebfbb90d9c7bac77
- Date: 2026-11-01
- Verdict: CLEAR
- Note: Owner Freigabe A unlocks GATE-05 execute + Dornhain cutover drill.
  Hard catalog (world/saga/characters/items/monsters/NPCs) must survive
  Freeze→import→Rollback. No production Supabase shutdown in this hop.
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

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
