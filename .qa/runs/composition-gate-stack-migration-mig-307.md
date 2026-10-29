# Composition Gate — stack-migration-mig-307 (#806)

- HEAD_SHA: faba2a5310fa6d1dc75893bc12aa313616172dd5
- BASE_SHA: f59e3968806adcd263b2f185ca573dc205359749
- Date: 2026-10-29
- Verdict: CLEAR

## Event

Authenticated owner creates/edits/archives/duplicates NPC definitions via host `npc-creature` ports; GM spawns/updates/removes session instances and assigns/clears controllers. Foreign actors receive DENY. Supabase facade remains production default. No HTTP public activation.

## Hop chain

1. Producer: Library / infrastructure npc-creature-service successor (or host dual-path adapter)
2. Authorize: verified actor; owner_user_id from actor only (no client-claimed owner); instance mutations narrow-GM + membership
3. Persist: SQLite `npc_creature_definitions` (+ `public_id` / `payload_version`) and instance/controller tables under host ports
4. Project: NpcDefinitionRecord with immutable `NPCC-XXXXX` publicId + payload; instance rows with snapshot/runtime
5. Consumer: `createHost` wires `npcCreature` ports; FE `createHostNpcCreatureAdapter` dual-path seam (Supabase default remains)

## Simulations

### N-actors
Owner O creates/lists/archives own personal definitions; stranger X gets empty list / not-authorized on get/update/archive/duplicate. GM-only spawn/update/remove/assign/clear; player/stranger DENY. Public ids never retarget to another owner.

### Invalid/missing
Missing actor → missing-actor. Drafts with embedded id/scope or missing name rejected. Foreign personal definition not readable for spawn.

### Two consumers / crash
Definition create/update reload returns same publicId and payload. Clear temp controllers sets JSON null only on session-scoped instances; permanent controller assignment is a separate table. Remove deletes instance row; reload finds none.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP cutover + feature E2E → MIG-600/#845 + MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
- No NpcCreature definition/instance HTTP mount in this slice
- Quarantine npcs/bestiary publicActivation remains false
