# Composition Gate — dornhain-unified-atlas-starter

- HEAD_SHA: d8f1ea3e2b4f95b35ba612b64d80b110aeab58ab
- CONTENT_SHA: 5f138c0dcb27e2af6b75f6154e001a624afca72e
- BASE_SHA: 8485f6d7f2d98af0a817b2f112281531197f3966
- Date (UTC): 2026-10-18T07:03:43Z
- Verdict: SKIPPED

## Skip reason

Seed/data migration + domain canvas builder + thin ensureRoot default — no new multi-hop user journey beyond existing atlas save path.

## Event

Dornhain starter persists Unified Canvas on `world_atlas_maps` instead of Eldoria demo-only client seed.

## Hop chain

1. Provision / catalog seed → `seed_dornhain_unified_atlas`
2. Persist `generator_meta.unifiedCanvas` (demoSeed=false)
3. Places + settlement child map
4. Atlas UI loads persisted doc via existing getMap / UnifiedAtlasEditor

## Simulations

N/A (SKIPPED)

## Flags

- Legacy `world_maps` tiles retained for Live/GM until those surfaces migrate.
