# Feature: ATL2-H01 — Product-atlas cleanup after functional parity (#1234)

<!-- atlas-v2-epic: #1196; slice: H01; slug: atl2-h01 -->

## Intent

Non-destructive cleanup of the product atlas: one productive renderer, one canonical writer,
no unreferenced legacy prototypes in the shipped bundle — under the binding NO-GO ADR-ST-10
(Custom WebGL stays productive; Three inventory is quarantined for ATL3-R01B #1296).

## Preconditions

- G05 #1233 merged (`main` @ e11bdaa8)
- ADR-ST-10 NO-GO in force; #1270 / #1300 not CLEAR ⇒ no Custom-WebGL GPU code removal

## Happy Path

- [x] Every productive atlas entry uses exactly one 3D renderer (`custom-webgl-prototype-runtime`) via one `AtlasNative3dEditor` mount (controlled) and one canonical writer (`useWorldAtlasEditor` → `worldAtlasService.upsertMap` → Host PUT)
- [x] No double toolbar in 3D (2D tool rail absent; runtime tools in one "Werkzeuge" panel) — Browser E2E
- [x] Three inventory `AtlasSpatialViewport` quarantined: not imported, not barrel-exported, kept for #1296
- [x] Unreferenced legacy Leaflet/Geoman editor removed; standalone HTML prototype moved out of `public/`
- [x] `AtlasGL` / `AtlasLite3D` / software fallback untouched (ADR-ST-10)
- [x] Architecture boundary audit (domains ↛ app/infrastructure) + ADR decision log (`.qa/design/atl2-h01-cleanup.md`)
- [x] ARCH / typed-strict / test-gate and editor/renderer/hierarchy regressions green
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout)

## Edge Cases

- [x] Old maps: no data format removed (Leaflet editor wrote the same `layers` model)
- [x] Low-End-GPU: `AtlasLite3D` fallback unchanged
- [x] Phone / tablet / desktop: Browser E2E viewport matrix shows one renderer + one tool panel

## Gates

- `node scripts/atl2-h01-cleanup.self-test.mjs`
- `npm run test-gate`, `npm run lint`, `npm run typecheck`, `npm run composition-gate`
- Browser E2E (host): `e2e/atl2-h01-cleanup.spec.ts`; regression `e2e/atl2-g05-gate-g.spec.ts`
