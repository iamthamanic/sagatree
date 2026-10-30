# Composition Gate — stack-migration-mig-302 (#801)

- HEAD_SHA: 848dbb7d81f8b34a964cb3342962d9292021739f
- BASE_SHA: 7422b400d133e26fe78262d876f557a22dc2abf4
- Date: 2026-10-30
- Verdict: CLEAR
- Note: Composition proof authored for implementation HEAD `848dbb7d`; follow-up commit only refreshes this proof SHA pointer when needed.

## Event

Authenticated owner creates/reads/updates/soft-deletes own PC sheets via host `character` ports. Foreign actors receive DENY. Presets catalog reads are owner/public scoped. Avatar artifact paths resolve only under `{ownerUserId}/…`. Browser creator/VRM/LiveAct utilities stay local (no persistence hop).

## Hop chain

1. Producer: Character Editor / infrastructure character-service successor (or host dual-path adapter)
2. Authorize: verified actor id; `owner_user_id` from actor only (no client-claimed owner)
3. Persist: SQLite `characters` (+ sheet columns) / `character_presets` / `character_avatar_artifacts` under host single-writer
4. Project: CharacterSheetRecord with immutable `CH-XXXXX` publicId + sheet JSON payload
5. Consumer: `createHost` exposes `character` ports; FE `createHostCharacterAdapter` dual-path seam (Supabase default remains)

## Simulations

### N-actors
Owner O creates/lists/updates/deletes own characters; stranger X gets empty list / not-authorized on get/update/delete. Public ids never retarget to another owner. Cross-owner portrait path on create DENY (`foreign-storage-path`).

### Invalid/missing
Missing name → name-required. Soft-deleted rows hidden from get/list. Foreign artifact path DENY via `assertCharacterOwnerStoragePath` / `resolveOwnedArtifact`. Missing artifact under own prefix → not-found.

### Two consumers / crash
Sheet row committed; reload after reopen returns same publicId and sheet payload. Soft-delete sets `deleted_at`; subsequent get returns null.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
- No character sheet HTTP mount in this slice (`CHARACTER_INFRA_PUBLIC_ACTIVATION_AUTHORIZED = false`)
