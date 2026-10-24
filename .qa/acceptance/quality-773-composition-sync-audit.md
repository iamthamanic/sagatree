# Acceptance — quality-773 composition / sync / audit

## Composition Gate

See `.qa/runs/composition-gate-quality-773-composition-sync-audit.md` (CLEAR).

## Checks

- [x] Composition gate accepts historical squash range `ad68c8df..a678e6da` on push mode
- [x] Composition self-test: evidence SKIPPED, missing proof FLAGGED, stale BASE FLAGGED, squash CLEAR, PR fake HEAD FLAGGED, lineage CLEAR
- [x] MIG-022 Fall 4b: publisher throw does not fail COMMIT or re-mutate on replay
- [x] GATE-02/03 `npm audit --audit-level=high` → 0 vulnerabilities (`body-parser@2.4.0` override)
- [x] GATE-02/03 PoC `--check` PASS after evidence rewrite
- [x] GitHub READY issues #798/#799/#805/#808/#842/#843 → `agent-ready` (waiting-dependency removed)
- [x] Post-merge workflow `.github/workflows/stack-migration-github-sync.yml` runs publish `--write --verify`
