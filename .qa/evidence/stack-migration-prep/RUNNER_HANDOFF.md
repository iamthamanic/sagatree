# Stack migration runner handoff (Epic #773)

`paused: false`  
Updated: 2026-10-21 (execution agent)

## Last completed work

| Item | Status |
| --- | --- |
| Draft PR [#860](https://github.com/iamthamanic/sagatree/pull/860) | Open draft; branch updated with main `#879` + MIG-001 evidence + Edge 25 inventory refresh |
| MIG-001 [#782](https://github.com/iamthamanic/sagatree/issues/782) | Evidence AC filled: dual rebuild identical semantic checksum; baseline.md mapped; security suite remains intentionally red as findings |
| MIG-002 [#783](https://github.com/iamthamanic/sagatree/issues/783) | In progress via inventory refresh: Edge **25** (added `ollama-settings` from #879), Infra 13, RPC 57; `ollama-settings` co-bound to MIG-402/#818 (no new GH identity); prep-check PASS locally |
| Architecture approvals | All GATE-01..05 **UNDECIDED** / deferred — agent did **not** invent APPROVED |

## Key check results

- `PATH=…/rpc-parser-venv/bin:$PATH npm run check:stack-migration-prep` → **PASS** (90 contracts, RPC=57, Edge=25, Infra=13; execution-blocked=90; architecture-approved=0)
- Dual fixture rebuild → **PASS** checksum `0a4295dbd16f61977ddb0eb282c5630d36df99de9371bfdc28fd3c2b5b99141d`
- Isolated SQL baseline suite → **16 PASS / 9 FAIL** (documented; not security acceptance)
- RLS canary → **PASS**
- Atlas product browser → **1 PASS / 2 FAIL**
- GATE-02 cookie A → **FAIL** (JS-readable tokens) — blocks later auth tickets, not first host foundation after GATE-01

## Next executable ticket

1. Finish MIG-002/#783 closeout (matrix/docs sync, issue comment, remove only #783 agent-blocked when AC proven).
2. Close/merge PR #860 via normal review once required checks understood (baseline jobs stay red by design for known defects — do not greenwash).
3. Then GATE-01/#784 **decision package for human** (ORM/auth) — unlocks MIG-010/#789.
4. Do **not** start `@ecc-runner-loop` implementation wave until prep PR merged + required GATE approvals present.

## Human decisions still required

- **GATE-01/#784** ORM + permission model (Drizzle vs ZenStack) — recommendation deferred until #782+#783 accepted and decision package prepared.
- **GATE-02/#785** Auth cookie A FAIL must be resolved before MIG-014/015.
- Dedicated GH identity for `ollama-settings` (currently co-owned under #818) — optional; registry stays 90.

## Safety

- No production data migration, no prod cutover, no Supabase shutdown.
- Main workspace foreign uncommitted files left untouched; work in isolated worktree.
