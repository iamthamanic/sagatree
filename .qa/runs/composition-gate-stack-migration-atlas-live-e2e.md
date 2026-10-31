# Composition Gate — stack-migration-atlas-live-e2e (#770 / ATLAS-LIVE-E2E)

- HEAD_SHA: 17145e40bdaa290a5cfa55220d8c24ba8e2b1f45
- BASE_SHA: 63e93917d89cc4ab85d14f1c2f2abfb90771bbd5
- Date: 2026-11-01
- Verdict: CLEAR
- Note: Isolated product journey already 3/3 PASS on main CI
  (`atlas-isolated-product`, run 41201202311). DONE-evidence sync commit on branch; no fake cutover / no hosted Supabase secrets.

## Event

GM→Player Atlas product path against ephemeral Postgres + GoTrue + PostgREST
(`scripts/stack-migration-db/product-run.mjs`). Browser (Chromium) → Vite
product → loopback proxy → real Auth/REST → real SQL. Three Playwright tests
must all pass without skip/retry.

## Hop chain

1. Producer: CI `npm run product --prefix scripts/stack-migration-db`
2. Bootstrap: embedded PG + platform SQL + repo migrations + synthetic fixtures
3. Transport: GoTrue password grant + PostgREST RPC observations (outsider DENY,
   player secret hide)
4. Browser: Owner persist/rename; outsider alert DENY; dual-player reveal
5. Consumer: `report.json` + `playwright-report.json` (expected=3, unexpected=0,
   skipped=0) — product-run fails closed otherwise

## Simulations

### N-actors
Owner / GM / player1 / player2 / outsider — distinct GoTrue identities; outsider
list maps → 403/42501; players see reveal only after GM `set_saga_binding_reveal`.

### Invalid/missing
Missing fixture path, non-loopback API URL, missing Chromium/tools, or CORS
preflight failure → nonzero exit (no `test.skip`).

### Two consumers / crash
Two independent player browser contexts must both render controlled atlas after
reveal and never show secret title; harness tears down cluster/services in
`finally`.

## Flags

- Acceptance tier: feature-e2e
- Deferred: production cutover / Supabase shutdown → MIG-700+ human RELEASE APPROVED
- SLICE DONE does not imply RELEASE APPROVED
