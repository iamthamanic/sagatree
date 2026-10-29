# Composition Gate — stack-migration-mig-417 (#833)

- HEAD_SHA: WORKTREE (pre-commit; updated to tip SHA at commit)
- BASE_SHA: cff2ad02ba33e91533c9a1b10d938e077c5cf6ac
- Date: 2026-10-29
- Verdict: CLEAR

## Event

Legacy Edge `npcs` Map quarantined under npc-creature module; host/dispatcher keep 404; prompt unused; Map ≠ npc_creature policy; no public mount.

## Hop chain

1. Producer: npcs-quarantine fixtures (defaults / generate / memory / relationship / dialogue)
2. Authorize: none (`NPCS_PUBLIC_ACTIVATION_AUTHORIZED=false`)
3. Persist: none (in-memory characterization only)
4. Consumer: self-test / future MIG-600

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | No shared public route | allowlist deny + host 404 | pass |
| Invalid/missing | dialogue spread override | fixture-proven legacy defect | pass |
| Two consumers / crash | No durable NPC Map | Maps only in fixtures | pass |
| Legacy defects | no auth; unused prompt; spread override | fixtures | pass |

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: authorized host routes + MIG-600; `NPCS_PUBLIC_ACTIVATION_AUTHORIZED=false`

## Non-claims

No cutover, no Supabase shutdown, no desktop release, no FEATURE VERIFIED.
