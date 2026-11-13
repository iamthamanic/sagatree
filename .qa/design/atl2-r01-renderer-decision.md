# ATL2-R01 ADR — Custom-WebGL vs incremental Three.js product backend

**Issue:** #1266  
**Slug:** `atl2-r01-renderer-decision`  
**Date:** 2026-11-14  
**Supersedes for R02–R05 gate only:** does **not** rewrite D01 product lock unless GO

## Options

| Id | Description |
| --- | --- |
| A | **Keep** productive Custom-WebGL (`AtlasGL` + `AtlasLite3D`); quarantine Three inventory |
| B | **Incremental** Three.js 3D backend swap (reuse domain + `three@0.186.1`; no big-bang) |
| C | Full rewrite / dual productive mounts | **Rejected** (Non-Goal) |

## Measured comparison (R01 PoC)

Protocol: identical viewport 1280×720, headless Chromium, same fixture object count,
45 RAF samples after warm-up. Evidence:
`.qa/evidence/atl2-r01-renderer-poc/results.json` +
`scripts/atl2-r01-renderer-decision.self-test.mjs`.

| Metric | Custom-WebGL (product runtime mount) | Three inventory-style prototype |
| --- | --- | --- |
| Logical fixture load | PASS | PASS |
| Frame p50 (ms) | 16.7 | 16.7 |
| Frame p95 (ms) | 42.6 | 20.4 |
| JS heap (MB) | 9.54 | 9.54 |
| Software fallback | AtlasLite3D available | **missing** |
| Heightfield / diorama / product camera presets | present in product path | **missing** in SpatialViewport inventory |

p95 favors the thin Three inventory scene, but that scene lacks product capabilities
(lite fallback, heightfield, diorama, camera presets, tool/nav chrome). Equal p50 and
incomplete parity ⇒ **not** a decisive win for a product backend swap.

Historical 2026-10-17 Hybrid vs Unified-Three PoC measured **two Three architectures**,
**not** product Custom-WebGL vs Three — cited only as prior art
(`.qa/research/unified-atlas-renderer-comparison.md`).

## Benefits / risks

| | Option A (keep Custom) | Option B (incremental Three) |
| --- | --- | --- |
| Nutzen | Preserve Gate D / D02–D06 / E02 / F02 investment; lite fallback | Shared ecosystem with avatars; potential material tooling |
| Migration risk | Low | High — MeshBuilder, heightfield GPU, diorama, camera modes, tools, bridge |
| Dual SoT risk | None if SpatialViewport stays inventory | High if product chrome mounts both |
| Maintenance | One productive owner (already) | Port cost before any net GPU win proven |

## Decision — **NO-GO** (Option A)

**Verdict:** `NO-GO` for R02–R05 incremental Three.js **product** backend adoption.

### Why

1. Productive path is already Custom-WebGL with measured Gate D CLEAR and Phase D
   features locked on `atlas-prototype-runtime.mjs`.
2. `AtlasSpatialViewport` is ~300 LOC inventory vs ~1700 LOC product runtime and
   lacks heightfield, diorama, graphics presets, and AtlasLite3D fallback
   (reuse matrix).
3. R01 PoC does **not** show a decisive frame/heap win that offsets migration risk.
4. Epic #1196 “Three.js” wording remains satisfied as **product 3D projection of
   Saved Maps** per `.qa/design/atl2-renderer-architecture-audit.md` — library swap
   is not mandatory.

### Single productive 3D owner

`custom-webgl-prototype-runtime` via `AtlasNative3dEditor` →
`atlas-prototype-runtime.mjs` (`ATLAS_PRODUCT_3D_TARGET`).

### Rollback

Unchanged from D01: Draufsicht authoring SoT; 3D controlled seed / lite fallback.
Do **not** mount SpatialViewport as product chrome.

### Consequences for R02–R05

- Issues #1267–#1270 must be closed `not_planned` / deferred unless a **future**
  ADR with full parity CLEAR supersedes this NO-GO.
- Completing #1266 does **not** auto-greenlight those tickets.
- Parallel Three inventory remains cleanup candidate for ATL2-H (#1234).

## IV

- **IV-01** Authority: PoC/fixture read-only; no invented geography.
- **IV-18** Canonical linkage: product persist remains Host `generator_meta` /
  `UnifiedCanvasDoc` — PoC is not a write path.
