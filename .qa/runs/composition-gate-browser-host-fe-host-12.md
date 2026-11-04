# Composition Gate — browser-host-fe-host-12 (#1117)

- HEAD_SHA: f56451cd3b15fbf1391ab0c5a5a2c9264b531475
- BASE_SHA: 9a1de6faaf39db9b6e7f2e746f090a31ed1c865a
- Date: 2026-11-04
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: FE-HOST-13 saga definition HTTP; FE-HOST-14 AI/Meshy residuals

## Event

Host project create/update/archive + session look override HTTP; FE dual-path under host-first.

## Hop chain

1. Cookie actor → `mountProjectHttpRoutes` → `ProjectPorts.createBlank/updateOwned/archiveOwned` → SQLite `projects`.
2. Cookie actor → `PATCH /api/v1/sessions/:id/look` → `SessionLifecyclePort.setSessionLookProfile` → `play_sessions.look_profile_id`.
3. FE `project-service` (host-first) → `host-project-http` → above routes (no PostgREST).

## Simulations

- N-actors: stranger cannot PATCH/DELETE GM project or session look (self-test).
- Invalid fallback: missing name / foreign look / unauth → 4xx DENY.
- Concurrent consumers: library list omits archived after DELETE; create returns publicId+code.

## Proof

- Self-test: `scripts/fe-host-12-project-writes.self-test.mjs`
- `npm run test-gate` PASS on branch tip before PR open.
