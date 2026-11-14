# Feature: ATL2-G05 Gate G — Security, Performance, A11y & Visual Quality (#1233)

<!-- atlas-v2-epic: #1196; slice: G05; slug: atl2-g05 -->

## Intent

Independent host + domain + browser evidence that Phase G (G01–G04) delivers
release-ready atlas quality: owner/player secret policy, shipping perf/memory
budgets, adaptive UI/keyboard/touch/fallback states, and golden visual
regression — without closing the gate on self-tests alone.

## Preconditions

- #1229 G01, #1230 G02, #1231 G03, #1232 G04 MERGED to `main`
- Host Better Auth available for Browser E2E (`browser-e2e-with-host`)
- Productive 3D target remains `custom-webgl-prototype-runtime` (R01 NO-GO)

## Happy Path

- [x] PR stack G01–G04 present on `main` (documented squash SHAs)
- [x] Owner/GM full maps; active player membership strips secrets without client `playerView` flag (SC-03)
- [x] Stranger atlas write denied (`42501` / 403)
- [x] Perf fixtures + GPU teardown / context-loss budgets met (no unbounded leak)
- [x] Adaptive bands, critical controls, gestures, surface states documented
- [x] Golden visual fingerprints + Browser E2E `toHaveScreenshot` contract locked
- [x] Gate report `.qa/runs/atl2-g05-gate-g.md` CLEAR with Soll/Ist table
- [x] Browser wrapper opens Dornhain atlas workstation (device matrix evidence)
- [x] HOST Browser E2E measures the productive Custom-WebGL atlas (no synthetic plan costs):
  rAF frame p50/p95 on real Golden maps (Taverne / Dornhain / Welt), 8× map-switch soak with
  bounded mesh slots, WebGL context loss → restore with identical mesh set, JS-heap growth,
  three camera modes + zoom/orbit deltas, desktop / tablet / phone matrix
  (`.qa/evidence/atl2-g05-gate-g/browser-measurement.json`)
- [x] Fail-closed rows: any FAIL fails the test; NOT_RUN never counts as PASS
  (only `js-heap-soak` may be NOT_RUN where `performance.memory` is absent)
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout)

## Edge Cases

- [x] Party dungeon meta: atmospheric `themeKey` only (no seed / dirty)
- [x] Context-loss → release handles; restore re-activates within budget
- [x] Context restore re-uploads product geometry + ocean (defect found by Gate G: stale
  `productGeomFingerprint` / `oceanCache` left product maps blank after restore — fixed in `activate3D`)
- [x] Software WebGL (SwiftShader / llvmpipe) detected via `WEBGL_debug_renderer_info` and judged
  against the documented 120 ms CI ceiling; hardware budget stays G02 `frameP95MsSoft` 33.3 ms
- [x] Narrow main pane / phone band fail-closed chrome overflow
- [x] Missing PNG baseline / pixel-diff mismatch fail-closed (G04 e2e)

## Security Coverage

- SC-01 Owner-scoped writes (`canEditWorld` / 42501)
- SC-02 Party projection server-side (`playerView` + store redaction)
- SC-03 No elevated origins inventable from client `playerView=false` when non-editor
- Imagination-First **IV-01/02**: secrets not reconstructed from atmospheric theme

## Imagination-First (IV)

- [x] **IV-01** Visuals measure saved geometry only; party redaction preserves authority
- [x] **IV-02** Themes / selection chrome / motion are atmospheric quality knobs

## Adaptive UI (AU)

- [x] **AU-CONTENT-WIDTH** / phone–tablet–desktop bands (G03)
- [x] Touch target floor 44px; keyboard shortcuts per band
- [x] Device matrix: desktop Browser E2E + G04 mobile viewport captures

## Composition Gate

SKIPPED — acceptance protocol / evidence lock; no new hop
(see `.qa/runs/composition-gate-atl2-g05.md`)

## Implementation Notes

- Protocol: `scripts/atl2-g05-gate-g.self-test.mjs` → `.qa/runs/atl2-g05-gate-g.md`
- Browser wrapper + measurement: `e2e/atl2-g05-gate-g.spec.ts`
- Screenshot naming: `g05__<world>-<map>__map-<atlasMapId>__<camera>__<buildSha>__<preset>-<renderer>__<viewport>.png` (full atlas map id)
- Integration note: single G05 owner PR (#1292); unique browser measurement intent ported from #1293
  without its runtime test hooks, domain module or migration-inventory churn
- Known limitation: CI numbers are software-rendering measurements — re-measure p50/p95 on real GPUs
- Design: `.qa/design/atl2-g05-gate-g.md`
- Stitches G01–G04 evidence; does not re-implement product features
- Non-goals: Three.js product path (#1267–#1270); subjective taste sign-off
