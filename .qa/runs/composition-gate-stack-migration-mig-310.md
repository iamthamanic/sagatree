# Composition Gate — stack-migration-mig-310 (#809)

- HEAD_SHA: 7c1b507d14846aeec8056692981a5eca931c164e
- BASE_SHA: a83f47f577c94279798acfb4b7e728203524ac94
- Date: 2026-10-29
- Verdict: CLEAR
- Scope: committed HEAD (includes fingerprint renewal)

## Event

Authenticated owner creates/edits/saves/publishes saga definitions, copies native, instantiates project, duplicates playthrough, and GM promotes session outcomes via host `sagaInfra` ports. Foreign actors receive DENY. Supabase saga facades remain production default. No HTTP public activation. Source fingerprints renewed for dual-path notes.

## Hop chain

1. Producer: Library / infrastructure saga-definition / session-outcome-promotion service successor (or host dual-path adapter)
2. Authorize: verified actor; owner/GM/membership enforced in predecessor use-cases (never client-claimed roles)
3. Persist: SQLite saga_definitions / versions / projects / session_runtime under composed saga-infra ports
4. Project: editor/version/project/promote VMs with owner-scoped draft privacy and promote side effects
5. Consumer: `createHost` wires `sagaInfra`; FE `createHostSagaAdapter` dual-path seam (Supabase default remains)

## Simulations

### N-actors
Owner creates user saga, saves draft, publishes v1, copies native, instantiates project, duplicates fresh. GM provisions user saga project and promotes shared/gm consequences. Stranger DENY on save/duplicate/promote.

### Invalid/missing
Missing actor → 42501. Native immutable for draft save. Only native copyable (22023). Revision conflict → 40001. Foreign duplicate/promote DENY.

### Two consumers / crash
Publish retains version snapshot; adapter promote of already-promoted consequence returns idempotent. Adapter seam returns same editor projection as host ports. createHost exposes sagaInfra moduleId. Prep-check fingerprints match renewed dual-path notes.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
- No saga-infra HTTP mount in this slice
- Skip MIG-305/#804 waiting-dependency; Dependabot #982–#984 deferred
- Browser E2E: SKIPPED (no UI surface in this slice)
- note: tip may include composition-pin-only commits after HEAD_SHA (proofOnlyChangesSince this file)
