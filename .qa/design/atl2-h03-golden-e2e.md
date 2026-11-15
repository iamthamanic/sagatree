# ATL2-H03 — Golden-E2E design notes (#1236)

## Name freeze (owner, 2026-11-15)

Ben approved the issue names: the country level is **Nordreich** (was the placeholder
"Land Westmark"); the continent stays **Kontinent Westmark** (matches the E03/E05 synthetic chains).

- Display-only rename. Seed keys and stable ids stay `country.westmark` /
  `dh-place-country-westmark` / `dornhain.map.country.westmark` → no data migration, no
  broken links, G04 fingerprints unchanged (canvas content identical).
- Updated consistently: FE domain (`dornhain-golden-hierarchy.ts`, `dornhain-golden-reset.ts`,
  `atlas-golden-visual.ts` G04 fixture), host seed (`dornhain-golden-hierarchy-seed.ts`), e2e
  drills (A03/A04/C06/G04/G05) and self-test oracles (A04/C06/D07/E05), acceptance docs.
- Existing DBs: host bootstrap already refreshes Golden place names; maps titled exactly
  `Land Westmark` get a title-only update (`DORHAIN_GOLDEN_LEGACY_MAP_TITLES`). User-renamed
  maps and authored canvases are never touched. The product "Golden" reset also writes the
  frozen titles.

## Journey design

- One serial spec (`e2e/atl2-h03-golden-journey.spec.ts`, chromium project) with a journey,
  a negatives test and phone/tablet viewport tests (viewport set per test so no new Playwright
  project / CI time is added).
- Map identity is verified through the Host API (`GET /api/v1/worlds/atlas/maps/:id`
  `generatorMeta.unifiedCanvas.objects[].id`), the 3D runtime through `window.__sagatreeAtlas`.
- Room scale has no product map of its own (G04 `mapSeedKey …tavern#room.tap`), so the
  journey zooms the building map to room span.
- Every writing test ends with the product "Golden" reset (default scope Atlas + Golden-Orte)
  so later specs (G04 pixel baselines) see seed state. Shared nav helpers moved to
  `e2e/helpers/atlas-host.ts` (G05 keeps its private copy to avoid churn; follow-up).
- GM vs player: player1 is a seeded demo account without membership in the admin's Dornhain;
  party-reveal / SC-03 redaction stays proven host-side in `atl2-g05-gate-g.self-test.mjs`.

## Coordination / conflict risk

- **V01 #1302** (`v01/1295-visual-contract`) also edits `dornhain-golden-hierarchy.ts`,
  `dornhain-golden-hierarchy-seed.ts`, `atlas-golden-visual.ts`, `scripts/test-gate.mjs` and
  G04 city/crypt PNG baselines. Expect textual conflicts on the title lines; resolution =
  keep V01's canvas/heightfield changes and H03's names. H03 does not touch the PNG baselines.
- H03 wires its self-test next to the H01 block in `test-gate.mjs`, away from V01's insertion
  point (after the undo-history block).

## Finding (for Ben / follow-up)

- Offline edit: while offline nothing reaches the host (asserted). After reconnect the pending
  autosave is persisted **sometimes** (observed 1 of 2 local runs) — there is no guaranteed
  retry-on-reconnect. The journey asserts "at most once, no duplicate"; a deterministic
  reconnect-retry belongs in a product follow-up (not H03 scope).
