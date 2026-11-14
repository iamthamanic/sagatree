# ATL2-G05 Gate G — Phase G quality acceptance design

**Issue:** #1233  
**Epic:** #1196  
**Slug:** `atl2-g05`

## Purpose

Lock CLEAR evidence that G01–G04 are productively integrated before Phase H:
owner/player secret policy, shipping perf/memory budgets, adaptive workstation
UX, and golden visual regression — as host + domain protocol with a browser
wrapper, not a checkbox theatre.

## Binding interpretation

| Ticket phrase | Gate G meaning |
| --- | --- |
| Owner-/Player-Policy + Secret-Negativproben | Host stranger deny + active player membership crypt redaction (no client `playerView` flag); domain party projection |
| Performance- und Memory-Grenzen | `atlas-perf-budgets` fixtures + GPU session teardown / context-loss |
| Adaptive UI / Keyboard / Touch / Fallback | `atlas-workstation-adaptive` bands, gestures, surface states |
| Visual-Regression | G04 fingerprints + Browser E2E `toHaveScreenshot` (maxDiffPixelRatio 0.08) |

## Evidence artifacts

- Self-test: `scripts/atl2-g05-gate-g.self-test.mjs`
- Report: `.qa/runs/atl2-g05-gate-g.md` / `.json`
- Browser: `e2e/atl2-g05-gate-g.spec.ts`
- Composition: SKIPPED (protocol lock)
- Upstream CLEAR: `.qa/acceptance/atl2-g01.md` … `atl2-g04.md`

## Out of scope

- New product features beyond G01–G04 integration evidence
- Three.js product renderer (#1267–#1270)
- Closing Gate G without live host / Browser E2E contracts
