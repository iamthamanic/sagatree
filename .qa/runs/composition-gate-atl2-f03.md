# Composition Gate — atl2-f03

- Issue: #1226
- Feature slug: atl2-f03
- HEAD_SHA: WORKTREE
- BASE_SHA: fe652e1521b34966ba9f0df015774d5bb3b9253b
- Date: 2026-11-13
- Verdict: CLEAR

## Event

GM forge generate → non-canonical preview merge → explicit commit (raster rooms/walls/doors) or cancel; dirty reforge strips generator IDs only.

## Hop chain

1. `generateDungeon` (F01) + `rasterizeDungeonGenerateResult` (F02)
2. `dungeonCommitPayloadFromResults` → preview payload
3. `mergeDungeonPreviewIntoDoc` → `forgeDisplayDoc` (2D paint + 3D seed)
4. `commitDungeonFeaturesToDoc(replaceGenerated=true)` → canonical doc + dungeon meta
5. Cancel / failed generate → no canonical mutation

Cardinality: one preview payload per generate; one strip of generator IDs per commit/reforge.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Single GM | UI canEdit gate | pass |
| Invalid/missing | Bad gen / raster fail | Error DE, preview null | pass |
| Two consumers | Preview then commit | Hand-drawn rooms survive | pass |

## Flags

| Tag | Severity | Hops | Why | Fix |
|-----|----------|------|-----|-----|
| (none) | — | — | — | — |
