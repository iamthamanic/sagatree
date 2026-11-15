# Feature: World Atlas Editor (Unified Canvas + dual navigation)

> **Status (ATL2-H02 #1235, 2026-11-15):** Historical. "Leaflet module may remain in repo" no longer holds — `WorldAtlasLeafletMap.tsx` was removed in ATL2-H01 (#1234). Current ATL2 architecture: `docs/architecture/atlas-v2-architecture.md` (renderer SoT ADR-ST-10). Content below is preserved as written.

<!-- updated by /implement 2026-10-17 — unified canvas primary -->

## Intent

Hierarchical Fantasy World Atlas with a **single Canvas 2D multi-scale viewport** (HTML unified-atlas parity): continuous zoom with LOD fade (Welt → Land → Stadt → Innenraum), brush/stamp/room/wall/grid tools, undo/redo, zoom % and coordinates. Persist edits in `world_atlas_maps.generator_meta.unifiedCanvas`. Dual entry Library + Saga. Leaflet/Geoman demoted; legacy tile editor remains for `legacy_tiles`. Surface: **Workstation**. Gates: **AU-CONTENT-WIDTH**, **AU-TOUCH**, **IV-*** (map as spatial aid; demo Eldoria marked non-canonical).

Tracking: GitHub #702 / unified-canvas follow-up.

## Preconditions

- Authenticated user; world profile readable (`current_user_can_read_world_profile`).
- Edit requires `current_user_can_edit_world_profile` (Library) or equivalent GM + world-edit grant in Saga context.
- Migrations through `094_world_atlas` applied.

## Happy Path

- [ ] **Library:** `/library/worlds/:worldPublicId/map` opens workbench (`data-world-atlas-workbench`).
- [ ] **Saga:** `/sagas/:sagaPublicId/world/map` opens the same workbench for the saga’s `worldProfileId`.
- [ ] Default non-legacy map uses **Unified Atlas Canvas** (`data-unified-atlas-viewport`) — not Leaflet.
- [ ] Mouse wheel zooms cursor-anchored; nested demo detail (Eldoria→Dornhain→Taverne) fades in via LOD without hard map switch.
- [ ] Tools: Hand, Pinsel, Weg, Raum, Wand, Stempel, Radierer; material + stamp inspector; combat grid toggle.
- [ ] Undo/Redo; zoom %; live X/Y coordinates.
- [ ] Speichern persists strokes/objects/rooms/walls into `generator_meta.unifiedCanvas`; reload restores.
- [ ] Demo procedural art shows badge „Beispielwelt / Demo“ when using seed content.
- [ ] Legacy tile editor remains for `legacy_tiles` roots.
- [ ] Azgaar `.map` upload/download path remains available when present on the map row.

## Edge Cases

- [ ] Oversized canvas JSON (>~1MB client check) → DE error, no silent truncate.
- [ ] Stale revision on save → fail closed with DE message.
- [ ] Phone: hierarchy/inspector as Sheets; primary canvas usable (`AU-*`).
- [ ] Player view: no secret elevation via canvas meta (same world read grants).

## Regression

- [ ] Dual Library/Saga routes still resolve.
- [ ] `legacy_tiles` path + party/pins still reachable.
- [ ] `npm run test-gate` / architecture-boundary green.
- [ ] Leaflet module may remain in repo but is not the default UI.

## Assumptions

- No new SQL migration; reuse 094 `generator_meta`.
- Procedural Eldoria is sample geometry, not product lore.
- DaisyUI/Next.js personal rules do not apply — SagaTree Vite/React/Radix.

## Security Coverage

- F-01 / B-01: RLS via world profile helpers.
- SC-01: map id must belong to world.
- SC-02: canvas payload size capped client-side; layers GeoJSON constraint unchanged.
- SC-06: no secrets in client.
- Launch Checklist (SC): N/A — not a launch ticket.

## Screenshots

| Step | Filename |
|------|----------|
| 1 | `01-unified-world-zoom.png` |
| 2 | `02-city-interior-fade.png` |
| 3 | `03-brush-stamp-save.png` |
| 4 | `04-library-saga-parity.png` |

## Implementation Notes

- Files: `src/domains/world/map/atlas-camera.ts`, `src/domains/world/atlas/unified-canvas-doc.ts`, `src/app/world/atlas/unified/**`, `WorldAtlasWorkbench` + `useWorldAtlasEditor` canvas save path; gate `scripts/world-atlas-editor-check.mjs`
- Persist: `generator_meta.unifiedCanvas` (`sagatree-unified-atlas-v1`); auto-create `kind=world` root when only legacy exists
- `npm run test-gate` PASS (2026-10-17)
- Known limitations: Demo Eldoria is procedural sample; Leaflet kept in repo but not default UI; no PixiJS

## Composition Gate

- HEAD_SHA: e6e645bae8f47431a39d52f0f6488a2c67203c17
- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-world-atlas-editor.md`
