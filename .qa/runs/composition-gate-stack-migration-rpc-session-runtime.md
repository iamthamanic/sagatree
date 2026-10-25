# Composition Gate — stack-migration-rpc-session-runtime (#867)

- HEAD_SHA: 347f9e208d3c99caba94c8a886e65fb938cc7a72
- BASE_SHA: d0f5af5c62f5543f74c658f1a9840167a71a031c
- Date: 2026-10-25
- Verdict: CLEAR

## Event

RPC-SESSION-RUNTIME facades compose Actor → SessionPorts.apply/getSnapshot with SQLSTATE mapping. No UI.

## Hop chain

1. Producer: apply_session_runtime_command / get_session_runtime_snapshot / set_session_player_presence
2. Authorize: session membership inside store transaction
3. Persist: session_runtime + session_events + idempotency (MIG-022)
4. Consumer: snapshot projection for members only

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Writer apply; stranger snapshot denied | self-test | pass |
| Invalid/missing | stale revision 40001 | self-test | pass |
| Two consumers / crash | idempotent replay | self-test | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP → MIG-311/#810; character roll owner fix when character port exists; FEATURE → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No cutover, no Supabase shutdown, no desktop release.
