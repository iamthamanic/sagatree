# Composition Gate — stack-migration-mig-022 (#797)

- HEAD_SHA: 7fb014abf979a75b7559c7ba21f7414e8812d532
- BASE_SHA: ad68c8dfb95e6aaa911f9a8529eab9143a90e10d
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Authorized session command enters `application/session` → `modules/session` ports → SQLite `BEGIN IMMEDIATE` atomic CAS. After successful COMMIT only, `onCommitted` publishes the durable event (ADR-ST-08 §8). Deny/replay/rollback paths never publish.

## Hop chain

1. Producer: Host use-case → `SessionRuntimeUseCase.applyCommand`
2. Authenticate/Authorize: Actor + `session_members.can_write` inside transaction
3. Validate domain kind/payload → CAS → mutate → append event row → store idempotency → COMMIT
4. Consumer A: SQLite WAL single-writer
5. Consumer B: `onCommitted` publisher (post-commit only) + snapshot/query port

## Simulations

### N-actors
Worker-thread writers race one revision: exactly one commit; conflict/busy for the other. Only the winner may publish.

### Invalid/missing
Empty key / non-member / mismatch → no COMMIT → no publication.

### Two consumers / crash
SIGKILL mid-TX leaves rows absent; publisher never runs for aborted work.

## Flags

None.
