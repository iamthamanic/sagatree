# Composition Gate — browser-host-fe-host-08 (#1100)

- HEAD_SHA: PENDING
- BASE_SHA: 34054f43096e270ab0c510879cf0283c1bfd8ee9
- Date: 2026-11-03
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: #1101; lore AI; recap AI generate/save; peer profile batch

## Event

With `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL, marketplace catalog,
rulesets catalog, and own user-profile/avatar go to host HTTP
(`/api/v1/marketplace/*`, `/api/v1/rulesets/*`, `/api/v1/user-profile/me*`)
backed by MarketplacePorts / RulesetPorts / UserProfilePorts + SQLite.
Without the flag, Supabase facades remain.

Character lore AI and session-recap AI generate/save throw explicit German
unavailable errors under the host flag (no Supabase hang). Recap get stays
on host-session HTTP from FE-HOST-02.

## Hop chain

1. **Producer (UI):** Marketplace / Rulesets / Profile screens → infrastructure services
2. **Gate:** `isHostLibraryEnabled()` (`host-library-http` / `host-catalog-http`)
3. **Transport:** credentialed fetch `/api/v1/...` via `host-catalog-http.ts`
4. **Authorize:** Actor from cookie session; author/creator ownership on mutations
5. **Persist:** SQLite marketplace_items / rulesets / user_profiles + avatar bytes
6. **Consumer:** Same UI VMs (snake_case marketplace/ruleset maps; UserProfileVm)

Cardinality: one actor per mutation; catalog reads session-gated; no cross-owner fan-out.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot update/delete foreign marketplace items or rulesets; claimed foreign avatar owner DENY. | Ports + catalog-routes. | pass |
| Invalid/missing | Unauth mutations DENY; missing item → not-found. | 401/403/404 fail-closed. | pass |
| Two consumers / crash | Dual-path exclusive; lore/recap-AI stubs German. | Flag off → Supabase; flag on → host/stub. | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Self-test `scripts/fe-host-08-catalog-http.self-test.mjs` covers marketplace /
rulesets / profile happy-path + DENY + missing. Composition hops are exclusive
dual-path; PUBLIC_ACTIVATION flips only with HTTP mount + FE wire.
