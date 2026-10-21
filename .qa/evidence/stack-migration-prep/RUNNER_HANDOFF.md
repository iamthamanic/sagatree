# Stack migration runner handoff (Epic #773)

`paused: false`  
Updated: 2026-10-21 (correction order — truncate fix, host architecture, reopen, sync)

## Correction package status

| Item | Result |
| --- | --- |
| Edge acceptance truncation bug | **Fixed** — all inventoried `requiredTests` binding; regression test for MIG-402/#818 |
| Host modular monolith contract | **Written** — `docs/architecture/host-modular-monolith.md`; `server/` registered in architecture rules |
| GitHub sync | **Fresh verified** — `github-contract-sync.json` → `synchronized-and-verified` (incl. #818 ollama + rate/encryption criteria) |
| [#782](https://github.com/iamthamanic/sagatree/issues/782) MIG-001 | **OPEN** (reopened) — evidence preserved; close blocked until PR #860 merges |
| [#783](https://github.com/iamthamanic/sagatree/issues/783) MIG-002 | **OPEN** (reopened) — evidence preserved; close blocked until PR #860 merges |
| MERGE-860 | **WAIT** — do not merge |
| GATE-01 | **NOT APPROVED** — ORM choice ≠ host-module contract |

## PR #860

| Field | Value |
| --- | --- |
| URL | https://github.com/iamthamanic/sagatree/pull/860 |
| Head SHA | `89c82566b299148d4c98ef2c558d4984d498ddf6` — bind merge template to **this** SHA + named checks below |
| Draft → Ready | Ready for review; **merge blocked** by human `MERGE-860: WAIT` |
| Merged? | **No** |

### Bind merge decisions to verified head + these checks

**Must be PASS on the verified head:** Test Gate; Composition Gate; RPC/contracts (`check:stack-migration-prep` / contract validation); RLS canary; architecture-boundary-check (incl. `server/` registry).

**Known-red by design (do not greenwash):** PostgreSQL baseline 16/25; Atlas 1/3; GATE-02 Cookie A; GATE-01 full npm audit High.

## next_action (human)

1. Review correction package on PR #860 (truncate fix + architecture + reopen + sync).
2. Revisit **`MERGE-860:`** `ALLOW-KNOWN-RED` | `WAIT` | `REQUIRE-REVIEW-FIRST` — see [MERGE-POLICY-860.md](MERGE-POLICY-860.md). Current: **WAIT**.
3. **GATE-01/#784:** `APPROVED — Drizzle` | `APPROVED — ZenStack` | `REJECTED` — see [GATE-01-decision-package.md](GATE-01-decision-package.md). Must not replace host modular monolith.

After ALLOW + GATE-01 APPROVED: merge #860 → record GATE-01 in `architecture-approvals.json` → start MIG-010/#789 / `@ecc-runner-loop` only with explicit freigabe. Then #782/#783 may close under the agreed merge close rule.

## Safety

No architecture APPROVED invented. No assertion softening. No prod cutover. No merge under WAIT.
