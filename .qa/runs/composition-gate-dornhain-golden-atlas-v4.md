# Composition Gate — dornhain-golden-atlas-v4

- Issue: #1194 / #1198
- Feature slug: dornhain-golden-atlas-v4
- HEAD_SHA: 19ebb726353a9eb1d8c24cadcd0f2c283c871566
- BASE_SHA: e7f7981067c5c1b3a6fd2dd2b96aa15039ef7f48
- Date: 2026-11-11
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
