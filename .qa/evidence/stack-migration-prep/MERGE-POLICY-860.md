# MERGE-POLICY decision package — PR #860

**Human reply recorded:** `MERGE-860: WAIT`  
**Agent action:** **Do not merge PR #860.** No force-merge, no assertion softening, no invented APPROVED merge policy / GATE freigabe.

**Verified head (this correction package):** bind reviews to the commit pushed with these corrections (see PR #860 / `RUNNER_HANDOFF.md`). Do not treat older SHAs (`95455813`, `f0b9e9d9`, `2ecfaf6f`, …) as the merge bar once a newer head exists.

---

## Why WAIT is still correct after corrections

Concrete agent corrections were required before any merge/continue decision:

1. Truncated Edge acceptance (bullet-count caps) — **fixed**; full binding coverage restored (esp. MIG-402/#818).
2. GitHub issue drift vs canonical contracts (esp. #818) — **must be freshly verified** after regen/sync.
3. Missing binding **host modular monolith** architecture — **added** (`docs/architecture/host-modular-monolith.md`); ORM choice does **not** substitute.
4. #782 / #783 closed while required PR not merged — **reopened** until #860 merges.

Until those are landed on the PR head **and** human re-evaluates, merge stays blocked.

---

## Exact failing checks (known-red by design; do not greenwash)

| Check | Conclusion | Why red by design |
| --- | --- | --- |
| PostgreSQL baseline security and persistence | **FAIL** | Intentional: 16 PASS / 9 FAIL security+functional probes on legacy SQL. Evidence lock for #782 — **not** security acceptance. |
| Atlas isolated real product journey | **FAIL** | Intentional: 1 PASS / 2 FAIL product defects. Documented for #770. |
| GATE-02 and GATE-03 real browser, auth and transport candidates | **FAIL** | GATE-02 Cookie A FAIL; GATE-03 criteria PASS in scope. Blocks later auth tickets, not prep inventory. |
| GATE-01 real SQLite policy candidates | **FAIL** | Functional PoC **42/42 PASS** per candidate; job fails on **full** `npm audit` (ZenStack-CLI chain High + Low esbuild). |

## Prep-package AC (must stay PASS on the verified head)

| Check / evidence | Result |
| --- | --- |
| Test Gate | Required PASS on verified head |
| Composition Gate | Required PASS on verified head |
| RPC source regeneration and migration contracts | Required PASS (Edge=25; full requiredTest coverage; no bullet-cap drop) |
| Actual RLS regression canary | Required PASS |
| Host modular monolith contract + `server/` registry | Required present; not an ORM freigabe |
| #782 MIG-001 / #783 MIG-002 | **OPEN** until #860 merges (evidence preserved; close rule = required merge) |
| Assertions softened? | **No** |

## Branch protection / merge gates

| Fact | Value |
| --- | --- |
| `main` branch protection API | **404 — not protected** |
| Repository rulesets | **[] empty** |
| Required status checks | **None configured** |
| Documented prep policy | Prep authorized; runner **not** activated until prep PR merged + GATE approvals; do not remove assertions to pass CI |

## Recommended policy options (unchanged; WAIT selected)

| Option | Meaning |
| --- | --- |
| **A** `MERGE-860: ALLOW-KNOWN-RED` | Merge with known-red harness jobs after corrections verified |
| **B** `MERGE-860: WAIT` | **Current human reply** — keep open |
| **C** `MERGE-860: REQUIRE-REVIEW-FIRST` | Wait for named reviewer, then ALLOW-KNOWN-RED |

Agent will **not** merge while WAIT stands.
