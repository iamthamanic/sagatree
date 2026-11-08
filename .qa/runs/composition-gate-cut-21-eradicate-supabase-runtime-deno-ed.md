# Composition Gate — cut-21-eradicate-supabase-runtime-deno-ed (#1156)

- HEAD_SHA: 26dd612faadc38db45b9546a9cf146bb9dd38aeb
- BASE_SHA: 755b89e58edd6c9792d81cd4b6f5bfb70cedf611
- Date: 2026-11-08
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none for CUT-21 product runtime (Docker/docs compose convergence remains CUT-22 #1157)

## Event

Supabase/Deno Edge trees leave the product import graph. Historical SQL and
Edge sources move to `archive/supabase-legacy/` and are not imported by
`src/**` or `server/**` product boot. `@supabase/supabase-js` is removed;
`src/lib/supabase.ts` is SDK-free (`rewriteBrowserStorageUrl` only). Host
`/functions/v1/*` public activation stays unauthorized.

## Hop chain

1. **Producer (UI):** AuthGate / Library / Session / Catalog panels (unchanged host-first)
2. **Gate:** `getHostAuthBaseUrl()` / Better Auth cookie session
3. **Transport:** credentialed Host `/api/v1/*` only (no Edge `/functions/v1` product mount)
4. **Authorize:** Better Auth actor; server-side membership / owner scope
5. **Store:** Host SQLite / AssetPorts; archive SQL is evidence-only
6. **Consumer:** same UI — host DTO → view-model mapping

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot read/write foreign owner rows | Host HTTP 401/403 before mutate | pass |
| Invalid/missing host URL | Fail closed, no GoTrue/SDK fallback | SDK-free stub + Soft-DENY German | pass |
| Two consumers / crash | Concurrent library reads independent | Stateless host GET | pass |
| Archive import | Product must not import archived Edge/SQL | cut-21 self-test + ban PASS | pass |
| Deno product check | No Deno binary required for test-gate | Deno Edge check skipped | pass |
| Elevation | Client cannot invent elevated origin/FK | Host whitelist + server authority | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
