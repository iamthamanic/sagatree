# Composition Gate — atl2-e01

- Issue: #1219
- Feature slug: atl2-e01
- HEAD_SHA: 1c3ece548b097e77be65a8c5d6ecf3ec887d4bff
- BASE_SHA: aa9e325012fc3564337abbcdf354ae1ca86a11e4
- Date: 2026-11-13
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: #1220 ATL2-E02 pin↔WorldNode binding; #1221–#1222 E03/E04; Gate E #1223

## Event

Owner creates/lists/deletes WorldNodes with one primary map per hierarchy tip
(`world > continent > country > place > building > room`); `parent_map_id` locks
to the parent tip's primary (continent→world root). Secondary maps may delete;
primary/root maps stay fail-closed.

## Hop chain

1. **Producer (domain):** `expectedPrimaryMapParentId` / graph asserts in
   `src/domains/world/primary-map-links.ts`
2. **Producer (host):** `createWorldNodeWithMaps` / `upsertWorldAtlasMap` /
   `deleteWorldAtlasMap` under world module + HTTP DELETE
3. **Persist:** SQLite `world_places`, `world_atlas_maps`, `world_place_map_links`
   (unique primary link + expected parent_map_id)
4. **Authorize:** owner-scoped Policy / service checks (stranger → 42501)
5. **Consumer (FE):** host world HTTP facades → nav tree / list maps / get map
6. **Self-test:** `scripts/atl2-e01-primary-map-links.self-test.mjs`

Cardinality: one primary map per WorldNode tip; no dual geometry SoT; no
skip-to-root when tip parent lacks a primary.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner create/list/delete; stranger mutations denied (42501) | Host ports bind actor; ownership filter | pass (self-test) |
| Invalid/missing | skip parent, cross-world, bad subtype, delete primary/root, tip without parent primary | fail-closed (subtype gate + parent lock + link validation) | pass |
| Two consumers / crash | list places + list maps read same primary ids after create | same SQLite primary link + parent_map_id | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Skip reason

n/a
