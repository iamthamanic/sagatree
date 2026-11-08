# Composition Gate — cut-22-converge-docker-vps-configs-ci-doc (#1157)

- HEAD_SHA: 608dbffaa50f1d24ebb3688343241184f8603564
- BASE_SHA: c5111c786ddcc6e78e95f3b2e649db59099f6d7c
- Date: 2026-11-08
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: CUT-23 final parity E2E/desktop GATE-05 (#1158/#788); historical Supabase archive retained for audit

## Event

Fresh clone and VPS operators start the Node host via root Compose include of
`deployment/docker-compose.host.yml`. Authoritative docs/env no longer require
Supabase services. Legacy stack remains under `archive/supabase-legacy/` only.

## Hop chain

1. **Producer (ops):** `docker compose --env-file deployment/.env.host up`
2. **Gate:** Compose `include` → host image build (`Dockerfile.host`)
3. **Transport:** published `127.0.0.1:8787` (override via `SAGATREE_HOST_PUBLISH`)
4. **Authorize:** Better Auth secret + cookie origin contract
5. **Persist:** named volume `host-data` → `/data` (SQLite + assets)
6. **Consumer:** `GET /health` + FE `VITE_SAGATREE_HOST_AUTH_URL`

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Solo + remote Compose share createHost | Same dataDir/port contract | pass |
| Invalid/missing | Missing Better Auth secret | Compose fails closed | pass |
| Two consumers / crash | Docs + CI + self-test agree host-only | cut-22 self-test + include | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
