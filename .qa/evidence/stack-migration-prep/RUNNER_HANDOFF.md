# Stack migration runner handoff (Epic #773)

`paused: false`  
Updated: 2026-10-21 (MERGE-860 WAIT correction — effective host checker + RPC path harmonization)

## Correction package status

| Item | Result |
| --- | --- |
| Edge acceptance truncation bug | **Fixed** — all inventoried `requiredTests` binding; regression test for MIG-402/#818 |
| Host modular monolith contract | **Written** — `docs/architecture/host-modular-monolith.md`; `server/` registered |
| Host module-boundary checker | **Effective** — `checkRegisteredHostPackages()` resolves relative/alias imports, rejects private cross-module access, module cycles, and non-composition `http/**` private wiring; regressions in `architecture-boundary-check.self-test.mjs` |
| RPC path harmonization | **Done** — use-case + module public APIs + transitional `commands/` adapters; #873 and siblings synced |
| #789 checker/CI paths | **In contract** — no “Placeholder CI hook”; Test Gate runs the effective checks |
| GitHub sync | **Fresh verified** — `github-contract-sync.json` → `synchronized-and-verified` (23 affected contracts re-pushed) |
| [#782](https://github.com/iamthamanic/sagatree/issues/782) MIG-001 | **OPEN** (reopened) — evidence preserved; close blocked until PR #860 merges |
| [#783](https://github.com/iamthamanic/sagatree/issues/783) MIG-002 | **OPEN** (reopened) — evidence preserved; close blocked until PR #860 merges |
| MERGE-860 | **WAIT** — do not merge |
| GATE-01 | **NOT APPROVED** — ORM choice ≠ host-module contract |

## PR #860

| Field | Value |
| --- | --- |
| URL | https://github.com/iamthamanic/sagatree/pull/860 |
| Head SHA | bind merge/completion templates to **current PR head** + named checks (do not rewrite SHA into the same commit) |
| Draft → Ready | Ready for review; **merge blocked** by human `MERGE-860: WAIT` |
| Merged? | **No** |

### Bind merge decisions to verified head + these checks

**Must be PASS on the verified head:** Test Gate; Composition Gate; RPC/contracts (`check:stack-migration-prep` / contract validation); RLS canary; architecture-boundary-check (incl. effective `checkRegisteredHostPackages`).

**Known-red by design (do not greenwash):** PostgreSQL baseline 16/25; Atlas 1/3; GATE-02 Cookie A; GATE-01 full npm audit High.

**Not covered by Known-Red:** a new Browser E2E failure on this head.

## Continuation order (binding under MERGE-860: WAIT)

1. **Required human freigaben** — `MERGE-860:` decision + `GATE-01/#784` ORM decision (neither granted by this package).
2. **Merge #860** — only after ALLOW (or equivalent) lifts WAIT.
3. **Close / status reconcile #782 / #783** — after #860 lands on main under the agreed merge close rule.
4. **Start #789 (MIG-010)** — only with explicit freigabe / `@ecc-runner-loop` activation.

Do **not** start #789 before merge #860 and #782/#783 status reconcile.

## next_action (human)

1. Review this correction package on PR #860 (effective host checker + RPC/#789 path sync).
2. Revisit **`MERGE-860:`** `ALLOW-KNOWN-RED` | `WAIT` | `REQUIRE-REVIEW-FIRST` — see [MERGE-POLICY-860.md](MERGE-POLICY-860.md). Current: **WAIT**.
3. **GATE-01/#784:** `APPROVED — Drizzle` | `APPROVED — ZenStack` | `REJECTED` — see [GATE-01-decision-package.md](GATE-01-decision-package.md). Must not replace host modular monolith.

## Safety

No architecture APPROVED invented. No assertion softening. No prod cutover. No merge under WAIT. No GATE-01 freigabe.
