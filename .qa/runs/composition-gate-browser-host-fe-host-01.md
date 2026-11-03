# Composition Gate — browser-host-fe-host-01 (#1093)

- HEAD_SHA: 8259cb68ff7993d85efe8735ce2e689ce245233b
- BASE_SHA: d37ee8269d6e9b5bffe39f9bb858ccdaf623437e
- Date: 2026-11-03
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: #1094–#1101 remaining Browser Host Cutover slices (sessions/atlas/auth/write-kill); Supabase path remains default when host library flag is off

## Event

With `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL, Library character/world/look/project
list and CRUD hops go to host HTTP (`/api/v1/library/*`) backed by owner-scoped SQLite
ports; without the flag, the same facades keep the existing Supabase path.

## Hop chain

1. **Producer (UI):** Library / EntityBrowser / WorldProfiles hooks call infrastructure facades
2. **Gate:** `isHostLibraryEnabled()` (`host-library-http.ts`) — requires host library flag + auth URL
3. **Transport:** `fetch` to host `/api/v1/library/*` with host session cookie/token (Better Auth bridge)
4. **Authorize:** Host library routes resolve actor from session; ports filter by `actorId` / owner
5. **Persist:** SQLite character/world/look/project ports (Dornhain default seeded on host boot)
6. **Consumer:** Same UI re-reads via the same facade (host or Supabase), no cross-owner fan-out

Cardinality: one Library request set per authenticated browser session owner. No broadcast,
queue, or multi-tenant write path.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | User A never sees User B Library rows via host or Supabase path. | Host routes bind `actorId` from session; ports list/mutate owned rows only. Supabase path keeps owner filters + RLS. Flag is process env, not a user-supplied tenant id. | pass |
| Invalid/missing | Missing host auth / disabled flag must not invent elevated ownership or write to the wrong backend silently as success for foreign data. | Flag off → Supabase only. Flag on without auth URL → bridge disabled / requests fail closed. Host 401/403 surfaces as facade errors; no fallback that rewrites owner. | pass |
| Two consumers / crash | Double-create or reload must not duplicate across Supabase+host or leak half-written foreign rows. | Dual-path is exclusive per process env (not per-request mix). Host writes go only to SQLite ports; Supabase path unchanged when flag off. Idempotent list reads; create returns single owned row. | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| reinterpret: MIG dual-path vs FE-HOST flag | flag | facade header → MIG self-test | MIG-308 required `Dual-path (MIG-308)` note and banned bare env redirects; FE-HOST uses `VITE_SAGATREE_HOST_LIBRARY` via helper (string only in comments). | done: dual-path notes keep MIG ids; env string stays out of executable code |
| identity: legacy infra `host` area | flag | migration prep → inventory | New `src/infrastructure/host/` auto-discovered as MIG infra area without issue map. | done: exclude successor `host` from legacy edge source inventory; skip unmapped infra deps |

## Skip reason

n/a

## Notes

- Scope is Library dual-path only (#1093 / FE-HOST-01). Sessions/Atlas/Auth cutover remain later issues.
- `npm run test-gate` PASS on this worktree before PR.
- Unrelated download/site WIP parked outside the tree for this ship.
