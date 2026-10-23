# Composition Gate — stack-migration-mig-022 (#797)

- HEAD_SHA: afa4089caf4153ee1445f368ca3d1f3986cf6fed
- BASE_SHA: 6ff844bbaea4ef58b7e8871bcdb008630a223b1d
- Date: 2026-10-23
- Verdict: CLEAR

## Event

Authorized session command enters `application/session` → `modules/session` ports → SQLite `BEGIN IMMEDIATE` transaction that atomically updates domain-shaped `SessionRuntimeState` (status/roster/gameplay), appends `session_events`, and stores session-scoped `command_idempotency` bound to actor + operation fingerprint (`expectedRevision` excluded). Deny paths roll back with no partial persistence.

## Hop chain

1. Producer: Host use-case → `SessionRuntimeUseCase.applyCommand`
2. Authenticate/Authorize: Actor + `session_members.can_write` inside transaction (ADR-ST-08 §7)
3. Validate domain `SessionEventKind` + payload → CAS on revision → mutate snapshot → append event → store idempotency
4. Consumer A: SQLite WAL single-writer
5. Consumer B: Snapshot/query port reads authoritative rows only

## Simulations

### N-actors
Two worker-thread writers race the same `expectedRevision` on distinct connections: exactly one commits; the other receives `STALE_REVISION` or `DATABASE_BUSY`.

### Invalid/missing
Empty idempotency key → `INVALID_IDEMPOTENCY_KEY`. Non-member → `FORBIDDEN`. Payload/actor mismatch → `IDEMPOTENCY_MISMATCH`.

### Two consumers / crash
SIGKILL after BEGIN mid-write leaves revision/event/idempotency jointly absent after reopen.

## Flags

None.
