# Feature: ST-MIG PREP-05 — Edge + infrastructure contracts (#778)

## Intent

Specify all 24 Edge Functions and 13 `src/infrastructure` areas individually so later coding agents do not invent authz, secrets, or API shapes.

## Happy Path

- [x] `inventory.json` covers 24 edges + 13 infra areas with successors and requiredTests
- [x] Per-function/area markdown under `.qa/intake/edge-infra-contracts/`
- [x] Non-generic contracts for `session-media-token` (LiveKit) and `ai-gm` (membership, rate limit, provider)
- [x] `SPLIT_TICKETS.md` for PR-sized EDGE-* / INFRA-* successors
- [x] `stack-migration-prep-check` validates edge inventory completeness
- [x] No Edge port implementation; GATE-02/03 remain not APPROVED

## Composition Gate

- Proof: `.qa/runs/composition-gate-stack-prep-05.md`
