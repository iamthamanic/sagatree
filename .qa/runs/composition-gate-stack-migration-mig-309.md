# Composition Gate — stack-migration-mig-309 (#808)

- HEAD_SHA: f3f992cf54f2323b402de1ca8e1de595db748511
- BASE_SHA: 778d14b85d1f4fcf5f824bee183d7d25004e7a1c
- HOP_DIGEST: 7d61ca33c4c68adb008cefd04c30b37895bf12fc39f0d28a32d87ce05d098342
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
