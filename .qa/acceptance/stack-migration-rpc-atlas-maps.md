# Acceptance — RPC-ATLAS-MAPS (#862)

## Intent
Port ensure_world_atlas_root, list_world_atlas_maps, get_world_atlas_map, upsert_world_atlas_map to the modular host with successor security for cross-saga party projection.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
HTTP → MIG-311; FEATURE VERIFIED → MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] get_world_atlas_map three-parameter contract (optional saga public id); no legacy two-arg overload.
- [x] Player list/detail: party-only maps, filtered features/meta, hidden parent/Azgaar when not allowed.
- [x] ensure_world_atlas_root idempotent; legacy_tiles when world_maps exists; parent must match world on upsert.
- [x] GeoJSON FeatureCollection, 1_500_000-byte limit, revision conflict 40001.
- [x] RPC-SEC-CROSS-SAGA-REVEAL: saga B public id denied for saga A member (42501) on list and get.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `node --experimental-strip-types scripts/rpc-atlas-maps.self-test.mjs` → PASS

## Evidence
`node --experimental-strip-types scripts/rpc-atlas-maps.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-atlas-maps.md`.
