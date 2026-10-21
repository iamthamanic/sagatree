# Stack migration runner handoff (Epic #773)

`paused: false`  
Updated: 2026-10-21 (post-#782/#783 follow-up)

## Completed

| Item | Result |
| --- | --- |
| [#782](https://github.com/iamthamanic/sagatree/issues/782) MIG-001 | **Closed** — dual rebuild checksum `0a4295db…99141d` |
| [#783](https://github.com/iamthamanic/sagatree/issues/783) MIG-002 | **Closed** — Edge 25 / Infra 13 / RPC 57 |
| Decision packages | [MERGE-POLICY-860.md](MERGE-POLICY-860.md), [GATE-01-decision-package.md](GATE-01-decision-package.md) |

## PR #860

| Field | Value |
| --- | --- |
| URL | https://github.com/iamthamanic/sagatree/pull/860 |
| Head SHA | `f0b9e9d9` |
| Draft → Ready | **Ready for review** (undrafted); merge still blocked on human MERGE-860 reply |
| Merged? | **No** — waiting human `MERGE-860: ALLOW-KNOWN-RED` (or WAIT / REQUIRE-REVIEW-FIRST) |

### Prep PASS vs known-red (do not greenwash)

| PASS (prep AC) | FAIL by design (findings) |
| --- | --- |
| Test Gate, Composition Gate, RPC/contracts, RLS canary | PostgreSQL baseline 16/25, Atlas 1/3, GATE-02 Cookie A, GATE-01 full npm audit High |

No branch protection / required checks on `main`. That is **not** automatic merge freigabe.

## next_action (human only — no fake background loop)

1. **MERGE-860:** choose `ALLOW-KNOWN-RED` | `WAIT` | `REQUIRE-REVIEW-FIRST` — see [MERGE-POLICY-860.md](MERGE-POLICY-860.md)
2. **GATE-01/#784:** choose `APPROVED — Drizzle` | `APPROVED — ZenStack` | `REJECTED` — see [GATE-01-decision-package.md](GATE-01-decision-package.md)  
   Recommendation: **Drizzle + Policy Service** with mandatory import-boundary CI.

After both: merge #860 (if allowed) → record GATE-01 in `architecture-approvals.json` → start MIG-010/#789 / `@ecc-runner-loop` only with explicit freigabe.

## Safety

No architecture APPROVED invented. No assertion softening. No prod cutover.
