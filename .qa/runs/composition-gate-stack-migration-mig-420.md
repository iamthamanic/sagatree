# Composition Gate — stack-migration-mig-420 (#836)

- HEAD_SHA: 603572ce11f2a820ba2fb4c79a3ba81f6400a897
- BASE_SHA: 12bcbc9bcff4a349bf41edcf2944ba42a1ba3efd
- HOP_DIGEST: session-media-token-isolated-v1
- Date: 2026-10-29
- Verdict: CLEAR

## Event

Host gains isolated session-media-token use-case (issue LiveKit JWT from active project membership) while Edge allowlisted worker remains the live mount. Public activation stays false; no production cutover.

## Hop chain

1. Producer: Host application `createSessionMediaTokenUseCases` + in-memory session/member/LiveKit store
2. Authorize: Auth identity → sessions.project_id → project_members(status=active); session_players never grants; client role/capabilities/room ignored; unsupported roles denied
3. Persist: No DB writes; JWT signed locally with LIVEKIT_API_SECRET; no outbound LiveKit HTTP
4. Consumer: Self-test fixtures; production clients still use Edge until RELEASE APPROVED

## Simulations

### N-actors
Distinct player/GM/viewer receive server-derived room/identity/grants; foreign account 403 even with session_players fixture; caller-supplied role/capabilities/room ignored.

### Invalid/missing
Null/non-object body → 400; missing sessionId → 400; unauthenticated → 401; inactive/unsupported → 403; missing LiveKit/Supabase/service-role → 503 degraded without secrets; non-finite TTL characterized as legacy gap (not separately rejected).

### Two consumers / crash
Token mint is read-only (writeCount stays 0); concurrent issue calls do not mutate membership; activation remains false; Edge allowlist unchanged.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host HTTP + MIG-600/#845 + MIG-602/#847
