# Composition Gate — phase3-ambient-ci-reds

- HEAD_SHA: 677e635eead95e1db5d058ba004f2c76998bab26
- BASE_SHA: 2431d446b73a81a4f2e66489c63c5519358e58c7
- Date: 2026-10-23
- Verdict: CLEAR

## Event

Ambient migration CI reds that blocked autonomous ECC merge loops are closed without weakening gates: dependency audit overrides stay high-severity clean, GATE evidence hashes match verified PASS runs, legacy SECURITY DEFINER helpers refuse forged actors / foreign leave / cross-saga atlas reads, player atlas get keeps renderable generator_meta, and Draufsicht no longer intercepts Werkzeuge. RPC inventories and docs stay bound to the new migration bodies.

## Hop chain

1. Producer: `supabase/migrations/109_baseline_security_trust_boundaries.sql` + GATE-01 lock overrides
2. Postgres probes / Atlas Playwright product journeys (isolated DB)
3. Frontend atlas editor (`useWorldAtlasEditor` sagaPublicId + UnifiedAtlas Draufsicht placement)
4. RPC extract/docs/proof fingerprints → Test Gate / stack-migration-prep-check
5. Consumer: ECC Merge Gate + required ruleset checks before merge

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors / cross-saga | Player A cannot list B-only revealed maps | list_world_atlas_maps membership gate | pass |
| Invalid/missing | anon/auth forge append_session_event / adventure p_is_gm | 42501; no mutation | pass |
| Two consumers / crash | Atomic leave no-op for foreigners; dice survives restart | leave + PAR-08-DICE fixtures | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

Does not approve production cutover / GATE-05. Does not disable ambient checks. MIG-022 remains next READY after hold lift.
