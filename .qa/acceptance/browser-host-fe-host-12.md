# Acceptance — browser-host-FE-HOST-12 (#1117)

## Intent

Remove host-first DENY for project create/update/delete (and Session-Look)
by mounting owner-scoped host HTTP + FE dual-path. Residual allowlist row
„Project create/update/delete“ marked DONE.

## Preconditions

- Host auth enabled; `isHostLibraryEnabled()` true (host-first).
- Actor has a Better Auth cookie session (or solo AUTH_NOT_CONFIGURED loopback).

## Happy Path

1. Authenticated GM `POST /api/v1/projects` with `{ name, description?, worldProfileId? }`
   → 201 project with `publicId` (SA-…), `code`, `gmUserId` = actor, world bound
   (provided owned world or auto-allocated owned world).
2. Same GM `PATCH /api/v1/projects/:id` (title/description/status/world/look settings)
   → 200 updated projection; look ids only when owned by actor (or null clear).
3. Same GM `DELETE /api/v1/projects/:id` → 200 `{ ok: true }`; project gone from list.
4. Same GM `PATCH /api/v1/sessions/:sessionId/look` with `{ lookProfileId }` → 200;
   null clears override.
5. FE `projectService.createProject` / `updateProject` / `deleteProject` /
   `updateSessionLookSettings` under host-first use host HTTP (no PostgREST).

## Edge Cases

- Unauthenticated / stranger → 401/403 DENY (no create, no mutate, no delete).
- Non-GM member cannot PATCH/DELETE.
- Unknown project/session → 404.
- Foreign `worldProfileId` / `lookProfileId` → 403/422 (no elevated client FKs).
- Legacy opt-out (`VITE_SAGATREE_HOST_LIBRARY=0`) keeps Supabase path.

## Required Tests

- `scripts/fe-host-12-project-writes.self-test.mjs` — happy path + unauthorized DENY + owner scope.
- Wired into `npm run test-gate`.
- Residual doc row DONE / removed; fe-host-09 residual needle still coherent.

## Security Coverage

- **B-01 / owner scope:** GM from cookie actor only; `gm_user_id` never client-supplied.
- **B-04 / IDOR:** stranger cannot mutate/delete; world/look FKs must be owned/accessible.
- **SC-01 / SC-02 / SC-06:** auth required; no secrets in responses; German error UX.
- **F-03:** no silent anon Supabase fallback under host-first.
- All severities reviewed (Critical→Info): residual Medium row closed; no new Info debt beyond migration archive rows.

## Launch Checklist (SC)

N/A — not a launch ticket (feature residual cutover only).

## Deferred

- Saga definition editor HTTP → FE-HOST-13 (#1118)
- AI/Meshy/media residuals → FE-HOST-14 (#1119)

## Implementation Notes

- Migration `0030_project_writes.sql`: project look columns + `play_sessions.look_profile_id`.
- `ProjectPorts.createBlank` / `updateOwned` / `archiveOwned` (soft-archive; list omits archived).
- HTTP: `POST|PATCH|DELETE /api/v1/projects`, `PATCH /api/v1/sessions/:id/look`.
- FE: `host-project-http` + `project-service` dual-path under `isHostLibraryEnabled()`.
- Self-test: `scripts/fe-host-12-project-writes.self-test.mjs` (wired in test-gate).
- Residual allowlist row marked DONE (FE-HOST-12).
