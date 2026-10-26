# Acceptance — RPC-SESSION-ACCESS (#869)

## Intent
Port join_session_by_code, leave_play_session, create/resolve/revoke_session_invite.

## Acceptance tier
`isolated-contract` — SLICE DONE. FEATURE VERIFIED → MIG-311/#810 + MIG-602/#847.

## Required Tests
- [x] Join normalisiert Codes; eigener vollständiger PC; Membership+Roster+Revision+Join-Event atomar.
- [x] Fremdnutzer-Austritt ändert weder Revision noch Events (RPC-SEC-LEAVE-FOREIGN behoben).
- [x] Invite create/revoke verlangt Session-GM; Erneuern widerruft vorherige aktive Tokens.
- [x] Abgelaufenes/widerrufenes/fehlendes Token und completed Session → belegte error_codes; Resolve tritt nicht bei.
- [x] append_session_event nicht öffentlich exportiert (RPC-SEC-ANON-EVENT-HELPER).
- [x] Touched files: zero type escape hatches.
- [x] scripts/rpc-session-access.self-test.mjs → PASS

## Evidence
`scripts/rpc-session-access.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-rpc-session-access.md`.
