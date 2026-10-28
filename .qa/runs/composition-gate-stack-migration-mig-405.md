# Composition Gate — stack-migration-mig-405 (#821)

- HEAD_SHA: a5ac04877fff0ad0b94d5cbc681ea72ce85b6807
- BASE_SHA: 4532c9d08a3288ec5d7d9f38c7b8ad4b4ec037e1
- Date: 2026-10-28
- Verdict: CLEAR

## Event

Host gains isolated character-lore generate-background use-cases (parse/authz/quota/provider/draft) while Edge allowlisted worker remains the live mount. Public activation stays false; no production cutover.

## Hop chain

1. Producer: Host application `character-lore` use-cases + in-memory rate-limit / reference ports
2. Authorize: Project GM or active membership; world lore only if public or creator matches reference owner (project GM / caller)
3. Persist: Process-memory quota only (characterization of `consume_character_lore_rate_limit`); no `characters` row writes (draft-only)
4. Consumer: Self-test fixtures; production clients still use Edge until RELEASE APPROVED

## Simulations

### N-actors
GM direct-world and active member on GM-owned project world generate; stranger project / unrelated private world / mismatched project-world fail before provider invocation.

### Invalid/missing
128001-byte body → 413; ruleset/UUID rejects → 400; provider absent → 200 not-configured before lore lookup; missing persistent store → 503; 7th request in window → 429.

### Two consumers / crash
Draft-only: `charactersMutations` stays 0; errors never include provider/API secrets; legacy auth denials remain generic 500 (not 403); activation flag remains false.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host HTTP + MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
