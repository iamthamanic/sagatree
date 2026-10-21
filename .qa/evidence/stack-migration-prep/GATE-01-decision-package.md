# GATE-01 / #784 — Human ORM decision package

**Status:** Decision package ready — **NOT APPROVED by agent**  
**Issue:** [#784](https://github.com/iamthamanic/sagatree/issues/784)  
**Evidence:** `pocs/gate-01/`, `pocs/GATE01_REVIEW.md`, `closeout/dependency-audit.md`  
**Unlocks on APPROVED:** **MIG-010 / #789** (Node host foundation). Persistence ports MIG-011..013 also depend on this choice (+ GATE-04 for SQLite journal on #790).

---

## Exact ask

Please reply on #784 (or here) with one of:

- **`GATE-01: APPROVED — Drizzle + SagaTree Policy Service`**
- **`GATE-01: APPROVED — ZenStack 3`**
- **`GATE-01: REJECTED — <reason / request more evidence>`**

Do **not** treat this document, PoC PASS counts, or CI as architecture freigabe. Record the choice in `architecture-approvals.json` + ADR only after a human says APPROVED.

---

## Recommendation (first)

**Prefer Variant A — Drizzle ORM + hand-written SagaTree Policy Service**, with these **mandatory** follow-ons written into MIG-011/012 acceptance:

1. Application may only receive the guarded port; import-boundary CI must ban raw Drizzle/client imports from product app/domain layers.
2. World-owner ≠ project-GM remains two separate authority axes (already proven in the PoC matrix).
3. Treat unguarded Drizzle raw SQL as a permanent High finding until boundary CI exists (`G01-RAW-DRIZZLE`).

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
| Low | G01-MEASUREMENT-SCOPE | Both | 10 cold / 100 writes = smoke only |
| Info | G01-FIXTURE-AUTH | Both | Synthetic actors; real JWT = GATE-02 |
| Critical/High | Legacy SQL ACL defects (#782 baseline) | Both | Successor must **deny**, not copy |
| High | GATE-02 Cookie A | Both | Blocks MIG-014/015; **does not** block MIG-010 after GATE-01 |

---

## Consequences

| If APPROVED A (Drizzle) | If APPROVED B (ZenStack) | If REJECTED |
| --- | --- | --- |
| Unblock **MIG-010/#789** host skeleton | Same unlock | Remains blocked; no host foundation |
| MIG-011..013 implement schema/policy with Drizzle + Policy Service | Same tickets with ZenStack schema/engine | Need new evidence or third option ticket |
| Must schedule import-boundary CI early | Must accept preview + audit debt or upgrade CLI chain | Queue stays at GATE-01 |

**Does not unlock:** production cutover, Supabase shutdown, MIG-014/015 (need GATE-02), full Atlas #770 product green.

---

## Decision record template (for human)

```text
GATE-01 decision: APPROVED | REJECTED
Chosen variant: A-Drizzle | B-ZenStack | none
Decider: <name>
Date: <ISO date>
Evidence reviewed: GATE-01-decision-package.md + pocs/GATE01_REVIEW.md
Conditions: <e.g. mandatory import-boundary CI before MIG-012 done>
Next ticket unlocked: MIG-010 #789
```

After APPROVED, update `.qa/evidence/stack-migration-prep/architecture-approvals.json` accordingly (human or agent-on-instruction only).
