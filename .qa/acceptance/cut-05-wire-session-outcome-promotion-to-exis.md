# Acceptance — cut-05-wire-session-outcome-promotion-to-exis (#1140)

## Intent

Session outcome promote-to-saga / promote-to-world runs on host HTTP + SagaInfraPorts under host-first; no soft-DENY.

## Composition Gate

- HEAD_SHA: 8f9376cf3cb2f68c36c178fbafb5d353c16d5537
- Verdict: CLEAR

See `.qa/runs/composition-gate-cut-05-wire-session-outcome-promotion-to-exis.md`.

## Evidence

- `scripts/cut-05-outcome-promotion.self-test.mjs` — GM promote saga/world + idempotent; player/stranger DENY; missing consequence; durable after restart
- Dual-path: `session-outcome-promotion-service` + `promoteHostSessionOutcomeToSaga/World`
- Ports: `SagaInfraPorts.promoteSessionOutcomeToSaga|World` via `POST /api/v1/sessions/:id/outcomes/:cid/promote/{saga|world}`

## UI/UX

Reuse `SessionRecapPromoteActions` and `SagaBetweenSessionsSection`; no new actions or layout.
