# Acceptance — cut-21-eradicate-supabase-runtime-deno-ed (#1156)

## Intent
Remove Supabase/Deno Edge product runtime from the active tree. Historical SQL and Edge sources remain inert under `archive/supabase-legacy/` and are not imported by product or required for `npm run test-gate` / Deno.

## Happy Path
- [x] `supabase/` and `src/supabase/` are not at repo root product paths; archived under `archive/supabase-legacy/` with README
- [x] No `@supabase/supabase-js` (or JSR equivalent) in `package.json` / product import graph
- [x] `src/lib/supabase.ts` is SDK-free (identity helpers only) or gone; cut-20 ban still PASS
- [x] `npm run test-gate` passes without Deno binary and without live `supabase/functions` at root
- [x] Host `/functions/v1/*` public activation remains unauthorized (existing MIG-414 contract)
- [x] No product feature lost vs CUT-20 host-first baseline (no Soft-DENY expansion for CUT-01 features)

## Composition Gate
See `.qa/runs/composition-gate-cut-21-eradicate-supabase-runtime-deno-ed.md`

## Evidence
- `scripts/cut-21-eradicate-supabase.self-test.mjs`
- test-gate + composition proof on ship HEAD
