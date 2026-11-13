# ATL2-R01 — Renderer Reuse Matrix (Custom WebGL vs Three inventory)

**Issue:** #1266  
**Date:** 2026-11-14  
**Product SoT today:** `custom-webgl-prototype-runtime` (D01 / Gate D)

## Inventory

| Capability | Product Custom-WebGL | Three inventory (`AtlasSpatialViewport`) | Reuse for Three product swap? |
| --- | --- | --- | --- |
| Host mount | `AtlasNative3dEditor.tsx` → `mountAtlasPrototype3d` | Barrel export only; **not** in `UnifiedAtlasEditor` | N/A — would be new product mount (forbidden without GO) |
| GPU engine | `AtlasGL` in `atlas-prototype-runtime.mjs` | `THREE.WebGLRenderer` | **No** — different ownership / shader stack |
| Software fallback | `AtlasLite3D` + `graphicsPreset.lite` | None | **No** — must reimplement |
| Mesh builder | `MeshBuilder` (same file) | Ad-hoc `BoxGeometry` / `CircleGeometry` | **Partial** — algorithms only, not API |
| Heightfield terrain | Domain `atlas-heightfield.ts` + runtime `hfMesh` | Absent | **Domain reuse yes**; GPU path must port |
| Diorama look | Domain `atlas-diorama-look.ts` + runtime light profile | Absent | **Domain reuse yes**; GPU materials must port |
| Dungeon geometry | Runtime `buildDungeonGeometry` + domain dungeon modules | Minimal room boxes only | **Partial** — Forge domain reusable; GPU mesh no |
| Camera modes | Product ortho / diorama / perspective (D03) | Perspective + simple orbit | **Partial** — contracts in domain; Three camera rewrite |
| Input / tools | Prototype tools + Draufsicht SoT | Raycaster pick on ground plane | **No** for product tools |
| Persist bridge | `webgl-runtime-bridge.ts` ↔ `UnifiedCanvasDoc` | Props bound to doc; no controlled host seed | **Domain/doc reuse yes**; bridge is custom-WebGL shaped |
| Graphics presets | high / balanced / lite (D01) | None | **No** |
| Golden hierarchy | Product nav + controlled seed | Not wired | **No** without full product chrome port |

## Paths (authoritative)

| Role | Path |
| --- | --- |
| Product runtime | `src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs` |
| Product host | `src/app/world/atlas/unified/AtlasNative3dEditor.tsx` |
| Product composition | `src/app/world/atlas/unified/UnifiedAtlasEditor.tsx` |
| Parallel Three | `src/app/world/atlas/unified/AtlasSpatialViewport.tsx` |
| Decision domain | `src/domains/world/atlas/atlas-renderer-target.ts` |
| Doc ↔ runtime bridge | `src/domains/world/atlas/webgl-runtime-bridge.ts` |
| Heightfield | `src/domains/world/atlas/atlas-heightfield.ts` |
| Diorama | `src/domains/world/atlas/atlas-diorama-look.ts` |
| Historical Three-vs-Three PoC | `.qa/research/unified-atlas-renderer-comparison.md` |
| npm `three` | `package.json` → `three@0.186.1` (existing dep; avatars + inventory) |

## Shared-context note

A shared `WebGLRenderingContext` does **not** equal shared renderer ownership.
Custom `AtlasGL` and Three each own buffers/programs; co-mounting two product
paths risks dual geometry truth (ATL2-A01 / IV-01).
