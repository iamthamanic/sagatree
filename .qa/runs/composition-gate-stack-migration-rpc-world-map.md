# Composition Gate — stack-migration-rpc-world-map (#861)

- HEAD_SHA: d7a84abdfff9977674071a37639526b69c50c942
- BASE_SHA: 12cc8db0ede3f03f270a5d6d5a070abdc8673231
- Date: 2026-10-25
- Verdict: CLEAR

## Event

World map get/save after review fixes: Actor (+ linked solos) → WorldPorts → project.actorCanAccessWorld for membership; world_maps CAS under BEGIN IMMEDIATE; non-editor pin filter forced server-side.

## Hop chain

1. Producer: get_world_map / save_world_map use-cases
2. Authorize: world owner (incl. linkedSoloActorIds) edit; owner or project.actorCanAccessWorld read
3. Persist: world_maps only (module world); revision read inside BEGIN IMMEDIATE
4. Consumer: DTO projection (full for editor; pin-filtered for non-editor, including false-like discovered)

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner/linked save; player filtered; stranger 42501 | self-test | pass |
| Invalid/missing | size/pin 22023; missing≡unauthorized 42501; CAS 40001 | self-test | pass |
| Two consumers / crash | IMMEDIATE lock before revision read; null/-1 bypass | self-test | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: HTTP adapter → later MIG; FEATURE → MIG-602/#847
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No cutover, no Supabase shutdown, no desktop release.
