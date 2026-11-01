# Composition Gate — stack-migration-mig-700 (#849 / MIG-700)

- HEAD_SHA: 9358412fe87a42550a3e1af46b85d8e8be060b9e
- BASE_SHA: ee328db4484620ae550002d6ebfbb90d9c7bac77
- Date: 2026-11-01
- Verdict: CLEAR
- Note: Owner Freigabe A unlocks GATE-05 execute + Dornhain cutover drill.
  Hard catalog (world/saga/characters/items/monsters/NPCs) must survive
  Freeze→import→Rollback on the same poisoned target host.
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)

## Event

Owner RELEASE → architecture-approvals (`GATE-05` APPROVED_TO_EXECUTE +
`releases.CUTOVER-DORHAIN`) → intake renderer agent-ready → MIG-700 drill
(seed Dornhain host tables → freeze bundle → import host → catalog apply →
policy stranger DENY → poison target → wipe+re-import same target → catalog
assert from tables).

## Hop chain

1. Producer: `dornhainFixtureCatalog` + source HostDatabase seed (characters /
   inventory_item_definitions / npc_creature_definitions)
2. Freeze: `exportHostBundle` owner-scoped; competing stranger world excluded
3. Authority switch: `importHostBundle` + `applyDornhainCatalogToHost`
4. Policy: `createProjectPorts.actorCanAccessWorld` restore allow / stranger DENY
5. Consumer: `presenceFromHostTables` + rollback wipe/re-import on poisoned target
6. Evidence: self-test + ops docs `docs/ops/cutover/dornhain-pilot.md`

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | owner / restore owner / stranger | actorCanAccessWorld + strangerWorldCount=0 | pass |
| Invalid/missing | omit character/item → missing[] non-empty | catalog assert from tables | pass |
| Two consumers / crash | poison target → wipe+re-import restores catalog; CORRUPTED gone | drill phase rollback-ok | pass |

## Flags

- Acceptance tier: release-gate (drill)
- Deferred integration: live Supabase shutdown → MIG-702 after Dornhain proof
- Deferred integration: GATE-05 desktop ship → #788 PoC evidence
- SLICE DONE does not imply RELEASE APPROVED for production wipe

## Non-claims

No production cutover executed; no claim that unrelated user tenants were kept.
