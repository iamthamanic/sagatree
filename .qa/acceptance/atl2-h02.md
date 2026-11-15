# Feature: ATL2-H02 — Atlas contracts, Golden data, readmes and tests synced to the final state (#1235)

<!-- atlas-v2-epic: #1196; slice: H02; slug: atl2-h02 -->

## Intent

Outdated or contradictory atlas documentation must no longer mislead agents. One canonical
index states the **actually active** ATL2 architecture (Canvas2D + Custom WebGL, ADR-ST-10),
the earlier Three.js intent and why R02–R05 were not implemented, and links ATL3 as future work.

## Preconditions

- ATL2-H01 #1234 (PR #1304) — this branch is stacked on it
- ADR-ST-10 NO-GO in force; no Three.js cutover anticipated

## Happy Path

- [x] Canonical index `docs/architecture/atlas-v2-architecture.md`: active renderer mapping, history (Three.js intent → D01 → R01 NO-GO → R02–R05 `not_planned`), ATL3 #1294 / #1295 / #1296 / #1267–#1270 / #1297–#1299 / #1300 / #1301 listed as future
- [x] All normative atlas docs point to the same architecture; `AGENTS.md` points Atlas work to the index
- [x] Legacy claims corrected via status banners (Leaflet "kept in repo", Hybrid Three.js design, "retire in ATL2-H") — historical text and ADRs not rewritten
- [x] Old PR gaps count only with reproducible evidence: per-gate certification checklist (acceptance / self-test / report) — evidence must be reproduced on HEAD
- [x] Golden fixtures (seed `dornhain.unified.v4`, FE domain + host mirror, reset modes, visual baselines) and test commands described reproducibly
- [x] `npm run test:e2e -- <spec> --project=<p>` forwards args to Playwright (CI without args unchanged)
- [x] Migration / upgrade notes (Leaflet removal, prototype move, B04 write retire, 3D Undo/Redo)
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout)

## Edge Cases

- [x] Every repo path cited in the index exists (self-test fails on a dead link)
- [x] Golden map names flagged as placeholders until PM freeze (H03 issue text says "Nordreich"; seeds say "Land Westmark")

## Gates

- `node scripts/atl2-h02-docs-sync.self-test.mjs` (in `npm run test-gate`)
- `npm run test-gate`, `npm run lint`, `npm run typecheck`, `npm run composition-gate`
- Host Browser E2E via the documented single-spec command (`e2e/atl2-h01-cleanup.spec.ts`)

ADR-ST-10 remains the renderer source until a #1296 GO-ADR and #1300 CLEAR.
