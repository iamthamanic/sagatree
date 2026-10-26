# Acceptance — RPC-SESSION-RECAP (#870)

## Intent
Port get_session_recap / save_session_recap_summary with role-projected summary and highlights.

## Acceptance tier
`isolated-contract` — SLICE DONE. FEATURE VERIFIED → MIG-311/#810 + MIG-602/#847.

## Required Tests
- [x] Missing session → P0002; unauthenticated → 42501; non-participant → 42501.
- [x] GM sees draft summary; player gets summaryText null until approved.
- [x] Player highlights redact gm_only; GM sees gm_only + public/shared.
- [x] save is GM-only; invalid status → 22023; unique 3-arg signature (no 2-arg overload).
- [x] UPSERT preserves snapshot/highlights on summary update.
- [x] Touched files: zero type escape hatches.
- [x] scripts/rpc-session-recap.self-test.mjs → PASS

## Evidence
`scripts/rpc-session-recap.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-session-recap.md`.
