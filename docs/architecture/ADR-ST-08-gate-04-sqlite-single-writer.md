# ADR-ST-08 — GATE-04: SQLite single-writer with atomic state/revision/event/idempotency

- **Status:** Accepted (implementation freigabe only)
- **Date:** 2026-10-21
- **Issue:** [#787](https://github.com/iamthamanic/sagatree/issues/787)
- **Human source:** https://github.com/iamthamanic/sagatree/issues/787#issuecomment-6321569847
- **Decision text:** `GATE-04: APPROVED — SQLite Single Writer mit atomaren State-/Revision-/Event-/Idempotenz-Transaktionen, begrenzt auf die Implementierungsfreigabe`

## Context

Epic #773 requires a SQLite writer model that preserves SagaTree session semantics (revision CAS, atomic event append, idempotent command replay). PoC evidence: `.qa/evidence/stack-migration-prep/pocs/gate-04/` (9 mandatory rows, 18 cases PASS on Node 24 and Node 22). Gate spec: `.qa/design/gates/GATE-04-sqlite-revision-idempotency.md`.

## Decision

**Adopt SQLite single-writer** with:

| Setting | Value |
| --- | --- |
| Journal | WAL |
| `synchronous` | FULL |
| Write authority | One coordinated writer for session runtime mutations |
| `busy_timeout` | **250 ms**; **no automatic database retries** (callers resync snapshot and retry explicitly) |

### Accepted command semantics (binding for MIG-011+)

1. An accepted command persists **state, next revision, event, and idempotency result atomically** in one transaction.
2. A **non-empty idempotency key is mandatory**.
3. An identical replay returns the **originally stored result** and does **not** mutate again.
4. The key is **session-scoped**. The stored result is bound to the **authenticated actor** and the **canonicalized operation including payload**.
5. A different actor or different operation with the same key is **rejected**.
6. A sole change to `expectedRevision` is treated as **replay metadata** (does not create a new logical command identity).
7. **Authorization and membership are checked even before returning a stored idempotent result**.
8. **Notifications fire after commit**; persisted events enable catch-up after disconnects.

### PoC size limits (not product-wide)

PoC caps of **128 byte** keys and **4096 byte** state are **not** approved as product-wide limits.

## Capacity / cutover (explicitly NOT closed by this ADR)

Production capacity is **not** confirmed. Capacity confirmation is deferred to **pre-cutover acceptance** and must be tracked on **MIG-700 / #849** and Epic **#773**.

Before that acceptance, the following must be fixed (do not invent SLOs here):

- Target hardware
- State sizes
- Session mix
- Performance goals

Unevaluated capacity evidence remains **NOT RUN**.

## Consequences

### Unblocked

- MIG-011 / #790 (SQLite schema bootstrap + migration runner) may proceed under GATE-01 (Drizzle + Policy Service) + this GATE-04 implementation freigabe.
- Successors that depend only on GATE-04 writer semantics (e.g. MIG-022) remain subject to their other gates.

### Not approved by this ADR

- GATE-02, GATE-03, GATE-05
- Production cutover / Supabase shutdown
- Product-wide key/state size limits
- Capacity / load SLOs (NOT RUN until #849 pre-cutover acceptance)

### Binding companions

- `docs/architecture/host-modular-monolith.md`
- ADR-ST-05 (GATE-01 Drizzle + SagaTree Policy Service)
