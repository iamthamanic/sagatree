# Acceptance — RPC-WORLD-MAP (#861)

## Intent
Port get_world_map / save_world_map with server-side player pin filter.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
HTTP → MIG-311; FEATURE VERIFIED → ATLAS + MIG-602. RELEASE APPROVED → human only.

## Required Tests
- [x] Empty map → revision 0 size 24; saved JSON payload round-trip.
- [x] Only world editors save; size 1–60; path/JSON validation.
- [x] Revision conflict → SQLSTATE 40001 without partial update.
- [x] Player view pin filter enforced server-side (RPC-SEC-LEGACY-MAP-FLAG).
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] scripts/rpc-world-map.self-test.mjs → PASS

## Evidence
`node --experimental-strip-types scripts/rpc-world-map.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-world-map.md`.
