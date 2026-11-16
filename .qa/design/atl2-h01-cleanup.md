# ATL2-H01 — Product atlas cleanup (non-destructive) — audit & decision log

**Issue:** #1234  
**Epic:** #1196  
**Slug:** `atl2-h01`  
**Audited base:** `main` @ `e11bdaa8d6` (after G05 #1233 / PR #1292)  
**Binding renderer decision:** ADR-ST-10 (`docs/architecture/ADR-ST-10-atl2-r01-custom-webgl-product-sot.md`) — NO-GO for a Three.js product backend; Custom WebGL (`AtlasGL` + `AtlasLite3D`) is the productive 3D owner.

## Scope interpretation

| Ticket phrase | H01 meaning under ADR-ST-10 |
| --- | --- |
| "doppelte Renderer bereinigen" | Prove exactly one productive 3D mount; **quarantine** (not delete) the Three inventory — ATL3-R01B #1296 re-evaluates its reuse |
| "Entfernen von AtlasGL/Custom-WebGL-GPU-Code" | **Not done.** Only allowed after a superseding GO-ADR (#1296) + R05 #1270 CLEAR + #1300 CLEAR on current HEAD |
| "unreferenzierte Legacy-Prototypen im produktiven Bundle" | Remove truly unreferenced legacy paths from the shipped bundle; keep reference material outside `public/` |
| "kanonischer Writer" | Prove a single atlas write path (app → host) and a controlled 3D mount (no localStorage SoT) |
| "ADR decision log" | Section below |

## Audit — inventory (src/app/world/atlas + src/domains/world/atlas)

| Path | Importers (product) | Verdict |
| --- | --- | --- |
| `unified/AtlasNative3dEditor.tsx` | `UnifiedAtlasEditor` (1 JSX mount, `controlled`) | **Productive 3D host** — keep |
| `unified/prototype3d/atlas-prototype-runtime.mjs` (`AtlasGL`, `AtlasLite3D`) | `AtlasNative3dEditor` | **Productive renderer** — keep (ADR-ST-10) |
| `unified/AtlasSpatialViewport.tsx` (Three.js) | none (was only barrel-exported) | **Quarantined**: barrel export removed, header marker added, file kept for #1296 |
| `WorldAtlasLeafletMap.tsx` (Leaflet + Geoman, #702) | none (0 references in repo) | **Removed** (retirement planned in `.qa/design/atl2-a01-parity-matrix.md` row 18 → #1234; `legacy_tiles` maps use `WorldMapEditorScreen`, unaffected) — superseded by Canvas2D `UnifiedAtlasEditor`; it only rendered the same `layers` model (no own data format, no migration needed) |
| `public/atlas-prototype-3d.html` (standalone v3 HTML prototype, own localStorage SoT) | none (README only) | **Moved** to `.qa/research/atlas-prototype-3d-reference.html` — no longer served at `/atlas-prototype-3d.html` in product builds |
| `unified/eldoria-scene.ts`, `procedural-eldoria.ts` | `UnifiedAtlasEditor` (demo maps only, labelled "nicht kanonisch") | Keep — live demo feature, product maps never use it |
| `WebglNavTreeActionHost.tsx`, `AtlasGoldenResetDialog.tsx`, `AtlasDefinePlacePanel.tsx`, `atlas-native-3d-look.ts` | Workbench / editor | Keep — productive |

## Audit — duplicate writes / state / toolbars

| Check | Result |
| --- | --- |
| Atlas writer | Only `useWorldAtlasEditor` calls `worldAtlasService.upsertMap`; only `world-atlas-service` calls `upsertHostWorldAtlasMap` (Host `PUT /atlas/maps`). Workbench uses the service read-only (`createSignedUrl`). |
| 3D persistence | Product mount is `controlled` → `onPersist` → `syncWebglPropsIntoCanvasDoc` → same writer. The runtime's localStorage branch is reachable only uncontrolled (no product mount). |
| Toolbars | 3D surface returns early (`surfaceMode === '3d'`) — the 2D tool rail is not rendered; the runtime tools live in the single "Werkzeuge" panel. Verified in Browser E2E (`e2e/atl2-h01-cleanup.spec.ts`). |
| Undo/Redo state | Host-owned per-map history (G05 fix) — one stack per map key, no competing stacks. |
| Module boundaries | `src/domains/**` imports neither `app/` nor `infrastructure/`. No `three` import in `src/app/world/atlas` outside the quarantined file. |
| Unused locals | `tsc --noUnusedLocals --noUnusedParameters` over the atlas app + domain folders: 0 findings. |

## Decision log

| # | Date | Decision | Reason | Reversal |
| --- | --- | --- | --- | --- |
| H01-1 | 2026-11-15 | Keep Custom WebGL (`AtlasGL`/`AtlasLite3D`) untouched | ADR-ST-10 NO-GO is binding; #1270/#1300 not CLEAR | New GO-ADR via #1296 + R05/#1300 CLEAR |
| H01-2 | 2026-11-15 | Quarantine `AtlasSpatialViewport` instead of deleting | #1294/#1296 explicitly evaluate reuse; deleting would pre-empt ATL3 | Re-export only with a GO-ADR |
| H01-3 | 2026-11-15 | `ATLAS_RENDERER_DECISION.retireParallelIn = 'atl2-h-cleanup'` is read as "quarantine in ATL2-H"; actual retirement/reuse is decided by ATL3-R01B #1296 | Value lives in `atlas-renderer-target.ts`, which open PR #1302 (V01) also edits — not changed here to avoid a competing renderer-file PR | Done in ATL3-R01B (#1296, ADR-ST-11): `retireParallelIn = 'atl3-r02-adapter'` — R02 deletes SpatialViewport |
| H01-4 | 2026-11-15 | Delete `WorldAtlasLeafletMap.tsx` | 0 references; second (legacy) 2D editor path; no own data format | `git revert` |
| H01-5 | 2026-11-15 | Move HTML prototype out of `public/` | Unreferenced legacy prototype shipped in the product bundle with its own localStorage SoT | Move back (not recommended) |
| H01-6 | 2026-11-15 | Keep `leaflet`, `react-leaflet`, `@geoman-io/leaflet-geoman-free`, `@types/leaflet` in `package.json` for now | Removing deps changes the lockfile — separate dependency PR (owner decision) | — |

## Evidence

- Self-test: `scripts/atl2-h01-cleanup.self-test.mjs` (wired in `npm run test-gate`)
- Browser E2E: `e2e/atl2-h01-cleanup.spec.ts` (desktop + tablet + phone viewports, host)
- Acceptance: `.qa/acceptance/atl2-h01.md`

## Out of scope

- Removing or replacing Custom WebGL; any Three.js product path (#1267–#1270, #1296)
- Documentation sync across all atlas docs (H02 #1235)
- Golden E2E journey (H03 #1236), release gate (H04 #1237)
