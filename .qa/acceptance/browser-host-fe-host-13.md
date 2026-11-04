# Acceptance — browser-host-FE-HOST-13 (#1118)

## Intent

Remove host-first DENY for saga-definition authoring by mounting owner-scoped
host HTTP over existing `sagaInfra` ports + FE dual-path. Residual allowlist
row „Saga definition RPC editor“ marked DONE.

## Preconditions

- Host auth enabled; `isHostLibraryEnabled()` true (host-first).
- Actor has a Better Auth cookie session (or solo AUTH_NOT_CONFIGURED loopback).

## Happy Path

1. Authenticated GM `POST /api/v1/saga-definitions` with `{ title, blurb? }` → 201 `{ saga: { sagaId, versionId, revision } }`.
2. Same GM `GET /api/v1/saga-definitions/:sagaId/editor` → 200 editor with `canEdit: true`.
3. Same GM `PUT /api/v1/saga-definitions/:sagaId/draft` with `{ payload, expectedRevision }` → 200 draft revision bump.
4. Same GM `POST /api/v1/saga-definitions/:sagaId/publish` → 200 `{ publish: { versionId, versionLabel } }`.
5. FE `sagaDefinitionService.*` under host-first uses host HTTP (no PostgREST).

## Edge Cases

- Unauthenticated / stranger → 401/403 DENY (no create/edit/publish).
- Stale `expectedRevision` → 409 (`40001`).
- Native saga immutable save → 403 (`42501`).
- Legacy opt-out (`VITE_SAGATREE_HOST_LIBRARY=0`) keeps Supabase path.

## Required Tests

- `scripts/fe-host-13-saga-definition.self-test.mjs` — happy path + unauthorized DENY + owner scope.
- Wired into `npm run test-gate`.
- Residual doc row DONE; fe-host-09 residual needle still coherent.
- `mig-310-saga-adapter.self-test` updated for HTTP mount + dual-path.

## Security Coverage

- **B-01 / owner scope:** actor from cookie only; owner ids never client-supplied.
- **B-04 / IDOR:** stranger cannot edit/publish foreign saga.
- **SC-01 / SC-02 / SC-06:** auth required; no secrets; German error UX on FE.
- **F-03:** no silent anon Supabase fallback under host-first.
- All severities reviewed (Critical→Info): residual Medium row closed; promote/AI residuals remain listed.

## Launch Checklist (SC)

- [x] Acceptance written before implement
- [x] Self-test DENY + happy path
- [ ] Composition gate CLEAR when hops change
- [ ] PR + ECC Merge Gate + merge
