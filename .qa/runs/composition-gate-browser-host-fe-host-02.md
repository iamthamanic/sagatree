# Composition Gate — browser-host-fe-host-02 (#1094)

- HEAD_SHA: 8ce8d10984cbbcdc133ed2d1e0c1b52d3200da40
- BASE_SHA: 0e3f87abcc0a2540d816814e51da09b1ec4b235e
- Date: 2026-11-03
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: #1095–#1101 remaining Browser Host Cutover; lobby ready remains non-authoritative local echo on host; Supabase path remains default when host library flag is off

## Event

With `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL, session create/list/join/status/leave,
runtime snapshot/commands/presence, invites, and recap read go to host HTTP
(`/api/v1/sessions*`) backed by `sessionInfra` / SQLite ports; without the flag,
existing Supabase RPCs remain.

## Hop chain

1. **Producer (UI):** Session hooks/services call infrastructure facades
2. **Gate:** `isHostLibraryEnabled()` (`host-library-http` / `host-session-http`)
3. **Transport:** credentialed `fetch` to host `/api/v1/sessions*`
4. **Authorize:** Actor from cookie session (solo AUTH_NOT_CONFIGURED loopback only); ports deny strangers
5. **Persist:** SQLite session lifecycle/access/runtime/recap stores
6. **Consumer:** Same facades re-read host or Supabase path exclusively per process env

Cardinality: one session request set per authenticated browser session owner. No cross-owner fan-out.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | User A never sees User B session runtime via host. | Host routes bind actor from session; ports filter membership. | pass |
| Invalid/missing | Unauthenticated create / stranger snapshot DENY; unknown session not-found. | 401/403/404 fail-closed; no owner invent. | pass |
| Two consumers / crash | Dual-path exclusive; runtime CAS + idempotency on host store. | Flag off → Supabase only; flag on → host only. | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| identity: runtime seed roster object | flag | lifecycle seed → apply presence | Seed used `roster: {}`; mergePresence expected array → INVALID_OPERATION | done: seed `roster: []` + gameplay shape |
| presence: missing userId | flag | setSessionPlayerPresence | Presence payload omitted actor userId | done: default userId to actorId |

## Skip reason

n/a

## Notes

- MIG-020 transport canary on `/snapshot` + `/commands` remains for isolated-contract.
- Product durable runtime is `/api/v1/sessions/:id/runtime*`.
