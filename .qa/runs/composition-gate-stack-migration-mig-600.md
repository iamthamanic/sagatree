# Composition Gate — stack-migration-mig-600 (#845)

- HEAD_SHA: PLACEHOLDER
- BASE_SHA: 8f866c0ad393fbfba127ab28f26dae6e0879f984
- HOP_DIGEST: PLACEHOLDER
- Date: 2026-10-31
- Verdict: CLEAR

## Event

Host negative authz suite runs owner/GM/player/outsider/otherGm authorize matrix against real SQLite, asserts secret markers absent from player projections, and proves canaries detect disabled filters / always-allow membership stubs. Coverage inventory lists every MIG-600 Depends-on with executed path + explicit HTTP publicActivation open-blocker (no silent parity).

## Hop chain

1. Producer: Authz fixture actors + session projection input (secret marker)
2. Authorize: PolicyService deny-by-default (`createPermissionsPorts`)
3. Persist: Host SQLite worlds/projects/members/assets/rulesets/saga_definitions
4. Project: `projectSessionSnapshot` role filter
5. Consumer: test-gate self-test + Browser E2E contract + coverage report

## Simulations

### N-actors
Owner edits world; GM runs session; players read project; outsider/otherGm denied on primary resources; players never receive secret marker.

### Invalid/missing
Missing actor / unknown op / empty resource ids remain deny-by-default (covered by MIG-013 + this matrix).

### Two consumers / crash
Suite evidence regenerated per gate run; HTTP mounts stay inactive until MIG-602.

## Flags

- Acceptance tier: feature-security
- Deferred integration: host HTTP publicActivation / FEATURE VERIFIED → MIG-602/#847
- SLICE DONE does not imply RELEASE APPROVED
