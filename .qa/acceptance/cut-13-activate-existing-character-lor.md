# Acceptance — CUT-13 Activate existing character lore (#1148)

## Intent
Host-first character background generation via activated `createCharacterLoreUseCases` and `POST /api/v1/ai/character-lore`. Soft-DENY removed. Without provider: typed `not-configured` degraded result; no Supabase fallback when host library is on.

## Evidence
- `scripts/cut-13-character-lore.self-test.mjs` — mock OpenAI-compatible provider: OK story/provider/model; not-configured without model; 401/403 unauth; foreign project deny before provider (legacy 500); rate-limit 429.
- `scripts/mig-405-character-lore.self-test.mjs` — isolated contract remains green with `CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED === true` and mount assertions.
- Matrix row `character-lore.generate-background` → `HOST_VERIFIED` (counts 89 / 33).
- FE: `src/infrastructure/character/character-lore-service.ts` dual-path host HTTP.

## UI/UX
Unchanged CharacterBackgroundComposer affordance, spinner, and German errors. No Aiberto UI.

## Non-goals respected
No new providers, no AI-GM, no UI redesign, no Edge removal (CUT-20).
