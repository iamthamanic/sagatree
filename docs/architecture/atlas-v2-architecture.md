# Atlas V2 — canonical architecture & documentation index (ATL2)

- **Status:** Normative for ATL2 (Epic [#1196](https://github.com/iamthamanic/sagatree/issues/1196)); maintained by ATL2-H02 [#1235](https://github.com/iamthamanic/sagatree/issues/1235)
- **Last synced:** 2026-11-15 against `main` @ `e11bdaa8` + ATL2-H01 [#1234](https://github.com/iamthamanic/sagatree/issues/1234) (PR #1304)
- **Renderer source of truth:** [ADR-ST-10](./ADR-ST-10-atl2-r01-custom-webgl-product-sot.md) (NO-GO for a Three.js product backend)

If any other document contradicts this page or ADR-ST-10, this page and ADR-ST-10 win for ATL2.
Historical documents are **not rewritten**; they carry a status banner pointing here.

## 1. Actually active architecture (ATL2 baseline)

| Concern | Productive owner | Code |
| --- | --- | --- |
| Canonical map model | `UnifiedCanvasDoc` (`sagatree-unified-atlas-v1`) persisted in `world_atlas_maps.generator_meta.unifiedCanvas` (Host SQLite, revisioned) | `src/domains/world/atlas/unified-canvas-doc.ts`, `atlas-revision-contract.ts` |
| Hierarchy / navigation | WorldNodes + primary map links, six levels (Welt → Kontinent → Land → Ort → Gebäude/Dungeon → Raum) | `atlas-hierarchy-nav.ts`, `atlas-hierarchy-lod.ts`, `map-frame.ts` |
| 2D authoring (Draufsicht) | **Canvas 2D** in `UnifiedAtlasEditor` | `src/app/world/atlas/unified/UnifiedAtlasEditor.tsx` |
| 3D view + 3D editing | **Custom WebGL** — `AtlasGL` (GPU) + `AtlasLite3D` (software / low-end fallback) | `src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs`, host `AtlasNative3dEditor.tsx`; target `ATLAS_PRODUCT_3D_TARGET = 'custom-webgl-prototype-runtime'` in `src/domains/world/atlas/atlas-renderer-target.ts` |
| 3D ↔ doc bridge | Controlled mount → `onPersist` → `syncWebglPropsIntoCanvasDoc` | `src/domains/world/atlas/webgl-runtime-bridge.ts` |
| Canonical writer | `useWorldAtlasEditor` → `worldAtlasService.upsertMap` → Host `PUT /api/v1/worlds/:id/atlas/maps` | `src/app/world/atlas/useWorldAtlasEditor.ts`, `src/infrastructure/world/world-atlas-service.ts` |
| Dungeon generation | Seeded Dungeon Forge port (preview → commit → reforge) | `dungeon-generator.ts`, `dungeon-grid.ts`, `dungeon-forge-workflow.ts`, `atlas-dungeon-look.ts` |
| Terrain / look | Heightfield, terrain mesh LOD, diorama look, camera modes (ortho-topdown / diorama-oblique / perspective) | `atlas-heightfield.ts`, `atlas-terrain-mesh.ts`, `atlas-diorama-look.ts`, `atlas-product-camera.ts` |
| Permissions | Host owner-scope; player projection strips GM secrets | `party-map-projection.ts`, Host atlas routes |

**Not productive (inventory / quarantine):** `src/app/world/atlas/unified/AtlasSpatialViewport.tsx` (Three.js) — not mounted, not barrel-exported (ATL2-H01). The npm package `three` is used by avatars/LiveAct, not by the atlas product path.

### Earlier Three.js intent (history, preserved)

Epic #1196 and Gate D #1218 originally named **Three.js** as the 3D projection. ATL2-D01 (#1212) shipped the Custom-WebGL runtime instead, and ATL2-R01 (#1266, PR #1273) measured both options and decided **NO-GO** for a Three.js product backend (`.qa/design/atl2-r01-renderer-decision.md`). Therefore the follow-on slices **R02–R05 (#1267, #1268, #1269, #1270) are closed `not_planned`** — they were never implemented, by decision, not by omission. Gate D was accepted on the Custom-WebGL stack (`.qa/design/atl2-renderer-architecture-audit.md`).

## 2. Future development (ATL3 — not fulfilled, not part of ATL2)

| Issue | Role | ATL2 status |
| --- | --- | --- |
| [#1294](https://github.com/iamthamanic/sagatree/issues/1294) | ATL3 Epic — Procedural Fantasy Rendering (Three.js, materials, satellite view) | open — future |
| [#1295](https://github.com/iamthamanic/sagatree/issues/1295) | ATL3-V01 visual quality contract + golden scenes | open — future (separate workstream) |
| [#1296](https://github.com/iamthamanic/sagatree/issues/1296) | ATL3-R01B — new Three.js visual PoC; may supersede ADR-ST-10 | open — future |
| [#1267](https://github.com/iamthamanic/sagatree/issues/1267)–[#1270](https://github.com/iamthamanic/sagatree/issues/1270) | R02–R05 Three.js migration + Gate R | closed `not_planned`; reactivated **only** after a GO-ADR from #1296 |
| [#1297](https://github.com/iamthamanic/sagatree/issues/1297) / [#1298](https://github.com/iamthamanic/sagatree/issues/1298) / [#1299](https://github.com/iamthamanic/sagatree/issues/1299) | Procedural materials / geometry+LOD / satellite camera | open — future, conditional on GO |
| [#1300](https://github.com/iamthamanic/sagatree/issues/1300) | ATL3-Q01 independent quality + renderer-retirement gate | open — future |
| [#1301](https://github.com/iamthamanic/sagatree/issues/1301) | Tile/LOD streaming feasibility (P2) | open — study only |

Rules until then: Custom WebGL stays productive; no second productive 3D mount; `AtlasGL` / `AtlasLite3D` may be removed only after a superseding GO-ADR **and** R05 #1270 CLEAR **and** #1300 CLEAR on the current HEAD. A later Three.js cutover updates this page in a **separate** ATL3 integration/release PR — ATL2 docs must not anticipate it.

## 3. Normative document index

| Document | Scope |
| --- | --- |
| `AGENTS.md` | Repo workflow, gates, contracts (mandatory) |
| `docs/architecture/ADR-ST-10-atl2-r01-custom-webgl-product-sot.md` | Renderer SoT (binding) |
| `docs/architecture/atlas-v2-architecture.md` | This index |
| `docs/concepts/imagination-first-visualization-contract.md` | IV-* gates (map as spatial aid, no invented geography) |
| `docs/concepts/adaptive-ui-experience-contract.md` | AU-* gates (device bands, touch, recomposition) |
| `.qa/design/atl2-r01-renderer-decision.md` | Measured R01 ADR detail |
| `.qa/design/atl2-r01-reuse-matrix.md` | Custom WebGL vs Three inventory reuse matrix |
| `.qa/design/atl2-renderer-architecture-audit.md` | "Three.js" epic wording vs product WebGL |
| `.qa/design/atl2-a01-parity-matrix.md` | Phase A inventory / parity matrix |
| `.qa/design/atl2-h01-cleanup.md` | H01 cleanup audit + decision log |
| `.qa/acceptance/atl2-*.md` | Per-slice acceptance (A01–H01) |
| `src/domains/world/atlas/THIRD_PARTY_DUNGEON_FORGE.md` | Dungeon Forge (MIT) attribution |

### Superseded / historical (banner added, content preserved)

| Document | Why historical |
| --- | --- |
| `.qa/design/world-atlas-editor.md`, `.qa/acceptance/world-atlas-editor.md` | Leaflet/Geoman path described as "kept in repo" — removed in ATL2-H01 |
| `.qa/design/unified-atlas-2d-3d-editor.md`, `.qa/acceptance/unified-atlas-2d-3d-editor.md` | 2026-10 "Hybrid Canvas2D + Three.js" design — superseded by D01 / ADR-ST-10 |
| `.qa/research/unified-atlas-renderer-comparison.md` | Three-vs-Three PoC (prior art only) |
| `.qa/design/atl2-d01-renderer-decision.md` | Still valid; inventory row now "quarantined, not barrel-exported" |

## 4. Golden data (reproducible)

| Item | Source |
| --- | --- |
| Golden world seed | `dornhain.unified.v4` (`DORNHAIN_WORLD_MAP_SEED`) |
| Golden maps (FE domain) | `src/domains/world/atlas/dornhain-golden-hierarchy.ts` — Kontinent Westmark → Land Westmark → Dornhain → Taverne Zum Flüstern / Krypta unter dem Hügel (names are placeholders until PM freeze) |
| Host seed mirror | `server/src/bootstrap/dornhain-golden-hierarchy-seed.ts` (no FE imports — architecture boundary) |
| Reset to Golden | `src/domains/world/atlas/dornhain-golden-reset.ts` (modes `atlas` / `atlas_places` / `everything`), UI `src/app/world/atlas/AtlasGoldenResetDialog.tsx` |
| Golden visual fixtures | `src/domains/world/atlas/atlas-golden-visual.ts` (`atl2-golden-visual-v1`), baselines `e2e/atl2-g04-golden-visual.spec.ts-snapshots/`, capture `scripts/atl2-g04-capture-baselines.mjs` |
| Gate G host measurements | `.qa/evidence/atl2-g05-gate-g/browser-measurement.json` (software WebGL; build SHA inside the file) |

Golden screenshots and measurements are valid only when produced by the real host browser run (`scripts/browser-e2e-with-host.mjs`) on a named commit SHA; software-WebGL numbers are labelled as such and are not hardware budgets.

## 5. Test commands

| Purpose | Command |
| --- | --- |
| All unit/self-test/contract gates | `npm run test-gate` |
| Type-safety lint / typecheck | `npm run lint`, `npm run typecheck` |
| Composition gate | `npm run composition-gate` |
| Host Browser E2E, full suite as in CI (ephemeral host + SQLite + Better Auth) | `npm run test:e2e` (= `node scripts/browser-e2e-with-host.mjs`) |
| Host Browser E2E, single spec | `npm run test:e2e -- e2e/atl2-h01-cleanup.spec.ts --project=chromium` (args forwarded to Playwright since ATL2-H02) |
| Device matrix (phone / tablet) | `npm run test:e2e -- e2e/golden-mobile-journeys.spec.ts e2e/adaptive-ui-quality.spec.ts --project=mobile-chrome --project=tablet-chrome` |
| Atlas gate specs | `e2e/atl2-a04-gate-a.spec.ts`, `e2e/atl2-c06-gate-c.spec.ts`, `e2e/atl2-d07-gate-d.spec.ts`, `e2e/atl2-e05-gate-e.spec.ts`, `e2e/atl2-g04-golden-visual.spec.ts`, `e2e/atl2-g05-gate-g.spec.ts`, `e2e/atl2-h01-cleanup.spec.ts` |

## 6. Certification checklist (per gate)

A gate counts as CLEAR only if its evidence is reproducible on the current HEAD — an old PR description or a closed issue is not evidence.

| Gate | Issue | Acceptance | Self-test | Report |
| --- | --- | --- | --- | --- |
| A | #1200 | `.qa/acceptance/atl2-a04-gate-a.md` | `scripts/atl2-a04-gate-a.self-test.mjs` | `.qa/runs/atl2-a04-gate-a.md` |
| B | #1205 | `.qa/acceptance/atl2-b05-gate-b.md` | `scripts/atl2-b05-gate-b.self-test.mjs` | `.qa/runs/atl2-b05-gate-b.md` |
| C | #1211 | `.qa/acceptance/atl2-c06-gate-c.md` | `scripts/atl2-c06-gate-c.self-test.mjs` | `.qa/runs/atl2-c06-gate-c.md` |
| D | #1218 | `.qa/acceptance/atl2-d07-gate-d.md` | `scripts/atl2-d07-gate-d.self-test.mjs` | `.qa/runs/atl2-d07-gate-d.md` |
| E | #1223 | `.qa/acceptance/atl2-e05.md` | `scripts/atl2-e05-gate-e.self-test.mjs` | `.qa/runs/atl2-e05-gate-e.md` |
| F | #1228 | `.qa/acceptance/atl2-f05.md` | `scripts/atl2-f05-gate-f.self-test.mjs` | (in acceptance) |
| G | #1233 | `.qa/acceptance/atl2-g05.md` | `scripts/atl2-g05-gate-g.self-test.mjs` | `.qa/runs/atl2-g05-gate-g.md` |
| H | #1234–#1237 | `.qa/acceptance/atl2-h01.md`, `.qa/acceptance/atl2-h02.md` (H03/H04 pending) | `scripts/atl2-h01-cleanup.self-test.mjs`, `scripts/atl2-h02-docs-sync.self-test.mjs` | — |

## 7. Migration / upgrade notes

- **Legacy Leaflet editor removed** (H01): no data migration — it edited the same `layers` FeatureCollection; `legacy_tiles` maps keep using `WorldMapEditorScreen`.
- **HTML prototype** moved from `public/atlas-prototype-3d.html` to `.qa/research/atlas-prototype-3d-reference.html` — the URL `/atlas-prototype-3d.html` no longer serves it.
- **WebGL direct writes retired** (B04, `atlas-webgl-write-retire.ts`): the 3D runtime persists only through the controlled bridge into `UnifiedCanvasDoc`.
- **3D Undo/Redo** (G05 fix): history is host-owned per map and survives runtime rebuilds; it is session-local (not persisted).
- Unused npm deps `leaflet`, `react-leaflet`, `@geoman-io/leaflet-geoman-free`, `@types/leaflet` remain in `package.json` pending a separate dependency PR.
