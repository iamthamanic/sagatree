# GATE-04 — SQLite transactions, revision, concurrency, idempotency

> **Status:** **APPROVED — SQLite Single Writer (implementation freigabe only)** (human, 2026-10-21)  
> **GitHub:** #787 · Prep criteria: #776 · ADR: [ADR-ST-08](../../../docs/architecture/ADR-ST-08-gate-04-sqlite-single-writer.md)  
> **Blocks removed for implementers:** MIG-011/#790 (with GATE-01); MIG-022 and session command ports still require their other gates  
> **Not approved:** production capacity / cutover (NOT RUN → MIG-700/#849)

## Variant

Single required PoC (not A/B libraries): prove SagaTree session semantics on SQLite single-writer model.

Reference contracts:
- `.qa/design/player-test-realtime-runtime-state.md`
- Existing RPC `apply_session_runtime_command` behavior (inventory in #777)

## Reproducible setup

1. `server/poc/gate-04/` with table `session_runtime(session_id PK, revision INT, state_json, updated_at)`.  
2. Table `command_idempotency(session_id, idempotency_key, result_json, PRIMARY KEY(session_id, idempotency_key))`. The same key may exist in separate sessions and must never replay another session's result.  
3. Table `session_events(session_id, event_sequence, revision, payload_json, PRIMARY KEY(session_id, event_sequence))`. API: `applyCommand({ sessionId, expectedRevision, idempotencyKey, op })` changes state, revision, event append and idempotency result **atomically in one SQLite transaction**.  
4. Actors: 1 writer queue + 5 concurrent clients (Promise.all / worker threads).

## Metrics / PASS criteria

| # | Test | PASS |
| --- | --- | --- |
| 1 | Happy path increments revision by 1 | Exact |
| 2 | Stale `expectedRevision` | Abort; no state change; conflict error |
| 3 | Duplicate `idempotencyKey` | Same result returned; revision not double-bumped |
| 4 | Concurrent conflicting ops | Exactly one winner; others conflict; no torn state |
| 5 | Crash mid-transaction (kill -9 after BEGIN) | Recovered DB consistent (no half apply) |
| 6 | WAL checkpoint + restart | State+revision identical |
| 7 | 20 clients × 50 cmds | Zero lost commits; throughput logged |
| 8 | Atomic `session_events` append | Committed state/revision has exactly one corresponding event; rollback/crash leaves neither partial event nor partial state |
| 9 | Same idempotency key in two sessions | Both commands succeed independently; no cross-session replay or information leak |

## Negative tests

- Missing idempotencyKey rejected if contract requires it  
- Empty auth → deny before write  
- Oversized state_json rejected  

## Decision criteria

1. Rows 1–9 PASS mandatory.  
2. Document busy_timeout / retry policy.  
3. Confirm single-writer sufficiency for target concurrency or escalate needs-human.

## On APPROVED

**Recorded 2026-10-21:** ADR-ST-08 + `architecture-approvals.json`. Unblocks MIG-011/#790 (with GATE-01). MIG-022 and session ports remain subject to their other gates. Capacity/cutover remain **NOT RUN** on MIG-700/#849.

## Explicit non-decision

Does **not** authorize production cutover, Postgres removal, GATE-02/03/05, or invented capacity SLOs.
