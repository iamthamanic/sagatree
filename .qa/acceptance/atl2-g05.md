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
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout)

## Edge Cases

- [x] Party dungeon meta: atmospheric `themeKey` only (no seed / dirty)
- [x] Context-loss → release handles; restore re-activates within budget
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
- Browser wrapper: `e2e/atl2-g05-gate-g.spec.ts`
- Design: `.qa/design/atl2-g05-gate-g.md`
- Stitches G01–G04 evidence; does not re-implement product features
- Non-goals: Three.js product path (#1267–#1270); subjective taste sign-off
