# MERGE-POLICY decision package — Draft PR #860

**Ask:** Human decision required before merge. Agent will **not** force-merge, soften assertions, or invent an APPROVED merge policy.

**Recommendation (first):** **Merge PR #860 with documented known-red migration harness jobs**, treating Quality Gates + source-contract checks as the merge bar for this prep package. Do **not** mark SQL/Atlas/GATE-02/GATE-01-audit as green. Optionally mark those workflow jobs as non-required later; today **main has no branch protection / rulesets**, so GitHub will allow merge even while those jobs are red — that technical ability is **not** a policy freigabe by itself.

---

## Exact failing checks (head `95455813`)

| Check | Conclusion | Why red by design |
| --- | --- | --- |
| PostgreSQL baseline security and persistence | **FAIL** | Intentional: 16 PASS / 9 FAIL security+functional probes on legacy SQL (Critical anon helpers, High foreign ACL, Medium dice/recap). Evidence lock for #782 — **not** security acceptance. |
| Atlas isolated real product journey | **FAIL** | Intentional: 1 PASS / 2 FAIL product defects (player projection / tools overlay). Documented for #770. |
| GATE-02 and GATE-03 real browser, auth and transport candidates | **FAIL** | GATE-02 Cookie A FAIL (JS-readable auth tokens); GATE-03 criteria PASS in scope. Strict `--check` exits 1. Blocks later auth tickets, not prep inventory. |
| GATE-01 real SQLite policy candidates | **FAIL** | Functional PoC **42/42 PASS** per candidate; job fails on **full** `npm audit` (4 High in ZenStack-CLI→Prisma→deepmerge-ts chain + 1 Low esbuild). Runtime-omit-dev audit is 0. |

## Prep-package AC already proven (PASS)

| Check / evidence | Result |
| --- | --- |
| Test Gate | **PASS** |
| Composition Gate | **PASS** |
| RPC source regeneration and migration contracts | **PASS** (Edge=25 after #879; 90 contracts) |
| Actual RLS regression canary | **PASS** |
| #782 MIG-001 | **Closed** — dual rebuild identical semantic checksum |
| #783 MIG-002 | **Closed** — full inventory re-verified |
| Assertions softened? | **No** |

## Branch protection / merge gates

| Fact | Value |
| --- | --- |
| `main` branch protection API | **404 — not protected** |
| Repository rulesets | **[] empty** |
| Required status checks | **None configured** |
| Documented prep policy (PR body / EXECUTION_CONTRACT) | Prep authorized; runner **not** activated until prep PR merged + GATE approvals; do not remove assertions to pass CI |

## Recommended policy options

| Option | Meaning | Risk |
| --- | --- | --- |
| **A — Recommended:** Merge now with known-red harness jobs | Land contracts + evidence on `main`; keep red jobs as living regression detectors | Humans may misread CI red as “prep failed”; mitigate via PR body + this file |
| B — Wait until SQL/Atlas/GATE-02 are green | Fixes product/auth defects first | Blocks evidence landing; may stall #784/#789 for unrelated product work |
| C — Soften / skip / continue-on-error harness jobs | Forbidden by EXECUTION_CONTRACT | Greenwashing; loses canaries |

## Exact human decision needed

Reply with one of:

1. **`MERGE-860: ALLOW-KNOWN-RED`** — undraft already done; agent (or human) may merge #860 via normal `gh pr merge` without changing assertions.
2. **`MERGE-860: WAIT`** — keep open until named checks are green (list which).
3. **`MERGE-860: REQUIRE-REVIEW-FIRST`** — wait for named reviewer approval only, then ALLOW-KNOWN-RED.

Agent will not merge until one of these is explicit.
