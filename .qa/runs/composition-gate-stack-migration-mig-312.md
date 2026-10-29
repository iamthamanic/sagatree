# Composition Gate — stack-migration-mig-312 (#811)

- HEAD_SHA: 231728cee779d3e3600b93bf720ff07651f5b7d2
- BASE_SHA: fd090e5ca2686d2ade5c14add11dd9e49bea7010
- Date: 2026-10-29
- Verdict: CLEAR
- Scope: committed HEAD (includes fingerprint renewal)

## Event

Authenticated actor ensures own `user_profiles` row, loads own/batch peer profiles, and uploads own avatar under `user-avatars` via host `userProfile` ports. Foreign claimed writes DENY. Supabase user-profile facades remain production default. No HTTP public activation. 0 RPCs.

## Hop chain

1. Producer: Profile / AccountAvatar UI or infrastructure user-profile service successor (or host dual-path adapter)
2. Authorize: verified actor; own write + peer-readable select; never client-claimed foreign owner
3. Persist: SQLite `user_profiles` + `dataDir/user-avatars/{ownerId}/…` objects under user-profile module
4. Project: UserProfileVm with signed avatarUrl (signing failure → null URL, row retained)
5. Consumer: `createHost` wires `userProfile`; FE `createHostUserProfileAdapter` dual-path seam (Supabase default remains); FE cache/event publishes returned URL

## Simulations

### N-actors
Owner ensure + upload. Teammate batch-visible with signed avatar. Stranger foreign claim DENY. Signing failure still returns teammate row with avatarUrl null.

### Invalid/missing
Missing actor → missing-actor. Invalid magic/MIME/size rejected. Update failure after object write cleans orphan and retains prior avatar_path.

### Two consumers / crash
Object deletion best-effort / non-atomic vs row update (legacy regression). Adapter seam returns same own profile as host ports. createHost exposes userProfile moduleId. No delete-avatar / display-name mutation methods.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
- No user-profile HTTP mount in this slice
- Skip MIG-305/#804 waiting-dependency; Dependabot #982–#984 deferred
- Browser E2E: SKIPPED (no UI surface in this slice)
