# Unified Atlas — Renderer Architecture Comparison (measured)

**Date:** 2026-10-17  
**Branch:** `feat/unified-atlas-2d-3d-editor`  
**Evidence:** `.qa/evidence/unified-atlas-renderer-poc/`  
**Runner:** `node scripts/unified-atlas-renderer-poc-check.mjs`

---

## 1. Question

Which architecture better supports **bidirectional editable** 2D/3D map objects on one shared document:

| Variant | Stack |
|---------|--------|
| **A — Synchronized Hybrid** | Canvas2D map/brush surface + Three.js spatial mesh editor |
| **B — Unified Three.js** | Single Three.js scene (ortho top-down ↔ perspective) + canvas texture brush plane |

Both variants used the **same editable document** (UnifiedCanvasDoc semantics) and the **identical 10-step test case**.

---

## 2. Test environment (measured, not theoretical)

| Field | Value |
|-------|-------|
| OS | darwin arm64 |
| Node | v22.22.3 |
| Browser | HeadlessChrome 156.0.8078.4 (Playwright Chromium) |
| Viewport | 1440 × 900 |
| Measured at | 2026-10-17T09:13:34.620Z (see `results.json`) |

---

## 3. Identical test case (both variants PASS)

1. Place building in 2D  
2. View building in 3D (height present)  
3. Move building in 3D  
4. Change footprint in 2D  
5. Open dungeon rooms  
6. Change wall in top-down  
7. Verify wall in 3D doc  
8. Add object in 3D  
9. Verify in 2D  
10. Serialize + restore  

Additional: **bidirectional edit proof** (move in one view, assert same coordinates in the other).

Screenshots:

- `.qa/evidence/unified-atlas-renderer-poc/screenshots/poc-a-hybrid-1440.png`
- `.qa/evidence/unified-atlas-renderer-poc/screenshots/poc-b-unified-1440.png`

---

## 4. Measured results

Source: `.qa/evidence/unified-atlas-renderer-poc/results.json`

| Metric | A Hybrid | B Unified Three |
|--------|----------|-----------------|
| Logical 10-step PASS | yes | yes |
| Bidirectional edit PASS | yes | yes |
| Logical ops ms | 7.7 | 0.2 |
| Frame median ms (rebuild+raf ×45) | **76.5** | 78.2 |
| Frame p95 ms | 82.6 | **82.1** |
| JS heap used (MB, Chrome) | **14.3** | 15.2 |
| Brush batch 80 stamps (ms) | n/a (native 2D path) | 7.7 |

Node-only logical harness (no GPU): **0.464 ms**, 1015 bytes serialized sample world.

---

## 5. Qualitative comparison

| Criterion | A Hybrid | B Unified | Winner |
|-----------|----------|-----------|--------|
| Implementierungsaufwand vs. bestehendem Atlas | Reuses Canvas2D tools; adds Three viewport | Must port brushes/stamps/LOD art to Three | **A** |
| Bearbeitbarkeit 2D↔3D | Proven in PoC + product `AtlasSpatialViewport` | Proven in PoC | Tie (both OK) |
| Texture brush complexity | Existing stroke pipeline unchanged | Requires CanvasTexture upload / UV mapping | **A** |
| Camera / transform accuracy | Shared world XY; 3D uses Y-up plane pick | Shared world XZ; ortho/persp switch | Tie |
| Integration with `unifiedCanvas` / Supabase | Direct | Direct | Tie |
| Wartbarkeit | Two renderers, one doc — clear boundary | One renderer, more internal modes | Slight **B** |
| Mobile | Canvas2D already adaptive; Three optional | Always WebGL | Slight **A** |
| Library reuse | `three` already in repo (avatars) | same | Tie |
| Lizenz | MIT Three + SagaTree | same | Tie |

---

## 6. Decision

**Adopt Variant A — Synchronized Hybrid** as the product architecture.

### Why

1. Both variants **meet** the editable 2D/3D requirement on the shared model.  
2. Frame cost is **within noise** on this sample (A slightly faster median).  
3. Hybrid **preserves** the existing production Canvas2D brush/LOD/Eldoria path without a forced port.  
4. Three.js is used where it adds value: **spatial picking, extrusion, orbit-ready geometry** — not as a rewrite of world painting.  
5. Product goal is a **shared editable world model**, not a single renderer for its own sake.

### Rejected / deferred

- **Full rewrite to Unified Three only:** not justified by measured gains; high brush-port risk.  
- **3D viewer-only (non-editable):** fails product requirement — not considered a valid option.

### Remaining complexity

- Keep Canvas2D and Three in sync via `applyMapEdit` / `UnifiedCanvasDoc` only (no dual object stores).  
- Nested DB map LOD still incomplete (demo Eldoria vs `parent_map_id`) — tracked in design doc.  
- Dungeon Forge render showcase **not** imported; generation algorithm extracted to domain.

---

## 7. How to reproduce

```bash
node scripts/unified-atlas-renderer-poc-check.mjs
```

Serves PoC HTML from `.qa/evidence/unified-atlas-renderer-poc/`, runs Playwright, writes `results.json`.
