# ATL3-V01 visual contract — self-test report (#1295)

- Contract: `.qa/fixtures/atl3-v01-visual-contract/golden-scenes.json`
- Baseline: `.qa/evidence/atl3-v01-visual-contract/baseline` (build 9994c28a9f, balanced=software-webgl, high=software-webgl, lite=lite3d-fallback, 36 captures)
- Measurement class: software-rendering (not a GPU product measurement)

| Check | Status | Detail |
|---|---|---|
| contract-shape | PASS | scenes=2 cameras=3 |
| stored-data-dornhain-block | PASS | seed=dornhain.map.place.dornhain fp=3ec9b21f1c3d0ff1 features=13 |
| stored-data-krypta | PASS | seed=dornhain.map.loc.crypt fp=aa520e6f8290e2f8 features=200 |
| host-seed-parity | PASS | dornhain-block=3ec9b21f1c3d0ff1 krypta=aa520e6f8290e2f8 |
| golden-terrain | PASS | hills=4 peak=28 underFeaturesMax=-1.65 |
| golden-forge-krypta | PASS | seed=1425 rooms=5 walls=166 doors=27 objects=2 |
| light-profiles | PASS | diorama=balanced dungeon=ancient/balanced |
| cameras-zoom | PASS | dornhain-block:100/240/480% krypta:100/175/330% |
| ist-facts | PASS | {"dornhainRoofTokens":2,"dornhainTreeVariants":3,"dornhainHeightfield":"present","dornhainHeightMax":28,"kryptaRooms":5,"kryptaWalls":166,"kryptaDoors":27,"kryptaDungeonLookTorches":1,"kryptaDungeonLookInstances":200,"kryptaDungeonLookTruncatedLite":0,"runtimeShadowPass":false,"runtimeLocalLightFalloff":false,"runtimeDepthBias":false,"kryptaCorridorStubWalls":5,"dioramaDoors":0} |
| soll-ist-matrix | PASS | criteria=24 {"MET":8,"PARTIAL":6,"GAP":8,"NOT_RUN":2,"ACCEPTED_EXCEPTION":0} |
| budgets | PASS | tiers=desktop-reference,tablet,phone-low-end ciCeiling=120ms (software only) |
| quality-switch | PASS | default=balanced rows=6 |
| baseline-set | PASS | captures=36 sha=9994c28a9f renderers=balanced:software-webgl,high:software-webgl,lite:lite3d-fallback |
| matrix-not-stale | PASS | evidence-rules=18 visual-only=6 digest=964f12d9e1f017b3 |
| docs-gates | PASS | design + acceptance + e2e + test-gate |

## Soll/Ist status

| Criterion | Scene | Area | Status |
|---|---|---|---|
| D-GEO-01 | dornhain-block | geometry | GAP |
| D-GEO-02 | dornhain-block | geometry | PARTIAL |
| D-GEO-03 | dornhain-block | geometry | PARTIAL |
| D-MAT-01 | dornhain-block | material | GAP |
| D-SHD-01 | dornhain-block | light | GAP |
| D-LOD-01 | dornhain-block | lod | PARTIAL |
| D-READ-01 | dornhain-block | readability | MET |
| D-ART-01 | dornhain-block | artifact | GAP |
| K-GEO-01 | krypta | geometry | PARTIAL |
| K-GEO-02 | krypta | geometry | MET |
| K-MAT-01 | krypta | material | GAP |
| K-LIT-01 | krypta | light | PARTIAL |
| K-SHD-01 | krypta | light | GAP |
| K-ATM-01 | krypta | atmosphere | GAP |
| K-ART-01 | krypta | artifact | GAP |
| C-CAM-01 | * | camera | MET |
| C-DET-01 | * | determinism | MET |
| C-CAM-02 | * | camera | MET |
| C-DATA-01 | * | data | MET |
| C-AU-01 | * | adaptive | MET |
| C-PROF-01 | * | quality-profile | PARTIAL |
| C-PERF-01 | * | performance | NOT_RUN |
| C-AUTH-01 | * | authority | MET |
| C-SEC-01 | * | security | NOT_RUN |

Totals: MET=8, PARTIAL=6, GAP=8, NOT_RUN=2, ACCEPTED_EXCEPTION=0. GAP rows are the target for R01B/M01/G01 — not failures of this contract.
