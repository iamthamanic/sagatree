# Composition Gate — browser-host-fe-host-03 (#1095)

- HEAD_SHA: 4f680153b0ce1195c1362313508dce271118d582
- BASE_SHA: c3121d116640ebe4ee904e0281b4ebcb851cbf62
- Date: 2026-11-03
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: #1096–#1101 remaining Browser Host Cutover; Azgaar/pin Storage uploads deferred; Supabase path remains default when host library flag is off

## Event

With `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL, world map get/save, atlas list/ensure/get/upsert,
and places list/upsert/links/node mutations go to host HTTP (`/api/v1/worlds*`) backed by `WorldPorts` /
SQLite; without the flag, existing Supabase RPCs remain.

## Hop chain

1. **Producer (UI):** Atlas / map / place hooks call infrastructure facades
2. **Gate:** `isHostLibraryEnabled()` (`host-library-http` / `host-world-http`)
3. **Transport:** credentialed `fetch` to host `/api/v1/worlds*`
4. **Authorize:** Actor from cookie session (solo AUTH_NOT_CONFIGURED loopback only); ports deny strangers
5. **Persist:** SQLite world map / atlas / places stores via WorldPorts
6. **Consumer:** Same facades re-read host or Supabase path exclusively per process env

Cardinality: one world request set per authenticated browser session owner. No cross-owner fan-out.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | User A never sees User B atlas/map/places via host. | Host routes bind actor from session; ports filter ownership/membership. | pass |
| Invalid/missing | Unauthenticated ensure-root / stranger list DENY; unknown map not-found. | 401/403/404 fail-closed; no owner invent. | pass |
| Two consumers / crash | Dual-path exclusive; atlas revision conflict → 409 DE UX. | Flag off → Supabase only; flag on → host only. | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| n/a | — | — | — | — |

## Skip reason

n/a

## Notes

- Storage uploads (Azgaar, pin images, signed URLs) throw clear DE deferred message under host flag.
- Self-test: `scripts/fe-host-03-world-http.self-test.mjs`.
