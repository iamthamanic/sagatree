# Atlas Gap Audit — after Golden Steps 2–6 (PR #1195 tip)

Date: 2026-11-11  
Plan: `.qa/design/atlas-golden-steps-2-6-pm.md`  
Progress: `.qa/runs/atlas-golden-steps-progress.md`

## Legend

| Tag | Meaning |
|-----|---------|
| **I** | Implemented in branch |
| **T** | Tested (self-test / test-gate and/or real editor) |
| **M** | Missing or only partial |

## Implemented + tested

| Area | I | T | Notes |
|------|---|---|-------|
| Product 3D/2D shows saved maps + pins (Step 1) | yes | yes | Prior commits; Draufsicht/3D browser |
| Coast polygons + Fläche tool (Step 2) | yes | yes | Self-test + browser Golden coasts + tool chrome |
| Locate tool / parentAnchor (Steps 3+4) | yes | yes | Self-test + browser Detailkarte→locate drag |
| Hierarchy create path (createChildMap / CreateWorldNodeDialog) | yes | yes | Existing product path; locate flow exercised |
| Golden child map domain seeds + canvases (Step 5 domain) | yes | yes | `atlas-golden-hierarchy.self-test` |
| Reset planner lists full Golden map seed chain (Step 6 plan) | yes | yes | `dornhain-golden-reset.self-test` |
| `resetToGolden` upserts child maps + re-parents Golden places | yes | unit only | Code in `useWorldAtlasEditor`; **editor E2E reset hang not cleared** |
| `npm run test-gate` on tip | — | yes | PASS after fingerprint refresh |

## Missing / incomplete (do **not** claim editor done)

| Gap | Severity | Notes |
|-----|----------|-------|
| Browser E2E: Golden reset restores Westmark hierarchy + drill with content | High | Dialog confirm did not finish in live session (HMR/host); needs re-verify |
| Host bootstrap `ensure-dornhain-default` seeds full hierarchy on fresh world | Medium | Reset path creates maps; cold bootstrap still world-root + flat places until reset |
| Rich Golden content per level (borders, dungeon generator, furniture density) | Medium | Minimum canvases only |
| Session wipe on `everything` | Low | Honest DE note when API absent (as designed) |
| PM name freeze (Kontinent/Land) | Low | Placeholders Westmark |
| Calibrated meters / Azgaar parity / procedural wizard | Out of scope | Per plan |
| Full cartography UX polish (undo stacks, multi-select, etc.) | Open | Not in Steps 2–6 |
| Stacked PR merge: #1194 → #1195 → main | Process | CI/Kodus still apply |

## Verdict

Steps **2–4** are implemented and editor-verified. Steps **5–6** domain + reset wiring are implemented and unit-gated; **full editor proof of hierarchy reset/drill remains open**. The cartography editor is **not** complete.
