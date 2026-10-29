# Composition Gate — stack-migration-mig-304 (#803)

- HEAD_SHA: e9ee4fb994a67ba3de1c18ee5ea75ebdb994ccfb
- BASE_SHA: 0c5c050fbe36d40eebd343f7b6f54b425a312c1c
- Date: 2026-10-29
- Verdict: CLEAR

## Event

Authenticated owner creates/edits/duplicates/archives LookProfiles via host `look` ports. Foreign actors receive DENY. Reference-analysis quarantine (MIG-412) remains unmounted. Browser LookRuntime style adapters stay local (no persistence hop).

## Hop chain

1. Producer: Look Editor / infrastructure look-service successor (or host dual-path adapter)
2. Authorize: verified actor; owner_user_id from actor only (no client-claimed owner)
3. Persist: SQLite `look_profiles` + append-only `look_profile_versions` under BEGIN IMMEDIATE
4. Project: LookProfileRecord with immutable `LK-XXXXX` publicId + current version payload
5. Consumer: `createHost` wires `look` ports; FE `createHostLookAdapter` dual-path seam (Supabase default remains)

## Simulations

### N-actors
Owner O creates/lists/archives own profiles; stranger X gets empty list / not-authorized on get/append/archive/duplicate. Public ids never retarget to another owner.

### Invalid/missing
Missing actor → missing-actor. Provider-blob drafts rejected. Foreign storage paths for reference analysis DENY (MIG-412 assertOwnerScopedStoragePath). 0/11 refs rejected; 1..10 accepted.

### Two consumers / crash
Profile + version rows committed atomically; reload after reopen returns same publicId and version payload. Archived sources may duplicate to a new active profile (new publicId).

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
- No LookProfile / look-reference-analysis HTTP mount in this slice
