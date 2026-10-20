# Phase 3 — Stable Baseline

| Field | Value |
| --- | --- |
| Baseline commit | `4bc40a3142811f23f528b17698abc6d674d2ee75` |
| Subject | `feat(atlas): hard E2E gate closing epic #746 (#755) (#769)` |
| Branch | `origin/main` |
| `npm run test-gate` | PASS (2026-10-20, local on prep branch = main tip) |
| Known acceptance gap | Atlas live E2E optional → #770 |
| Production migration | NOT approved |

## Golden fixture scenarios (required for later Alt/Neu)

These must be representable as synthetic or controlled-clone fixtures (no prod writes):

1. Dornhain/Donalu world hierarchy with real place/map links  
2. GM + ≥2 players  
3. Characters with inventory + abilities  
4. Secret NPCs and maps (`gm_only` / unrevealed)  
5. Session join, dice, combat  
6. Concurrent commands (revision / idempotency)  
7. Savegame + reload  
8. Cross-owner and unauthorized access negatives  

## Contracts to keep green across migration

- `npm run test-gate` (architecture, CORS, avatar pins, domain validators, secrets)  
- Browser E2E suite  
- Negative authz suite (`docs/ops/negative-authz-suite.md`)  
- Session runtime revision design (`.qa/design/player-test-realtime-runtime-state.md`)  
- Atlas worldbuilder contract  
- CE / IV / AU experience contracts where UI changes  

## Known problems (explicit)

| ID | Problem | Severity |
| --- | --- | --- |
| K-01 | Atlas live product E2E not mandatory in CI | High (acceptance) |
| K-02 | Dependabot Three/MediaPipe blocked by intentional pins | Info (protective) |
| K-03 | React 19 / leaflet 5 / types-dom blocked by peer matrix | Medium (upgrade debt) |
| K-04 | No prior `.qa/intake/local-first-stack-migration-*` in repo (reconstructed this prep) | Info |
