# Stack migration runner handoff (Epic #773)

`paused: false`  
Updated: 2026-10-21 (execution agent)

## Completed

| Item | Result |
| --- | --- |
| [#782](https://github.com/iamthamanic/sagatree/issues/782) MIG-001 | **Closed** — dual rebuild checksum `0a4295db…99141d`; baseline.md AC-mapped; SQL 16/25 + Atlas 1/3 remain documented findings |
| [#783](https://github.com/iamthamanic/sagatree/issues/783) MIG-002 | **Closed** — inventory Edge **25** / Infra 13 / RPC 57; `ollama-settings` co-bound `#818`; prep-check PASS |
| Draft PR [#860](https://github.com/iamthamanic/sagatree/pull/860) | Head `ea9c7a7f` (main `#879` merged in); still **Draft** |

## Merge SHA / PR

- Branch: `docs/mig-773-contract-remediation-20261021`
- Latest push: `ea9c7a7f`
- Not yet merged to `main` (Draft; baseline CI jobs intentionally red on known product defects)

## Next

1. **Human/reviewer**: merge policy for #860 — Quality Gates green; Stack-migration baseline/Atlas/GATE-02 jobs stay red by design until product/auth defects fixed. Do **not** soften assertions.
2. After #860 merges → prepare **GATE-01/#784 decision package** (ORM) for human APPROVED — unlocks MIG-010/#789.
3. Do **not** invent architecture APPROVED; GATE-02/03/05 do not block first host foundation after GATE-01.
4. `@ecc-runner-loop` for #773 only after prep PR merged + required GATE approvals.

## Human decision needed next (after #860 merge)

**GATE-01/#784 — Drizzle+policy vs ZenStack 3**

- Both candidates: 42 PASS each on Node 22/24 in documented PoC scope (not product migration proof).
- Open findings: ZenStack field-policy preview status; Drizzle needs mandatory policy/import encapsulation; GATE-01 full npm audit still red on generator High advisories (runtime-only 0).
- Recommendation: defer formal pick until reviewer reads `pocs/GATE01_REVIEW.md` + `pocs/gate-01/report.md`; agent will not mark APPROVED.

## Safety

No prod data migration, cutover, or Supabase shutdown. Architecture registry remains UNDECIDED.
