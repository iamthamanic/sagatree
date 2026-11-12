# Atlas Golden Steps 2–6 — Progress Log

Plan: `.qa/design/atlas-golden-steps-2-6-pm.md`  
Branch (work): `feat/atlas-3d-product-terrain` (Step 1 already on tip)  
Base Golden: `feat/dornhain-golden-atlas-v4` / PR [#1194](https://github.com/iamthamanic/sagatree/pull/1194)

## Status board

| Step | Status | Branch / PR | Notes |
|------|--------|-------------|-------|
| 1 · 3D/2D echte Karte + Pins | done | `feat/atlas-3d-product-terrain` | No open PR yet at last check |
| 2 · Küstenpolygone + Fläche zeichnen | done | PR [#1195](https://github.com/iamthamanic/sagatree/pull/1195) stacked on #1194 | test-gate PASS; browser OK |
| 3+4 · Hierarchie + Ausschnitt verorten | done | same PR #1195 | locate browser OK; test-gate PASS |
| 5+6 · Golden-Content + Reset-Kette | code done; editor E2E partial | same PR #1195 | domain+reset wired; browser reset not green yet |
| Gap-Audit | done | `.qa/runs/atlas-golden-steps-gap-audit.md` | editor not claimed complete |

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
- Commit/PR: done → [#1195](https://github.com/iamthamanic/sagatree/pull/1195)

### Steps 3+4

- Acceptance: `.qa/acceptance/atlas-hierarchy-locate-tool.md`
- Composition: `.qa/runs/composition-gate-atlas-hierarchy-locate-tool.md` (SKIPPED)
- Implementation: `locateChildMapFrame` / `parentAnchorFromParentRect`; `editor.locateChildOnParent`; Draufsicht locate session; overview pin on parent; reuse CreateWorldNodeDialog / createChildMap for hierarchy
- Browser (`SA-RR25A`): Detailkarte → unlocated hint + „Ausschnitt verorten“ → parent locate mode → drag rect → hint cleared, child returns
- test-gate: PASS; stack-migration-prep-check PASS after fingerprint refresh
- Commit/PR: pushed onto #1195

### Steps 5+6

- Acceptance: `.qa/acceptance/atlas-golden-hierarchy-reset.md`
- Domain: `dornhain-golden-hierarchy.ts` (Westmark placeholders) + extended `planDornhainGoldenReset`
- Editor: `resetToGolden` upserts Golden child maps + place hierarchy/links
- Self-tests + test-gate: PASS
- Browser: Golden reset dialog copy updated; **full reset E2E not confirmed** (dialog did not complete in live check) — tracked in gap audit
- Gap audit: `.qa/runs/atlas-golden-steps-gap-audit.md`

## Blockers

- Merge of #1194 still needed before stacking #1195 onto `main`.
- Steps 5–6 editor E2E for hierarchy reset/drill still open — cartography editor **not** claimed complete.
