# Feature: ST-MIG PREP-02 — Atlas live E2E as migration prerequisite (#775)

## Intent

Bind GitHub #770 as the sole Atlas live product E2E acceptance gate for Epic #773 cutover; document isolated-CI blockers; ensure MIG-700/MIG-702 cannot proceed without it.

## Happy Path

- [x] #770 linked (no duplicate issue); design `.qa/design/atlas-live-e2e-cutover-gate.md`
- [x] `ATLAS-LIVE-E2E.githubIssue = 770`; MIG-700/702 depend on it; prep-check enforces
- [x] Spec rejects mocks/optional skip as cutover proof; CI enablement BLOCKED pending ATLAS-CI-* freigabe
- [x] No production credentials or migration implementation in this PR

## Composition Gate

- Proof: `.qa/runs/composition-gate-stack-prep-02.md`
