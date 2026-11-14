# ATL3-V01 visual contract — self-test report (#1295)

- Contract: `.qa/fixtures/atl3-v01-visual-contract/golden-scenes.json`
- Baseline: `.qa/evidence/atl3-v01-visual-contract/baseline` (build 61498dde6f, software-webgl, preset balanced, 22 captures)
- Measurement class: software-rendering (not a GPU product measurement)

| Check | Status | Detail |
|---|---|---|
| contract-shape | PASS | scenes=2 cameras=3 |
| stored-data-dornhain-block | PASS | seed=dornhain.map.place.dornhain fp=29f3947cb45600e3 features=13 |
| stored-data-krypta | PASS | seed=dornhain.map.loc.crypt fp=9fc038d9291de012 features=7 |
| light-profiles | PASS | diorama=balanced dungeon=ancient/balanced |
| cameras-zoom | PASS | dornhain-block:100/240/480% krypta:100/175/330% |
| ist-facts | PASS | {"dornhainRoofTokens":2,"dornhainTreeVariants":3,"dornhainHeightfield":"none","kryptaRooms":2,"kryptaWalls":3,"kryptaDoors":0,"kryptaDungeonLookTorches":0,"kryptaDungeonLookInstances":0} |
| soll-ist-matrix | PASS | criteria=24 {"MET":7,"PARTIAL":3,"GAP":11,"NOT_RUN":3,"ACCEPTED_EXCEPTION":0} |
| budgets | PASS | tiers=desktop-reference,tablet,phone-low-end ciCeiling=120ms (software only) |
| baseline-set | PASS | captures=22 sha=61498dde6f renderer=software-webgl/balanced |
| docs-gates | PASS | design + acceptance + e2e + test-gate |

## Soll/Ist status

| Criterion | Scene | Area | Status |
|---|---|---|---|
| D-GEO-01 | dornhain-block | geometry | GAP |
| D-GEO-02 | dornhain-block | geometry | PARTIAL |
| D-GEO-03 | dornhain-block | geometry | GAP |
| D-MAT-01 | dornhain-block | material | GAP |
| D-SHD-01 | dornhain-block | light | GAP |
| D-LOD-01 | dornhain-block | lod | PARTIAL |
| D-READ-01 | dornhain-block | readability | MET |
| D-ART-01 | dornhain-block | artifact | GAP |
| K-GEO-01 | krypta | geometry | GAP |
| K-GEO-02 | krypta | geometry | PARTIAL |
| K-MAT-01 | krypta | material | GAP |
| K-LIT-01 | krypta | light | GAP |
| K-SHD-01 | krypta | light | GAP |
| K-ATM-01 | krypta | atmosphere | GAP |
| K-ART-01 | krypta | artifact | GAP |
| C-CAM-01 | * | camera | MET |
| C-DET-01 | * | determinism | MET |
| C-CAM-02 | * | camera | MET |
| C-DATA-01 | * | data | MET |
| C-AU-01 | * | adaptive | MET |
| C-PROF-01 | * | quality-profile | NOT_RUN |
| C-PERF-01 | * | performance | NOT_RUN |
| C-AUTH-01 | * | authority | MET |
| C-SEC-01 | * | security | NOT_RUN |

Totals: MET=7, PARTIAL=3, GAP=11, NOT_RUN=3, ACCEPTED_EXCEPTION=0. GAP rows are the target for R01B/M01/G01 — not failures of this contract.
