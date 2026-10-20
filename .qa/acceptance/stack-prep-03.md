# Feature: ST-MIG PREP-03 — GATE-01..05 measurable PoC criteria (#776)

## Intent

Publish reproducible PASS/FAIL PoC contracts for GATE-01..05 without approving any technology choice.

## Happy Path

- [x] Each gate file: variants, setup, PASS table, negatives, decision criteria, On APPROVED blockers
- [x] GATE-04 covers concurrent revision + idempotency; GATE-02 revoke/reconnect + roles
- [x] `stack-migration-prep-check` requires gate files + criteria needles
- [x] No ADR marked APPROVED by agent; dependents remain needs-design until human

## Composition Gate

- Proof: `.qa/runs/composition-gate-stack-prep-03.md`
