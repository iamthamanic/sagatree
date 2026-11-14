# Composition Gate — atl2-f05

- Issue: #1228
- Feature slug: atl2-f05
- HEAD_SHA: e63430d6c4d270263066cca5860745e9de133062
- BASE_SHA: e8ceb20240de79b370a2e13b9f56bb117969ad70
- Date: 2026-11-14
- Verdict: CLEAR

## Event

GM dungeon forge golden path: generate → non-canonical preview → commit → manual edit →
meta reload → Custom-WebGL look (theme switch) → dirty reforge guard; player cannot forge.

## Hop chain

1. `generateDungeon` (F01) + connectivity/semantics
2. `rasterizeDungeonGenerateResult` (F02) + BFS passable
3. `mergeDungeonPreviewIntoDoc` → display-only; canonical unchanged
4. `commitDungeonFeaturesToDoc(replaceGenerated=true)` + `buildDungeonGeneratorMeta(confirmed)`
5. Manual user room + `onDungeonMetaChange`/`updateDungeonMeta` → persist via
   `mergeDungeonMetaIntoGeneratorMeta` / reload `extractDungeonMetaFromGeneratorMeta`
6. `buildAtlasDungeonLookPlan` (F04) 2D/3D ID parity across themes
7. Reforge: `dungeonNeedsReforgeConfirm` → strip generator IDs only; user rooms survive
8. UI: `canEdit` gates `dungeonForgePanel` / `data-atlas-dungeon-forge`; player render has none

Cardinality: one canonical dungeon feature set per commit; one meta.dungeon blob per map;
theme switches do not mint new geometry IDs.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Single GM editor | canEdit forge panel | pass |
| Invalid/missing | Bad gen / raster | null payload, no commit | pass |
| Two consumers / crash | Theme A vs B look; mid-edit crash | same geometryFingerprint; dirty meta survives reload | pass |
| Player | canEdit=false render | forge marker/controls absent | pass |

## Flags

| Tag | Severity | Hops | Why | Fix |
|-----|----------|------|-----|-----|
| (none) | — | — | — | — |

- Acceptance tier: host-integration
- Deferred integration: none
