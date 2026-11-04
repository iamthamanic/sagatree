# Composition Gate — browser-host-fe-host-14 (#1119)

- HEAD_SHA: a65ef27191f90cd3e47c9db0cd60aa50fb90b1aa
- BASE_SHA: c48e7dbab9747167229b2e04faf01ca3ecd1faeb
- Date: 2026-11-04
- Verdict: CLEAR
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)
- Acceptance tier: feature-integration
- Deferred integration: none for FE-HOST cutover residuals (optional Edge AI remains Info soft-degraded)

## Event

Clear host-first Medium AI/Meshy residual DENYs: session recap save + peer
profile batch host HTTP; AI credentials/Ollama under host-first; optional Meshy
soft-degraded without PostgREST hang.

## Hop chain

1. Cookie actor → `PUT /api/v1/sessions/:id/recap` → sessionInfra recap save → SQLite.
2. Cookie actor → `POST /api/v1/user-profile/batch` → catalog profile ports → SQLite.
3. FE host-first → `host-session-http` / `host-catalog-http` / `host-ai-invoke` (no Edge).
4. Optional Meshy/lore/thumbnail → soft German unavailable (Info allowlist).

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot save foreign session recap | self-test | pass |
| Invalid/missing | Unauth profile batch → 401/403 | HTTP status | pass |
| Two consumers / crash | Batch returns peer profiles; missing ids omitted | catalog route | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Notes

Self-test: `scripts/fe-host-14-ai-residuals.self-test.mjs`
