# Composition Gate — stack-migration-rpc-saga-provision (#873)

- HEAD_SHA: 79642fd62e3bb1feba31bf3f6e30294509590069
- BASE_SHA: 75fba0cd03e053041359abc04f86548f0ea4bda7
- Date: 2026-10-25
- Verdict: CLEAR

## Event

RPC-SAGA-PROVISION: create/duplicate/ensure use-cases compose saga lookup → project provision writes with actor GM membership. No UI composition.

## Hop chain

1. Producer: command use-case (`create_project_from_saga_version` / duplicate / ensure)
2. Saga lookup: `lookupPublishedVersionForProvision` / native slug (existence + published)
3. ACL: origin native|user open; private_backfill owner-only; duplicate GM-only
4. Persist: world + project + project_members in one IMMEDIATE transaction
5. Consumer: project membership / later session adapters (deferred)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner create/dup; stranger ensure own; stranger BF deny; user-pub open | self-test | pass |
| Invalid/missing | mismatch version / bad mode | self-test | pass |
| Two consumers / crash | ensure idempotent same project | self-test | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: Dornhain seed repair → MIG-600/#845; HTTP → MIG-311/#810; FEATURE → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No cutover, no Supabase shutdown, no desktop release.
