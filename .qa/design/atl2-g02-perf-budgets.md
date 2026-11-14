# Design — ATL2-G02 Atlas Perf Budgets (#1230)

## Problem

Große Atlas-Karten brauchen nachprüfbare Limits für Frame-Zeit, Cold-Load,
Draw Calls und Speicher. Subjektive „60 FPS überall“-Ziele sind Non-Goals.

## Solution

Pure-domain `atlas-perf-budgets.ts`:

1. **Fixtures** `ATLAS_PERF_SCENE_FIXTURES` — small / medium / large
2. **Budgets** `atlasPerfBudgetFor(scene, preset)` — skaliert nach Szene + Graphics-Preset
3. **Evaluate** `evaluateAtlasPerfBudget` — Violations-Liste
4. **Degrade** `suggestAtlasPerfDegrade` — high → balanced → lite
5. **Resource session** allocate / dispose / context-loss / map-switch stress

CI uses deterministic draw-call estimates (`estimateAtlasPerfDrawCalls`) so the
release cell `large`×`lite` stays gated without a live GPU.

## Reference hardware

`ATLAS_PERF_REFERENCE_HARDWARE_DE` — Desktop Chromium, entry discrete / iGPU,
1080p, power-save off. Interprets budgets; not a CI GPU probe.

## Composition

Editor mount → graphics preset → (future) runtime observation → evaluate / degrade.
Resource session pairs with mount `dispose` / context-loss handlers in the product
3D host (`AtlasNative3dEditor` / prototype runtime).
