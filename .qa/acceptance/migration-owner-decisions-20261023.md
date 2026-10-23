# Feature: Migration owner decisions + evidence-based readiness (PR #908)

## Intent

Lock the seven owner architecture decisions into canonical migration contracts, classify all 90 Epic #773 child issues with merge/acceptance evidence (not GitHub-closed alone), sync GitHub bodies/labels, and ship PR #908 without inventing READY/DONE.

## Preconditions

- Branch `docs/migration-owner-decisions-20261023` / PR #908
- Owner decisions recorded in `docs/architecture/migration-owner-decisions-2026-10-23.md` and GATE ADRs
- Completion proofs under `.qa/evidence/stack-migration-prep/completion/`

## Happy Path

- [x] Generator preserves DONE + completionEvidence; auto-READY only when all transitive predecessors are DONE with evidence
- [x] 12 DONE tickets with hashed migration-acceptance proofs (gates + closed MIG work)
- [x] Exactly 2 READY tickets (MIG-014/#793, MIG-015/#794) — no mass unlock
- [x] ATLAS-LIVE-E2E remains BLOCKED while baseline Atlas CI is not-passing
- [x] `npm run check:stack-migration-prep` PASS (with `STACK_MIGRATION_PYTHON` venv)
- [x] `node scripts/stack-migration-contract-validation.test.mjs` 33/33 PASS
- [x] `npm run test-gate` PASS on this HEAD
- [x] Readiness artifact `.qa/evidence/stack-migration-prep/readiness-2026-10-23.json`
- [x] Idempotent publish helper `scripts/stack-migration-issue-publish.mjs` syncs 90/90

## Edge Cases

- [x] Architecture freigabe alone does not mark implementation tickets DONE
- [x] Source fingerprint alone does not mark DONE
- [x] Closed GitHub without completionEvidence is rejected by validator
- [x] Ambient known CI reds (Atlas, PG baseline, isolated GATE candidates) documented — not greenwashed

## Security Coverage

- F/B/P: no new auth surface; readiness only unlocks MIG-014/015 which still implement cookie-only constraints from GATE-02 ADR
- SC-01…SC-07: N/A — not a launch ticket

## Composition Gate

- Proof: `.qa/runs/composition-gate-migration-owner-decisions-20261023.md`

## Implementation Notes

- Status model: `done` | `ready` | `waiting` | `blocked` (GATE-05 deferred)
- Publish sync updates title/body/labels only; preserves issue numbers and comment history
