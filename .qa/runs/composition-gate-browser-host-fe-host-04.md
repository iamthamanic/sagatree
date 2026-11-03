# Composition Gate — browser-host-fe-host-04 (#1096)

- HEAD_SHA: c782dfa70bc0298f0f5e81341d495b63350e3aff
- BASE_SHA: 2fd0686bd22f0ae69cfb45d020cf41ff8910f1bb
- Date: 2026-11-03
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: #1097–#1101; saga-definition authoring → FE-HOST-05; project_members table leave/list → later

## Event

With `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL, saga overview/permissions/lore/bindings/members
and project join/ensure-starter/set-character go to host HTTP (`/api/v1/sagas*`, `/api/v1/projects*`)
backed by `projectInfra` / SQLite; without the flag, existing Supabase RPCs remain.

## Hop chain

1. **Producer (UI):** Saga hub / join / permission panels call infrastructure facades
2. **Gate:** `isHostLibraryEnabled()` (`host-library-http` / `host-project-http`)
3. **Transport:** credentialed `fetch` to host project/saga routes
4. **Authorize:** Actor from cookie session; projectInfra ports deny strangers
5. **Persist:** SQLite project/saga stores via projectInfra
6. **Consumer:** Same facades re-read host or Supabase path exclusively per process env

Cardinality: one saga/project request set per authenticated browser session. No cross-owner fan-out.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot read foreign saga overview. | Ports require GM/member. | pass |
| Invalid/missing | Unauth overview DENY; unknown public id not-found. | 401/403/404 fail-closed. | pass |
| Two consumers / crash | Dual-path exclusive. | Flag off → Supabase; flag on → host. | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| status: P0002: prefix | flag | infraStatus | Error codes include `P0002:…` suffix | done: startsWith |

## Skip reason

n/a
