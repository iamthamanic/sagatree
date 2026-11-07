# Composition Gate — cut-20-remove-all-supabase-dual-path-fr (#1155)

- HEAD_SHA: bc7a6023fb43ad4678721e77ad49ffa38f98482d
- BASE_SHA: 45836838d25368565aaced3513e9ffdf4ebb6222
- Date: 2026-11-07
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none (CUT-20 removes dual-path routing; Soft-DENY remains for #1159–#1162 only)

## Event

Product FE Library / Auth / Session / Catalog / Avatar / Marketplace / NPC
facades call Host HTTP + Better Auth cookies only. No
`VITE_SAGATREE_HOST_LIBRARY=0` opt-out; no Supabase `from` / `rpc` /
`functions.invoke` / `storage` / GoTrue product path in `src/**`.

## Hop chain

1. **Producer (UI):** AuthGate / Library / Session / Inventory / Avatar panels
2. **Gate:** `isHostLibraryEnabled()` (host auth URL required; fail closed)
3. **Transport:** credentialed Host `/api/v1/*` (library, project, session, AI, assets)
4. **Authorize:** Better Auth actor; server-side membership / owner scope
5. **Store:** Host SQLite / AssetPorts (no client PostgREST writes)
6. **Consumer:** same UI — host DTO → view-model mapping

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot read/write foreign owner rows | Host HTTP 401/403 before mutate | pass |
| Invalid/missing host URL | Fail closed, no GoTrue fallback | assertHost / Soft-DENY German | pass |
| Dual-path opt-out | Flag=0 → Supabase | Removed; ban self-test PASS | pass |
| Elevation | Client cannot invent elevated origin/FK | Host whitelist + server authority | pass |
| PARITY_MISSING | #1159–#1162 Soft-DENY | Host Soft-DENY, never Edge | pass |
| Two consumers | Concurrent library reads independent | Stateless host GET | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
