# Feature: P0: ECC Merge Gate bei verspäteten P1/P2-Reviews fail-closed absichern

<!-- seeded by ecc-runner from issue #937 on 2026-10-25 — @implement may refine -->

## Intent
Verhindern, dass ein PR trotz erst nach einem grünen ECC-Check eintreffender Codex-/Review-Befunde (P1/P2/Critical/Important) gemergt werden kann. Der Check muss den aktuellen PR-HEAD und die tatsächliche Review-Lage beim Merge berücksichtigen.

## Happy Path
- [x] - [x] Regressionstest reproduziert #934/#935: Nach anfänglichem grünem Gate eintreffender P1/P2 macht den Merge auf demselben HEAD zuverlässig unmöglich.
- [x] - [x] Gate bewertet authoritative Review-Thread-Resolution und Review-Abschluss für den aktuellen HEAD; API-/Status-Unklarheit ergibt BLOCKED, nicht PASS.
- [x] - [x] Review-Ereignisse und Pre-Merge-/Required-Check-Durchsetzung sind so verbunden, dass kein veralteter PASS einen neuen blockierenden Review-Befund übergeht; auch `workflow_run`-Races getestet.
- [x] - [x] Gegenprobe: nach verifizierter Behebung, vollständigen Reviews und grünen Required Checks ist normaler Squash-Merge ohne Bypass möglich.
- [x] - [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases
- [x] (from .qa/edge-cases.md + @implement)

## Regression
- [x] Feed and topic routes still load

## Assumptions
- none

## Screenshots
| Step | Filename |
|------|----------|
| 1 | `01-happy-path.png` |

## Implementation Notes
<!-- filled after coding -->


## Verification evidence

- Self-test: `node scripts/ecc-merge-gate-check.self-test.mjs` → PASS (includes #934/#935 late P1/P2 same-HEAD race, API fail-closed, pending-review fail-closed, Gegenprobe PASS after resolve)
- Workflow: `.github/workflows/ecc-merge-gate.yml` triggers on `pull_request_review` + `pull_request_review_comment` so late findings re-run the required check
- Gate: GraphQL `reviewThreads.isResolved` authoritative; REST union; API errors → FAIL
- `npm run test-gate` → PASS
