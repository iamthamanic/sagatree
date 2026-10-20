# Edge + Infrastructure contracts (PREP-05 #778)

Edge functions: **24**. Infra areas: **13**. Shared modules inventoried: **49**.

Status: **SPEC only**. No Edge port implementation. GATE-02/03 remain not APPROVED.

## Critical non-generic contracts

- `session-media-token` — LiveKit mint, membership, TTL clamp, degraded-without-secrets, no secret leakage
- `ai-gm` — membership before LLM, persistent rate limit, provider secrets, streaming parity, GM-lore filter gap check

## Edge inventory

| Function | Auth | Secrets | Call sites | Successor |
|---|---|---|---|---|
| `ai-gm` | True | 12 | 0 | `server/src/services/ai-gm/generate-gm-narrative.ts` |
| `ai-provider-credentials` | True | 6 | 1 | `server/src/services/ai-provider-credentials/` |
| `bestiary` | False | 0 | 0 | `server/src/services/bestiary/` |
| `character-avatar-meshy` | True | 5 | 1 | `server/src/services/character-avatar-meshy/` |
| `character-lore` | True | 4 | 1 | `server/src/services/character-lore/` |
| `characters` | False | 0 | 0 | `server/src/services/characters/` |
| `dm-tools` | False | 1 | 0 | `server/src/services/dm-tools/` |
| `export` | False | 0 | 0 | `server/src/services/export/` |
| `item-model3d` | True | 5 | 1 | `server/src/services/item-model3d/` |
| `item-thumbnail` | True | 5 | 1 | `server/src/services/item-thumbnail/` |
| `items` | False | 0 | 0 | `server/src/services/items/` |
| `look-reference-analysis` | True | 5 | 1 | `server/src/services/look-reference-analysis/` |
| `lorekeeper` | False | 0 | 0 | `server/src/services/lorekeeper/` |
| `main` | True | 0 | 0 | `server/src/services/main/` |
| `marketplace` | False | 0 | 0 | `server/src/services/marketplace/` |
| `media` | False | 1 | 0 | `server/src/services/media/` |
| `npcs` | False | 0 | 0 | `server/src/services/npcs/` |
| `quests` | False | 0 | 0 | `server/src/services/quests/` |
| `rulesets` | False | 0 | 0 | `server/src/services/rulesets/` |
| `session-media-token` | True | 6 | 1 | `server/src/services/session-media/mint-session-media-token.ts` |
| `session-recap` | True | 5 | 1 | `server/src/services/session-recap/` |
| `sessions` | False | 0 | 0 | `server/src/services/sessions/` |
| `spellbook` | False | 0 | 0 | `server/src/services/spellbook/` |
| `world` | False | 0 | 0 | `server/src/services/world/` |

## Infrastructure inventory

| Area | RPCs | Tables | Edge invokes | Status |
|---|---|---|---|---|
| `ai` | 0 | 0 | 1 | SPEC |
| `character` | 0 | 7 | 2 | SPEC |
| `inventory` | 0 | 4 | 2 | SPEC |
| `look` | 0 | 0 | 1 | SPEC |
| `marketplace` | 1 | 1 | 0 | SPEC |
| `media` | 0 | 0 | 0 | SPEC |
| `npc-creature` | 5 | 1 | 0 | SPEC |
| `project` | 11 | 1 | 0 | SPEC |
| `rulesets` | 0 | 1 | 0 | SPEC |
| `saga` | 9 | 0 | 0 | SPEC |
| `session` | 12 | 1 | 2 | SPEC |
| `user-profile` | 0 | 1 | 0 | SPEC |
| `world` | 17 | 3 | 0 | SPEC |

## Shared `_shared` modules

- `ai-gm-rate-limit.ts`
- `ai-gm-rate-limit_test.ts`
- `ai-provider-credentials_test.ts`
- `ai-provider-crypto.ts`
- `ai-provider-meshy.ts`
- `ai-provider-registry.ts`
- `ai-provider-resolve-meshy.ts`
- `avatar-3d-generation.ts`
- `avatar-3d-generation_test.ts`
- `avatar-meshy-rate-limit.ts`
- `avatar-meshy-remesh.ts`
- `avatar-meshy-remesh_test.ts`
- `avatar-meshy-rigging.ts`
- `avatar-meshy-rigging_test.ts`
- `avatar-meshy-text-to-3d.ts`
- `character-lore-access.ts`
- `character-lore-access_test.ts`
- `character-lore-prompt.ts`
- `character-lore-prompt_test.ts`
- `character-lore-provider.ts`
- `character-lore-rate-limit.ts`
- `character-lore-rate-limit_test.ts`
- `cors.ts`
- `edge-dispatcher-allowlist.ts`
- `edge-dispatcher-allowlist_test.ts`
- `edge-jwt-gate.ts`
- `edge-jwt-gate_test.ts`
- `item-model3d-glb.ts`
- `item-model3d-meshy.ts`
- `item-model3d-rate-limit.ts`
- `item-model3d_test.ts`
- `item-thumbnail-image.ts`
- `item-thumbnail-meshy.ts`
- `item-thumbnail-prompt.ts`
- `item-thumbnail-rate-limit.ts`
- `item-thumbnail_test.ts`
- `look-reference-analysis-image.ts`
- `look-reference-analysis-provider.ts`
- `look-reference-analysis-rate-limit.ts`
- `media-server-optimize-proof.proof.ts`
- `media-server-optimize-proof.ts`
- `media-server-raster-optimize.proof.ts`
- `media-server-raster-optimize.ts`
- `media-server-raster-optimize_test.ts`
- `session-media-token.ts`
- `session-membership-gate.ts`
- `session-recap-prompt.ts`
- `session-recap-provider.ts`
- `session-recap-rate-limit.ts`
