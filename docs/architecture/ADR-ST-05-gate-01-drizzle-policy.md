# ADR-ST-05 — GATE-01: Drizzle ORM + SagaTree Policy Service

- **Status:** Accepted
- **Date:** 2026-10-21
- **Issue:** [#784](https://github.com/iamthamanic/sagatree/issues/784)
- **Human source:** https://github.com/iamthamanic/sagatree/issues/784#issuecomment-6317688552
- **Decision text:** `GATE-01: APPROVED — Drizzle + SagaTree Policy Service`

## Context

Epic #773 local-first stack migration requires a SQLite persistence + authorization approach for the Node host. Isolated PoCs compared:

| Variant | Stack |
| --- | --- |
| A | `better-sqlite3` / libsql + **Drizzle ORM** + hand-written **SagaTree Policy Service** |
| B | **ZenStack 3** (SQLite) with generated policy layer |

PoC evidence: `.qa/evidence/stack-migration-prep/pocs/gate-01/`, decision package `.qa/evidence/stack-migration-prep/GATE-01-decision-package.md`, gate spec `.qa/design/gates/GATE-01-drizzle-vs-zenstack.md`.

## Decision

**Adopt Variant A:** Drizzle ORM inside owning module `persistence/` adapters, with a hand-written SagaTree Policy Service as the sole authorization entry for host mutations/queries that replace RLS/SECURITY DEFINER semantics.

## Consequences

### Binding (not replaced by this ADR)

1. **Host modular monolith** — `docs/architecture/host-modular-monolith.md` remains binding: vertical use-cases, domain modules, public module APIs vs private `internal`/`persistence`, central bootstrap wiring, module DAG.
2. **Policy-protected ports** — application/use-cases receive guarded repository ports only; raw ORM clients are not product-layer imports.
3. **Import-boundary CI (additional)** — ban unguarded direct `drizzle-orm` / DB-client imports from product layers outside owning `modules/*/persistence` (G01-RAW-DRIZZLE High until enforced in follow-on tickets).
4. **Authority axes** — world owner and project GM remain separate; neither is inferred from the other.

### Unblocked

- MIG-010 / #789 may proceed under explicit runner freigabe (host skeleton).
- MIG-011..013 remain subject to their other gates (e.g. GATE-04 for SQLite journal on MIG-011) and must implement Drizzle + Policy Service accordingly.

### Not approved by this ADR

- GATE-02, GATE-03, GATE-05 (GATE-04 is a **separate** human decision — see [ADR-ST-08](ADR-ST-08-gate-04-sqlite-single-writer.md))
- Production cutover / Supabase shutdown
- ZenStack as the default host ORM (remains a documented alternative only if a future human decision revises this ADR)

## Evidence summary

- Functional PoC matrices for Drizzle+Policy: PASS in measured Node 22/24 fixtures (see gate-01 reports).
- Full `npm audit` High findings on GATE-01 candidate job remain documented Known-Red for toolchain paths; they do not reverse this human architecture choice, and follow-on boundary CI is mandatory for Drizzle encapsulation.
