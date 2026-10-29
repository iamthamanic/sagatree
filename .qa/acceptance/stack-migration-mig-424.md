# Acceptance — stack-migration-mig-424 (#840)

## Intent

Characterize unmounted Edge `world` as an isolated Map quarantine; host keeps 404 until separate activation.

## Acceptance

- [x] world routes remain dispatcher404, including settings and clock writes.
- [x] Isolated fixture pins create defaults, discovery, event filtering, faction relationship and 30-day calendar rollover.
- [x] Negative/nonfinite/huge hours must be bounded in any replacement; persistent world_profiles/world-atlas APIs remain separate and preserve their visibility policies.
- [x] Verpflichtende Legacy-Regression: No authentication or project ownership; arbitrary shallow updates allowed. Clock labels Gregorian but uses 30-day months and lacks numeric bounds.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Tier

`isolated-contract` — no production cutover / public activation.

## Proof

`node --experimental-strip-types scripts/mig-424-world-quarantine.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Composition

See `.qa/runs/composition-gate-stack-migration-mig-424.md` (CLEAR).
