# Composition Gate — dornhain-golden-atlas-v4

- Issue: #1194 / #1198
- Feature slug: dornhain-golden-atlas-v4
- HEAD_SHA: 6bfafa5f84f09ae5d3d0396be5f61a3597b55c16
- BASE_SHA: 83d9da8c3607fe49306e76dd63f72f8acece3ed8
- Date: 2026-11-12
- Verdict: SKIPPED

## Skip reason

Seed/reset/projection hardening and fingerprint refresh on existing atlas workstation; no new multi-actor hop chain beyond existing world_atlas_maps upsert + party projection.

## Event

GM restores Dornhain Golden root or previews Spieleransicht without writing redacted geography.

## Hop chain

WorldAtlasWorkbench → useWorldAtlasEditor.resetToGolden / getMap(playerView) → worldAtlasService → host world-atlas-store (redactPartyMeta) → SQLite world_atlas_maps.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Only owner/edit can reset; players never see Voll toggle | canEdit + goldenRootEligible + showPlayerPreviewToggle | pass |
| Invalid/missing | Non-root / non-Dornhain maps reject reset; preview without saga hidden | isDornhainGoldenRootMap + sagaReady | pass |
| Two consumers / crash | Preview cannot save redacted layers over full map | editingAllowed gates autosave/UnifiedAtlasEditor | pass |

## Flags

Kodus Complete may use trusted `ecc-kodus-skipped-credits` when provider credits are exhausted. Codex findings must be resolved on HEAD.
