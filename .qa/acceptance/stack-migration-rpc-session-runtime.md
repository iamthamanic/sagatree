# Acceptance — RPC-SESSION-RUNTIME (#867)

## Intent
SQLSTATE-shaped facades for apply_session_runtime_command, get_session_runtime_snapshot, set_session_player_presence over MIG-022 session ports.

## Acceptance tier
`isolated-contract` — SLICE DONE. FEATURE VERIFIED → MIG-311/#810 + MIG-602/#847.

## Required Tests
- [x] All 15 runtime kinds via apply; presence is runtime kind not separate lifecycle RPC
- [x] Stale revision → 40001
- [x] Idempotent replay → committed=false, same revision
- [x] Foreign snapshot denied 42501; presence facade works for member
- [x] No public append_session_event helper (RPC-SEC-ANON-EVENT-HELPER)
- [x] Touched files: zero type escape hatches
- [x] scripts/rpc-session-runtime.self-test.mjs → PASS


## Deferred
Full PAR-08 roll owner_user_id character table, adventure helper surface → follow-up when character module lands; HTTP → MIG-311.
