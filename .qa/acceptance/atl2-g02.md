# Feature: ATL2-G02 — Atlas rendering / memory / load / zoom budgets (#1230)

<!-- atlas-v2-epic: #1196; slice: G02; slug: atl2-g02 -->

## Intent

Große Karten und Dungeons bleiben responsiv: dokumentierte Budgets, messbare
Plan-Kosten, Context-Loss-/Map-Switch-Teardown ohne unbounded GPU-Handles —
Custom-WebGL only (kein Three.js-Produktiv-Switch; R01 NO-GO).

## Preconditions

- #1218 Gate D, #1223 Gate E, #1228 Gate F MERGED
- Productive 3D target: `custom-webgl-prototype-runtime`

## Happy Path

- [x] Fixtures small/medium/large + thresholds documented (`atlas-perf-budgets`)
- [x] Large dungeon plan meets instance/batch/coldPlanMs budgets (or fail-closed)
- [x] WebGL context-loss releases meshes; restore re-activates without handle leak
- [x] Map-switch / dispose session returns to 0 live handles after N cycles
- [x] Touched files: zero type escape hatches

## Edge Cases

- [x] Lite preset: lower maxInstances; preferSoftwareFallback
- [x] Truncation when geometry exceeds budget (look.counts.truncated)
- [x] Context lost → `data-atlas-webgl-lost`; restored → activate3D

## Security Coverage

- No new write surface; party secrets remain G01 host projection

## Imagination-First (IV)

- [x] **IV-01** Plans measure saved geometry only
- [x] **IV-02** Themes/budgets are atmospheric quality knobs

## Adaptive UI (AU)

- N/A chrome — perf domain + runtime teardown

## Composition Gate

- Verdict: CLEAR
- Proof: `.qa/runs/composition-gate-atl2-g02.md`

## Implementation Notes

- Domain: `src/domains/world/atlas/atlas-perf-budgets.ts`
- Runtime: AtlasGL.dispose + webglcontextlost/restored (ATL2-G02)
- Evidence: `scripts/atl2-g02-perf-budgets.self-test.mjs`
- Non-goals: guaranteed 60 FPS on every GPU; Three.js product path
