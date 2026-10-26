# Composition Gate — stack-migration-rpc-session-lifecycle (#868)

- HEAD_SHA: 84d7c6bdea195c47c6b6ca02fdfedbef3ab6c9e9
- BASE_SHA: fbd2fb95a5992bc2d51a8d322edb73ab0201804b
- Date: 2026-10-26
- Verdict: CLEAR

## Event

Host create_play_session / create_project_session / set_session_status; internal status event + completion recap; no public append_session_event.

## Hop chain

1. Producer: session-lifecycle use-cases / command barrels
2. Authorize: auth + project GM / active membership ports
3. Persist: play_sessions + session_runtime/events + session_recaps (session-owned)
4. Consumer: self-test / future HTTP adapters

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | GM create/status; player create_project_session | project ports + lifecycle store | pass |
| Invalid/missing | stranger / illegal transition / completed terminal | 42501 / 22023 | pass |
| Two consumers / crash | IMMEDIATE tx for status+event+recap | atomic | pass |
| Legacy defects | RPC-SEC-ANON-EVENT-HELPER | append not exported | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: MIG-301..313 / MIG-311 session adapters as applicable

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
