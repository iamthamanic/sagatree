# Composition Gate — atl2-f05

- Issue: #1228
- Feature slug: atl2-f05
- HEAD_SHA: c1e84fc58fb8b68163b10fbb7cd3c2af55883add
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
5. Manual user room + `manualDirty` → persist meta via `mergeDungeonMetaIntoGeneratorMeta` /
   `extractDungeonMetaFromGeneratorMeta` (reload)
6. `buildAtlasDungeonLookPlan` (F04) 2D/3D ID parity across themes
7. Reforge: `dungeonNeedsReforgeConfirm` → strip generator IDs only; user rooms survive
8. UI: `canEdit` gates `data-atlas-dungeon-forge`; playerView read path unchanged

Cardinality: one canonical dungeon feature set per commit; one meta.dungeon blob per map;
theme switches do not mint new geometry IDs.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Single GM editor | canEdit forge panel | pass |
| Invalid/missing | Bad gen / raster | null payload, no commit | pass |
| Two consumers | Theme A vs B look | same geometryFingerprint | pass |
| Player | canEdit=false | forge UI absent | pass |

## Flags

| Tag | Severity | Hops | Why | Fix |
|-----|----------|------|-----|-----|
| (none) | — | — | — | — |
