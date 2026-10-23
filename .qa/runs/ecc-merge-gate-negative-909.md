# ECC Merge Gate — negative evidence

- Date: 2026-10-23
- Command: `ECC_MERGE_GATE_SKIP_CHECKS=1 node scripts/ecc-merge-gate-check.mjs 909`
- Result: **FAIL** (exit 1) — 5 unresolved P1/P2 findings on merged PR #909
- Control: same command on #912 after resolve replies → **PASS** (exit 0)

This proves an open P1/P2 review finding blocks the machine merge gate.
