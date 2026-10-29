# Composition Gate — stack-migration-mig-308 (#807)

- HEAD_SHA: (filled at PR open / merge)
- BASE_SHA: 9b5c04fe9f298ebd70c90c381932bfdb207f4d52
- Date: 2026-10-29
- Verdict: CLEAR

## Event

Authenticated GM/member creates project session, joins by code, assigns own character, reloads overview/permissions/bindings via host `projectInfra` ports. Foreign actors receive DENY. Supabase project facades remain production default. No HTTP public activation.

## Hop chain

1. Producer: Library / infrastructure project-* / saga-* service successor (or host dual-path adapter)
2. Authorize: verified actor; GM/membership/character ownership enforced in predecessor use-cases (never client-claimed roles)
3. Persist: SQLite projects / project_members / play_sessions / saga grants+bindings under composed project-infra ports
4. Project: session/overview/permissions/bindings VMs with audience-safe projections (reveal/bundle rules)
5. Consumer: `createHost` wires `projectInfra`; FE `createHostProjectAdapter` dual-path seam (Supabase default remains)

## Simulations

### N-actors
GM ensures starter / sets bundles / reveals bindings; player joins, sets own character, creates project session, reads overview/party bindings. Stranger gets DENY on overview/permissions/session/reveal. Foreign character bind DENY.

### Invalid/missing
Missing actor → 42501. Unknown join code DENY. Player cannot set member bundle. Invalid reveal rejected by governance store.

### Two consumers / crash
Ensure starter returns existing GM project (`created: false`) with same publicId. Reveal to party makes binding visible on player list after reload. Adapter seam returns same permission projection as host ports.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
- No project-infra HTTP mount in this slice
- Skip MIG-305/#804 waiting-dependency; Dependabot #982–#984 deferred
