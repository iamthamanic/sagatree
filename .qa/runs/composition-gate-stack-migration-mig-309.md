# Composition Gate — stack-migration-mig-309 (#808)

- HEAD_SHA: bac28dea731e04efe81def724e92f2780eb12f20
- BASE_SHA: 778d14b85d1f4fcf5f824bee183d7d25004e7a1c
- HOP_DIGEST: d956c3d2cff40ca9f9255ce78cae02e695611c1eabbd0be5ac4e03238a83a99c
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Authenticated actors load ruleset catalog via host `rulesets` ports. Custom creates/updates require creator ownership; official rows stay immutable and publicly readable.

## Hop chain

1. Producer: Catalog UI / infrastructure ruleset-service successor call
2. Authorize: `permissions.authorize(ruleset.read|write)` with official/public/owner rules
3. Project: SQLite `rulesets` rows ordered official DESC, name ASC
4. Consumer: `createHost` wires `rulesets` ports for host HTTP/use-cases

## Simulations

### N-actors
Owner and stranger share official rows; only owner sees private customs until `is_public`.

### Invalid/missing
Missing actor, foreign update, official mutate → DENY with explicit codes.

### Two consumers / crash
Catalog reconstructed from SQLite after host restart; no client role elevation.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: Frontend adapter cutover + feature E2E → MIG-311/#810 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
