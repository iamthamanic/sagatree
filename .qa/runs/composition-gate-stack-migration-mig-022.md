# Composition Gate — stack-migration-mig-022 (#797)

- HEAD_SHA: 4c196ca2f8a6ec6504e13b3f25dd9ea0ed95d5be
- BASE_SHA: 6ff844bbaea4ef58b7e8871bcdb008630a223b1d
- Date: 2026-10-23
- Verdict: CLEAR

## Event

Authorized session command enters `application/session` → `modules/session` ports → SQLite `BEGIN IMMEDIATE` transaction that atomically updates `session_runtime` revision/state, appends `session_events`, and stores session-scoped `command_idempotency` bound to actor + operation fingerprint (`expectedRevision` excluded). Deny paths (membership, stale revision, idempotency mismatch) roll back with no partial persistence. Notifications/events are durable only after COMMIT.

## Hop chain

1. Producer: Host use-case / future HTTP adapter → `SessionRuntimeUseCase.applyCommand`
2. Authenticate/Authorize: Actor identity + `session_members.can_write` inside transaction (ADR-ST-08 §7)
3. Validate DTO → CAS on revision → mutate state → append event → store idempotency result
4. Consumer A: SQLite WAL single-writer (`session_runtime` / `session_events` / `command_idempotency`)
5. Consumer B: Snapshot/query port reads authoritative rows only (no client-invented associations)

## Simulations

### N-actors
Two writers race the same `expectedRevision`: exactly one commits; the other receives `STALE_REVISION` with unchanged persistence.

### Invalid/missing
Empty idempotency key → `INVALID_IDEMPOTENCY_KEY`. Non-member → `FORBIDDEN`. Payload/actor mismatch on stored key → `IDEMPOTENCY_MISMATCH`.

### Two consumers / crash
Aborted transaction (ROLLBACK before COMMIT) leaves revision, event, and idempotency jointly absent after reopen.

## Flags

None.
