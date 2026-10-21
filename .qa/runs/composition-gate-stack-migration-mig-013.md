# Composition Gate — stack-migration-mig-013 (#792)

- HEAD_SHA: 3a9c9723e1754e9a8743de10360dd3ee7e849344
- BASE_SHA: 87bafeac2b62db98e6774fd2ea816a79d2fe3c9a
- Date: 2026-10-21
- Verdict: CLEAR

## Event

Host mutations/queries that replace RLS/SECURITY DEFINER enter a single deny-by-default Policy Service. Owner-only world edits, GM-only session ops, and player project reads consult durable SQLite membership rows; unknown ops / missing actor / inactive membership / foreign tenant are denied without leaking private rows.

## Hop chain

1. Producer: HTTP/use-case → `permissions.authorize(op, actor, resource)`
2. `PolicyService` loads world/project/membership from host SQLite
3. Consumer: allow/deny decision — no alternate ORM bypass for these ops in this ticket

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | O vs G vs P1 vs stranger get distinct decisions | Matrix self-test | pass |
| Invalid/missing | Missing actor / unknown op / empty project id | deny codes only | pass |
| Two consumers / crash | Reopen DB after seed; grants durable | second bootstrap still owner-only | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

GATE-02/03/05 and cutover not approved. Full RLS port remains incremental.
