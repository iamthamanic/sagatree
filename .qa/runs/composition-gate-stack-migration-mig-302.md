# Composition Gate — stack-migration-mig-302 (#801)

- HEAD_SHA: fd395a45597a1266bfe85d1b46385ca86ce78302
- BASE_SHA: 7422b400d133e26fe78262d876f557a22dc2abf4
- Date: 2026-10-30
- Verdict: CLEAR

## Event

Authenticated owner creates/reads/updates/soft-deletes own PC sheets via host `character` ports. Foreign actors receive DENY. Presets catalog reads are owner/public scoped. Avatar artifact paths resolve only for live PC rows under `{ownerUserId}/…`. Soft-deleted PCs fail membership/session bind and display-name projection. Browser creator/VRM/LiveAct utilities stay local (no persistence hop).

## Hop chain

1. Producer: Character Editor / infrastructure character-service successor (or host dual-path adapter)
2. Authorize: verified actor id; `owner_user_id` from actor only (no client-claimed owner); PC-only sheet ports
3. Persist: SQLite `characters` (+ sheet columns) / `character_presets` / `character_avatar_artifacts` under host single-writer (`BEGIN IMMEDIATE` on create/update)
4. Project: CharacterSheetRecord with immutable `CH-XXXXX` publicId + sheet JSON payload; complete status gated
5. Consumer: `createHost` exposes `character` ports; FE `createHostCharacterAdapter` dual-path seam (Supabase default remains)

## Simulations

### N-actors
Owner O creates/lists/updates/deletes own characters; stranger X gets empty list / not-authorized on get/update/delete. Concurrent owner updates re-read fields under IMMEDIATE. Cross-owner portrait/artifact DENY. NPC/gm_presence rows invisible to sheet and artifact ports.

### Invalid/missing
Missing name → name-required. Elevating to complete without class/race/profile/attributes/skills → incomplete-sheet. Soft-deleted rows hidden from get/list/displayName and fail assertOwnedCompletePc.

### Two consumers / crash
Sheet row committed under IMMEDIATE lock; reload after reopen returns same publicId and sheet payload. Soft-delete sets `deleted_at`; subsequent get returns null.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
- No character sheet HTTP mount (`CHARACTER_INFRA_PUBLIC_ACTIVATION_AUTHORIZED = false`)
