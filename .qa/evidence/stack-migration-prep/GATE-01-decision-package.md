# GATE-01 / #784 — Human ORM decision package

**Status:** Decision package ready — **NOT APPROVED by agent**  
**Issue:** [#784](https://github.com/iamthamanic/sagatree/issues/784)  
**Evidence:** `pocs/gate-01/`, `pocs/GATE01_REVIEW.md`, `closeout/dependency-audit.md`  
**Unlocks on APPROVED:** **MIG-010 / #789** (Node host foundation). Persistence ports MIG-011..013 also depend on this choice (+ GATE-04 for SQLite journal on #790).

**Important (correction order 2026-10-21):** Choosing Drizzle or ZenStack does **not** substitute for the binding **host modular monolith** contract in `docs/architecture/host-modular-monolith.md` (module ownership, public APIs, repository ownership, dependency DAG, central bootstrap, use-case map). Import-boundary CI against direct Drizzle/client access remains an **additional** requirement beside domain module-boundary checks. No GATE-01 self-approval from MERGE-860: WAIT or from this package.

---

## Exact ask

Please reply on #784 (or here) with one of:

- **`GATE-01: APPROVED — Drizzle + SagaTree Policy Service`**
- **`GATE-01: APPROVED — ZenStack 3`**
- **`GATE-01: REJECTED — <reason / request more evidence>`**

Do **not** treat this document, PoC PASS counts, PR #860, or CI as architecture freigabe. Record the choice in `architecture-approvals.json` + ADR only after a human says APPROVED.

---

## Recommendation (first)

**Prefer Variant A — Drizzle ORM + hand-written SagaTree Policy Service**, with these **mandatory** follow-ons written into MIG-011/012 acceptance:

1. Application may only receive the guarded port; import-boundary CI must ban raw Drizzle/client imports from product app/domain layers (**additional** to host module-boundary CI).
2. World-owner ≠ project-GM remains two separate authority axes (already proven in the PoC matrix).
3. Treat unguarded Drizzle raw SQL as a permanent High finding until boundary CI exists (`G01-RAW-DRIZZLE`).
4. Host modules / use-cases must still obey `docs/architecture/host-modular-monolith.md` (MIG-010/#789 first enforcement).

**Why not ZenStack as default:** functional parity is excellent, but (a) field policies remain **preview**, (b) GATE-01 CI full audit stays **red** on the ZenStack-CLI → Prisma → `deepmerge-ts` High chain, (c) generated surface area is larger for a first host foundation. ZenStack remains a viable APPROVED alternative if the team explicitly accepts preview field policies + toolchain audit debt.

---

## Options

| ID | Stack | PoC functional result | Notable cost |
| --- | --- | --- | --- |
| **A** | `better-sqlite3` + **Drizzle** + Policy Service | Node 22 & 24: **42 PASS / 0 FAIL** each; 13 evidence regressions PASS | No built-in policy engine — **mandatory** encapsulation; raw client can mutate if boundary bypassed (proven in rolled-back probe) |
| **B** | **ZenStack 3** + PolicyPlugin | Node 22 & 24: **42 PASS / 0 FAIL** each; 13 evidence regressions PASS; real field redaction + raw-SQL reject | Field policies **preview**; generator audit **4 High / 1 Low** (dev chain); more generated LOC |
| **C** | Third ORM / “neither” | **Not evidenced** in this prep | Would require a new PoC ticket — do not invent |

### Metrics (Node 24 Linux fixture; smoke, not capacity)

| Candidate | Write p50 (ms) | Write p95 (ms) | Cold-start p50 (ms) | Hand-written NLOC (approx.) |
| --- | --- | --- | --- | --- |
| Drizzle | 0.84 | 1.29 | 582 | ~154 |
| ZenStack | 4.75 | 6.40 | 659 | ~173 (+ ~587 generated) |

Both satisfy gate rows 1–9 in the measured Owner/GM/Saga/CAS/idempotency matrix. Domain packages stay free of ORM imports in the PoC AST check.

---

## Open findings that survive either choice

| Severity | ID | Survives | Note |
| --- | --- | --- | --- |
| High | G01-RAW-DRIZZLE | Stronger under A | Boundary CI required before claiming host authz |
| Medium | G01-ZEN-FIELD-PREVIEW | Under B | Preview field policies — upgrade risk |
| Medium | G01-MIGRATION-SCOPE | Both | 7 tables ≠ 50+ product tables / PG RPC/RLS/triggers |
| High (toolchain) | ZenStack CLI audit chain | Under B (and GATE-01 job) | Full audit red; omit-dev 0 |

## Related human decisions (not this package)

- **`MERGE-860: WAIT`** — PR #860 must not be merged until human revisits after correction package.
- Host architecture contract is already written as binding for MIG-010+; it is **not** GATE-01 APPROVED.
