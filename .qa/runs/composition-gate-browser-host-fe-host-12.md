# Composition Gate — browser-host-FE-HOST-12 (#1117)

**Verdict:** CLEAR  
**HEAD:** `3b6dbea37e905d260fa8c1dc725b17904a9b5a9b`  
**Slug:** browser-host-fe-host-12

## Producer → consumer

1. Cookie actor → `mountProjectHttpRoutes` → `ProjectPorts.createBlank/updateOwned/archiveOwned` → SQLite `projects`.
2. Cookie actor → `PATCH /api/v1/sessions/:id/look` → `SessionLifecyclePort.setSessionLookProfile` → `play_sessions.look_profile_id`.
3. FE `project-service` (host-first) → `host-project-http` → above routes (no PostgREST).

## Simulations

- N-actors: stranger cannot PATCH/DELETE GM project or session look (self-test).
- Invalid fallback: missing name / foreign look / unauth → 4xx DENY.
- Concurrent consumers: library list omits archived after DELETE; create returns publicId+code for FE toast.

## Deferred integration

- FE-HOST-13 saga definition HTTP; FE-HOST-14 AI/Meshy residuals.
