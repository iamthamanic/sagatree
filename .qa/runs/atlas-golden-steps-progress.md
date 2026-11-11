# Atlas Golden Steps 2–6 — Progress Log

Plan: `.qa/design/atlas-golden-steps-2-6-pm.md`  
Branch (work): `feat/atlas-3d-product-terrain` (Step 1 already on tip)  
Base Golden: `feat/dornhain-golden-atlas-v4` / PR [#1194](https://github.com/iamthamanic/sagatree/pull/1194)

## Status board

| Step | Status | Branch / PR | Notes |
|------|--------|-------------|-------|
| 1 · 3D/2D echte Karte + Pins | done | `feat/atlas-3d-product-terrain` | No open PR yet at last check |
| 2 · Küstenpolygone + Fläche zeichnen | done (commit pending) | same branch → PR stacked on #1194 | test-gate PASS; browser OK |
| 3+4 · Hierarchie + Ausschnitt verorten | pending | | |
| 5+6 · Golden-Content + Reset-Kette | pending | | |
| Gap-Audit | pending | | after 2–6 |

## Open PM decisions (do not block Step 2)

1. Kontinent- / Land-Namen for Golden hierarchy (Step 5)
2. Seed bump v4 in-place vs v5 auto-upgrade (prefer v4 shape-in-place for blank/golden)

## Verification log

### 2026-11-11 — kickoff

- Checked git: on `feat/atlas-3d-product-terrain`, clean except untracked PM md.
- Step 1 commits present (`4e5a655fd` feat + fingerprint + composition).
- PR #1194 open; Test Gate green; ECC / Browser E2E / Kodus failing (tracked separately — do not silently drop Step work).
- No duplicate polygon/`area` tool in tree yet; `UnifiedCanvasRoom` still rect-only.

### Step 2

- Acceptance: `.qa/acceptance/atlas-coast-polygons-area-tool.md`
- Composition: `.qa/runs/composition-gate-atlas-coast-polygons-area-tool.md` (SKIPPED for HEAD)
- Implementation:
  - Domain: `canvas-polygon.ts`, optional `points` on rooms, `roomFromPolygon` / area tool, pick+move, registry + webgl bridge
  - Seed: Golden v4 continents as polygons (FE starter + host `ensure-dornhain-default`)
  - UI: Fläche tool 2D (click/dblclick/Enter/Esc) + 3D (runtime area draft); soft coast outline for polygons in Draufsicht
  - Self-test: `scripts/atlas-coast-polygons.self-test.mjs` wired into test-gate
  - Fingerprints: edge/infra source contracts refreshed; MIG-002 inventory hash pinned
- Browser editor (`SA-RR25A`, host ~8787 / Vite ~3004):
  - Golden reset → polygon coasts visible in 3D + Draufsicht
  - Fläche tool present in both chrome rails; help copy OK
  - Note: `productAreaDraft` not externally inspectable; evidence = UI + self-tests
- test-gate: PASS (`npm run test-gate`, 2026-11-11)
- stack-migration-prep-check: PASS (fingerprints + MIG-002 hash)
- Commit/PR: pending

## Blockers

- None for Step 2 domain/UI work.
- Merge of #1194 still needed before stacking Step-1/2 PRs onto `main`; work continues on feature branch.
