# Composition Gate — stack-migration-mig-422 (#838)

- HEAD_SHA: PENDING_COMMIT
- BASE_SHA: 509f92026b74451057b3187a1820e743abbc58f0
- HOP_DIGEST: sessions-edge-quarantine-v1
- Date: 2026-10-29
- Verdict: CLEAR

## Event

Host gains Edge `sessions` Map quarantine characterization while preserving external/host 404 for Edge worker paths. Public activation stays false; no production cutover. Legitimate host `/api/v1/sessions/*` RPC runtime is unrelated.

## Hop chain

1. Producer: Quarantine store (in-memory Maps for sessions/players/chat/savepoints)
2. Authorize: None in legacy worker — body fields are not authority; host routes stay 404
3. Persist: Process-local Maps only (`SESSIONS_EDGE_MAP_IS_DURABLE=false`)
4. Consumer: Self-test fixtures; production clients must not call this worker

## Simulations

### N-actors
Per-project sessionNumber increments inside one store; a second store starts empty (cross-process loss).

### Invalid/missing
All Edge `/sessions` and `/functions/v1/sessions` methods including world-state/import → 404 on host route registry.

### Two consumers / crash
create_play_session / apply_session_runtime_command sources do not import quarantine; activation remains false.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host HTTP + MIG-600/#845 + MIG-602/#847
