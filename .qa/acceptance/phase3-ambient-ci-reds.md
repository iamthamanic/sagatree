# Acceptance — Phase 3 ambient CI reds (Epic #773 recovery)

## Scope

Follow-up to ECC Quality Recovery: GATE-01 audit, GATE-02/03 evidence, Postgres baseline trust boundaries (mig 109), Atlas player projection + Draufsicht overlap. No architecture change.

## Acceptance criteria

- [x] GATE-01 `npm audit --audit-level=high` clean via compatible overrides.
- [x] GATE-02/03 `--check` PASS after verified evidence refresh (design-doc hash drift).
- [x] Postgres baseline security probes PASS (cross-saga, redaction, foreign leave, DEFINER forge, recap, dice).
- [x] Atlas isolated product journeys PASS (owner nav + GM reveal player WebGL).
- [x] RPC source contracts / docs regenerated for mig 109.

## Composition Gate

See `.qa/runs/composition-gate-phase3-ambient-ci-reds.md`.
