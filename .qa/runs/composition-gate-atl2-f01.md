# Composition Gate — atl2-f01

- Issue: #1224
- Feature slug: atl2-f01
- HEAD_SHA: 744097da1ab9f1b88bacb1399691589869f42a83
- BASE_SHA: a260606ed0854c841431eae3c09dbb0ebae06694
- Date: 2026-11-13
- Verdict: CLEAR

## Event

GM runs `generateDungeon` → preview → confirm commit into map `generator_meta.dungeon`
+ canvas entities. Later reforge must not silently overwrite confirmed/manual edits.

## Hop chain

1. Domain `generateDungeon` / `validateDungeonSemantics` (pure) → layout + roles
2. UI preview (editor state only)
3. Confirm → `buildDungeonGeneratorMeta(confirmed=true)` merged into generator_meta
4. Manual edit → `manualDirty=true`
5. Reforge attempt → `dungeonNeedsReforgeConfirm` requires explicit confirm

Cardinality: one layout per generate call; one meta blob per map; reforge is
user-gated (not auto fan-out).

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Single GM authoring | No multi-tenant generate hop | pass |
| Invalid/missing | Bad seed/roomCount/loopChance | `normalizeDungeonGenerateParams` clamps; invalid semantics → `valid:false` | pass |
| Two consumers / crash | Reforge vs dirty edits | `dungeonNeedsReforgeConfirm` blocks silent overwrite | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
