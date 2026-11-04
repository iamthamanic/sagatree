# Composition Gate — browser-host-fe-host-10 (#1115)

- HEAD_SHA: 18c050816088ab5b5297ef4c5e59d5f09e494d8e
- BASE_SHA: ed1ea80a38070b35a6cf59ba6c8add50ba41c079
- Date: 2026-11-04
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: FE-HOST-11 atlas seed; FE-HOST-12 project writes; FE-HOST-13 saga HTTP; FE-HOST-14 AI/Meshy residuals; GATE-05

## Event

Host-first product defaults: Better Auth demo users get per-actor Dornhain
via ensure-starter; MIG-015 solo identity + FE auto-link; Library mutations
honor linked solo owners; Vite `/api` same-origin proxy; Dashboard „Session hosten“.

## Hop chain

1. **Producer (UI):** Login / Library / ensureNativeStarterProject
2. **Gate:** `isHostLibraryEnabled` + host cookie session
3. **Transport:** credentialed `/api/auth`, `/api/solo/*`, `/api/v1/library/*`, ensure-starter
4. **Authorize:** Better Auth cookie; solo link confirm; owner-scoped ids
5. **Persist:** Host SQLite (`ensureDornhainDefaultCatalog` + library ports)
6. **Consumer:** Library VMs / Session hosten CTA

Cardinality: one remote actor per owned Dornhain copy; shared saga slug reused.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Two remotes each get ≥4 Dornhain pregens | ensure-starter + scoped catalog ids | pass |
| Invalid/missing | Unauth library/whoami DENY | fe-host-07 self-test | pass |
| Two consumers / crash | Solo link optional; owned seed still works | project-infra fallback | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Residual risk

Atlas geometry still empty until FE-HOST-11; residual DENY allowlist otherwise unchanged.
