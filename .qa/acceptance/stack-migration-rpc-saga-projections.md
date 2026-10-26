# Acceptance — RPC-SAGA-PROJECTIONS (#876)

## Intent
Port get_saga_overview, get_saga_lore_timeline, promote_session_outcome_to_saga, promote_session_outcome_to_world with membership/role projection and GM+world-owner promote semantics.

## Acceptance tier
`isolated-contract` — SLICE DONE. FEATURE VERIFIED → MIG-311/#810 + MIG-602/#847.

## Required Tests
- [x] Overview/lore require active membership; GM sees gm_only; player redacts; stranger denied.
- [x] Lore requires `saga.lore.read` for non-GM; hidden needs `saga.lore.read_hidden`.
- [x] Both promote names exist; request uses sessionId + consequenceId (3-arg).
- [x] Promote-to-saga appends fact, bumps draft_revision once, leaves session revision unchanged; idempotent on repeat.
- [x] Promote-to-world requires GM + world owner; stores promotedLore fact; idempotent.
- [x] Non-GM / missing consequence denied without foreign state change.
- [x] Legacy regression RPC-SEC-ANON-EVENT-HELPER: no public `append_session_event` surface; promote uses private writer with authenticated actorId.
- [x] Touched files: zero type escape hatches.
- [x] `scripts/rpc-saga-projections.self-test.mjs` → PASS

## Evidence
`scripts/rpc-saga-projections.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-saga-projections.md`.
