# Composition Gate — browser-host-fe-host-12 (#1117)

- HEAD_SHA: a701f2059a51074f30f885cfa33e70c4e08c5fdf
- BASE_SHA: 9a1de6faaf39db9b6e7f2e746f090a31ed1c865a
- Date: 2026-11-04
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: FE-HOST-13 saga definition HTTP; FE-HOST-14 AI/Meshy residuals

## Event

Host project create/update/archive + session look override HTTP; FE dual-path under host-first.
Codex P2: full Actor through session-look write; archived Look profiles rejected on bind.

## Hop chain

1. Cookie actor → `mountProjectHttpRoutes` → `ProjectPorts.createBlank/updateOwned/archiveOwned` → SQLite `projects`.
2. Cookie actor (full Actor incl. linkedSoloActorIds) → `PATCH /api/v1/sessions/:id/look` → `SessionLifecyclePort.setSessionLookProfile` → `play_sessions.look_profile_id`.
3. FE `project-service` (host-first) → `host-project-http` → above routes (no PostgREST).

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot PATCH/DELETE GM project or session look | self-test | pass |
| Invalid/missing | Missing name / foreign look / archived look / unauth → 4xx DENY | assertOwnedLook + look status | pass |
| Two consumers / crash | Library list omits archived after DELETE; create returns publicId+code | soft-archive | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Notes

Self-test: `scripts/fe-host-12-project-writes.self-test.mjs`
