# Feature: ST-MIG PREP-06 — Canonical issue contracts + quality gate (#779)

## Intent

Map all migration intake issues to GitHub, attach VORHER/NACHHER/… contract sections, and harden `stack-migration-prep-check` so generic or decision-incomplete tickets cannot become agent-ready.

## Happy Path

- [x] 72/72 localIds mapped to `githubIssue`
- [x] Each issue has `contractSections` (vorher/nachher/verhalten/sicherheit/tests/abhaengigkeiten/grenzen)
- [x] Prep-check rejects missing paths, security, tests, GATE-ready contradictions, generic acceptance boilerplate
- [x] Quality audit evidence under `.qa/evidence/stack-migration-prep/issue-contract-quality-audit.md`
- [x] No technology APPROVED; implementation issues remain blocked where GATE deps exist

## Composition Gate

- Proof: `.qa/runs/composition-gate-stack-prep-06.md`
