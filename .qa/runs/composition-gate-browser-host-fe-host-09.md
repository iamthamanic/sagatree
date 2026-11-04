# Composition Gate — browser-host-fe-host-09 (#1101)

- HEAD_SHA: 61f824747121a74f74b2a457edf562e0ceff14a6
- BASE_SHA: 147cd035fb43668deef0179f0a19cf24e5c5b019
- Date: 2026-11-04
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: GATE-05; saga-definition HTTP; avatar Meshy/import/export; item Meshy Edge; look analysis; media token; peer profile batch

## Event

With `VITE_SAGATREE_HOST_AUTH_URL` set (and `VITE_SAGATREE_HOST_LIBRARY` not
explicitly off), product runtime is host-first: Library/Editor/World/Session
dual-path facades use host HTTP + Better Auth cookies. `src/lib/supabase.ts`
boots without `VITE_SUPABASE_*` (inert placeholders, no GoTrue session).
`getAuthenticatedUserId` uses `probeHostActor`. Residual Edge/RPC surfaces
DENY via `host-product-deny` / local stubs (German UX).

## Hop chain

1. **Producer (UI):** Library / Session / Atlas / covered dual-path services
2. **Gate:** `isHostLibraryEnabled()` (auth URL ⇒ on; LIBRARY=0 opt-out)
3. **Transport:** credentialed fetch `/api/v1/...` host routes
4. **Authorize:** Better Auth cookie / solo AUTH_NOT_CONFIGURED loopback
5. **Persist:** Host SQLite ports
6. **Consumer:** Same UI VMs; residual surfaces German unavailable

Cardinality: one actor per mutation; no silent anon Supabase fallback.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Unauth library/session DENY; host cookie scopes writes. | Host routes + whoami. | pass |
| Invalid/missing | Opt-out LIBRARY=0 restores legacy; missing auth URL ⇒ host off. | Flag semantics in host-library-http. | pass |
| Two consumers / crash | Residual Edge no hang under host-first. | DENY stubs. | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Self-test `scripts/fe-host-09-host-first.self-test.mjs` covers host-first
wiring + Library write + session + atlas smoke without live Supabase.
Residual allowlist: `docs/architecture/fe-host-09-residual-supabase.md`.
