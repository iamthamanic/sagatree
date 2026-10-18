# Feature: Unified Atlas 2D/3D Editor (Hybrid)

## Intent

One atlas workstation with a shared editable document. Canvas2D Draufsicht + Three.js 3D view both edit the same objects. Dungeon Forge–derived generator produces editable rooms/walls. Focus mode enlarges the map. Gates: **IV-***, **AU-CONTENT-WIDTH**, **AU-TOUCH**.

## Preconditions

- World atlas migrations applied; user can edit world profile.
- `three` dependency available (already in package.json).

## Happy Path

- [x] PoC A Hybrid and PoC B Unified Three complete identical 10-step test (evidence `results.json`).
- [x] Architecture decision: **Hybrid** documented.
- [x] Draufsicht / 3D-Ansicht toggle in `UnifiedAtlasEditor`.
- [x] Move object in 3D → same position in 2D doc (`applyMapEdit`).
- [x] Select+drag object in 2D.
- [x] Dungeon generate → confirm → rooms/walls/objects appended.
- [x] Fokusmodus hides meta chrome; stage uses large min-height.
- [x] Missing interior detail shows IV placeholder (no invented lore).
- [ ] Full product E2E save/reload with 3D move (manual/browser against self-host).
- [x] Nested DB map LOD from `world_places` + map-link anchors (`buildAtlasPlaceNav` / `resolveAtlasLodFromPlaces`); demo Eldoria rects only when no DB places.
- [x] Place authoring: Pin click + Gebiet-Rahmen (marquee) — not camera center only.
- [x] Planet Globus mode: stronger tilt + horizon disc when level is WELT (`data-atlas-globe-mode`); edit stays on Weltkarte.

## Regression

- [x] Dual Library/Saga workbench preserved.
- [x] `unifiedCanvas` format v1 + optional `z`/`height`.
- [x] `world-atlas-editor-check` + `unified-atlas-dungeon-check` + `atlas-place-nav.self-test`.
- [ ] Full `npm run test-gate` before merge.

## Security

- No change to RLS/RPC authz surface in this slice.
- Player secrets remain server-gated (unchanged).

## Composition / Proof

- Design: `.qa/design/unified-atlas-2d-3d-editor.md`
- Comparison: `.qa/research/unified-atlas-renderer-comparison.md`
