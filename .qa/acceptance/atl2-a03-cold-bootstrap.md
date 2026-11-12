# Feature: ATL2-A03 Cold Bootstrap and Golden hierarchy reset (#1199)

<!-- atlas-v2-epic: #1196; slice: A03; slug: atl2-a03 -->

## Intent

Fresh Dornhain worlds and Golden-Reset must land the same six-level
map hierarchy (Welt → Kontinent Westmark → Land Westmark → Dornhain →
Taverne/Krypta) with linked places — never a flat root-only seed.

## Preconditions

- Host SQLite migrations applied; `ensureDornhainDefaultCatalog` runs on boot / ensure-starter.
- Golden domain seeds exist in FE (`dornhain-golden-hierarchy` / `dornhain-golden-reset`).
- Owner-scoped atlas writes only.

## Happy Path

- [ ] Cold bootstrap creates world root + five Golden child maps with correct `parent_map_id` chain and non-empty canvases
- [ ] Places include continent/country/place/building seeds with parents matching Golden specs
- [ ] Primary + overview map links exist for Golden places
- [ ] Re-running ensure is idempotent (same seed keys; no duplicate Golden maps)
- [ ] Non-Golden user maps survive ensure and `atlas` / `atlas_places` reset modes
- [ ] Host self-test + Browser/Host probe for Reset→Drill→Reload path is green

## Edge Cases

- [ ] Partial / interrupted ensure does not leave orphan Golden seeds without parents on retry
- [ ] Foreign / non-root maps are not treated as Golden reset targets
- [ ] Session wipe on `everything` stays honest when unavailable (existing note)

## Security Coverage

- B-owner-scope: seed rows use owner-scoped ids; no cross-owner REPLACE
- P-no-client-origin-trick: bootstrap is host-only
- Out of scope: new auth routes, public asset URLs

## Adaptive / Experience

- No new UI chrome; existing Golden reset dialog / Weltstruktur
- AU-*: N/A for bootstrap-only; reset dialog already AU-TOUCH-44

## Composition Gate

SKIPPED — owner-scoped authoring/bootstrap; no new multi-actor hop
(see `.qa/runs/composition-gate-atl2-a03-cold-bootstrap.md`)

## Implementation Notes

- Host seed module: `server/src/bootstrap/dornhain-golden-hierarchy-seed.ts`
- Wired from `seedOwnedDornhainAtlas` via `seedDornhainGoldenHierarchy`
- Self-test: `scripts/atl2-a03-cold-bootstrap.self-test.mjs` (idempotent + user-map preserve)
- Browser wrapper: `e2e/atl2-a03-cold-bootstrap.spec.ts`
- fe-host-07 expects ≥6 atlas maps after ensure-starter
