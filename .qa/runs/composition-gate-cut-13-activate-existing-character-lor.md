# Composition Gate — cut-13-activate-existing-character-lor (#1148)

- HEAD_SHA: dbab93bb3a75d6396ef83f6c5dbefed732cfdd7b
- BASE_SHA: 8cf4e4d81abaf441e4b1db64d7fa96aae05a63a5
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none (CUT-13 activates existing character-lore host ports)

## Event

Under host-first, CharacterBackgroundComposer calls `characterLoreService.generateBackground`
which POSTs to `/api/v1/ai/character-lore`. Actor is resolved from Better Auth session;
use-case enforces rate/size/authz, resolves provider (user Ollama prefs or CHARACTER_AI_*),
builds prompt with authorized project/world references, invokes inference, returns draft
story only (no characters row writes). Soft-DENY removed. Without provider: `not-configured`.

## Hop chain

1. **Producer (UI):** CharacterBackgroundComposer
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed POST `/api/v1/ai/character-lore`
4. **Authorize:** session Actor + project GM/member + world owner fail-closed
5. **Infer:** `generateCharacterLoreStory` (env / user prefs)
6. **Consumer:** same composer — draft text only until user accepts

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot use foreign project lore | Legacy 500 before provider | pass |
| Invalid/missing | No model configured | `not-configured` 200 | pass |
| Dual-path | Flag off → Edge character-lore | Exclusive | pass |
| Two consumers / crash | Quota in process memory; draft not persisted | Shared use-case store | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + HTTP + provider hops changed; covered by cut-13-character-lore.self-test with
injected deterministic host inference adapter.
