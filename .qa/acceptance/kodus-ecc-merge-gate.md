# Acceptance — Kodus ECC Merge Gate Integration

## Intent
Extend ECC Merge Gate to require completed Kodus (kody-ai) review on PR HEAD and to block on unresolved Kodus severities (Critical→Info) while preserving Codex P1/P2 fail-closed behavior.

## Required Tests
- [x] `node scripts/kodus-merge-gate.self-test.mjs` PASS (missing/pending/started/spoof/fail/success/dismiss/late)
- [x] `node scripts/ecc-merge-gate-check.self-test.mjs` PASS
- [x] Live negative: `ECC_MERGE_GATE_SKIP_CHECKS=1 node scripts/ecc-merge-gate-check.mjs 993` → exit 1 (kodus-pending and/or unresolved findings)
- [x] Observation evidence: `.qa/evidence/kodus-integration/pr-993-observation.md`

## Non-claims
Does not add "Kody Code Review" as a separate GitHub ruleset required check; enforcement is inside ECC Merge Gate (`requireKodusReview: true`).
