# Composition Gate — atl2-h03

- Issue: #1236
- Feature slug: atl2-h03
- HEAD_SHA: ac759c2a34cb8a37cafe90034f50477e6eadde49
- BASE_SHA: 07f3c4bc65868726f2144ed557f146ed03bb2b1c
- Date: 2026-11-15
- Verdict: CLEAR
- Acceptance tier: host-browser-e2e (`e2e/atl2-h03-golden-journey.spec.ts` against real HOST + SQLite) + host seed self-test (`scripts/atl2-h03-golden-e2e.self-test.mjs`)
- Deferred integration: none

## Event

Host bootstrap (`ensureDornhainDefaultCatalog` → `seedDornhainGoldenHierarchy`) brings an
existing Dornhain world to the frozen Golden name: country map/place "Land Westmark" → "Nordreich".

## Hop chain

`server/src/bootstrap/dornhain-golden-hierarchy-seed.ts` (spec title + `DORHAIN_GOLDEN_LEGACY_MAP_TITLES`)
→ SQLite `world_atlas_maps.title` (title-only UPDATE, revision +1) / `world_places.name` (existing refresh)
→ `GET /api/v1/worlds/:id/atlas/maps`, `GET /api/v1/worlds/atlas/maps/:id`
→ FE `useWorldAtlasEditor` / DB WorldNode nav tree + 2D breadcrumb
→ UI label "Nordreich". FE Golden reset (`dornhain-golden-reset.ts`) writes the same title via `upsertMap`.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors: 10 owners / worlds bootstrap, each with legacy title | each world renamed once | per-world UPDATE keyed by `id + world_profile_id`; second ensure sees `title === spec.title` → no-op (no revision churn) | pass |
| Invalid/missing: user renamed the map ("Meine Krypta"), seed key without legacy entry, map needing full Golden repair | user title kept; unknown seed no-op; repair path unchanged | rename only when title equals an exact legacy Golden title; `needsGolden` branch unchanged (already wrote `spec.title`) — self-test asserts user rename + canvas untouched | pass |
| Two consumers / crash: concurrent ensure-starter or crash between place and map updates | at most cosmetic duplicate revision; no data loss | synchronous better-sqlite3 statements; idempotent re-run converges; an open editor with the old revision gets the existing 409 conflict UI (reload) once | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| identity: | note | seed → API → nav | rename must not change ids | seed keys / stable ids unchanged; journey asserts same object ids across 2D/3D/reload | done |
| race: | note | bootstrap → open editor | revision bump during an open session | one-time, surfaces as existing revision-conflict UI | accepted |

## Skip reason

n/a
