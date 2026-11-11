# Feature: Golden hierarchy content + reset chain (Steps 5+6)

<!-- Golden Steps 5+6 — see .qa/design/atlas-golden-steps-2-6-pm.md -->

## Intent

Golden Dornhain ships a located hierarchy of primary maps (world → continent →
country → place → buildings) with minimum authored content per level. Reset
modes restore the full Golden map chain (not only the world root). Session wipe
on `everything` stays honest when unavailable.

Naming (until PM freeze): **Kontinent Westmark** / **Land Westmark** under Donalu.

## Happy Path

- [x] Domain specs list Golden places + child map seeds with parentAnchors
- [ ] Fresh / reset Golden: drill Welt→Kontinent→Land→Dornhain→Taverne/Krypta with non-empty canvases _(code path present; browser E2E open)_
- [x] Reset `atlas` restores all Golden map docs; non-Golden maps untouched _(planner + upsert loop; browser open)_
- [x] Reset `atlas_places` also restores Golden places/links; user places without Golden seed_key survive _(code; browser open)_
- [x] Reset `everything` without session API: DE note, no fake success for session wipe _(self-test)_
- [x] Self-tests + `npm run test-gate` pass

## Edge Cases

- [x] Partial failure does not claim full hierarchy restored (error surfaces) _(throws on missing parent map)_
- [x] Player view toggle still GM-only (no new leak)

## Composition Gate

SKIPPED — owner-scoped authoring/reset; no new multi-actor hop
(see `.qa/runs/composition-gate-atlas-golden-hierarchy-reset.md`)
