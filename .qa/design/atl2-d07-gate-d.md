# ATL2-D07 Gate D — Phase D product 3D acceptance design

**Issue:** #1218  
**Epic:** #1196  
**Slug:** `atl2-d07`

## Purpose

Lock CLEAR evidence that D01–D06 are productively integrated: same Saved Maps in
2D Draufsicht and product 3D (custom WebGL `AtlasGL` + `AtlasLite3D`), with camera
modes, terrain, and diorama look — without adopting Three.js as product SoT.

## Binding interpretation

| Ticket phrase | Gate D meaning |
| --- | --- |
| “echte Three.js-Geometrie” | echte **produktive 3D-Geometrie** aus Saved Maps on locked custom WebGL |
| “Renderer-Konsolidierung” | single product path (`AtlasNative3dEditor` → prototype-runtime); parallel Three inventory-only |
| “Kamera / Terrain / Parität” | D03–D05 contracts + host persist/reload + 2D/3D SoT sync via UnifiedCanvasDoc |

See `.qa/design/atl2-renderer-architecture-audit.md` (no architecture flip without parity ADR).

## Evidence artifacts

- Self-test: `scripts/atl2-d07-gate-d.self-test.mjs`
- Report: `.qa/runs/atl2-d07-gate-d.md` / `.json`
- Browser: `e2e/atl2-d07-gate-d.spec.ts`
- Composition: SKIPPED (protocol lock)

## Out of scope

- Separate demo website as release gate
- Migrating product chrome to `AtlasSpatialViewport` / `three` npm
- Phase E narrative / Nav slices
