# Composition Gate — ai-organize-ollama-settings

- HEAD_SHA: a80496fd6b72db58caf31adeef59da409c37aa14
- BASE_SHA: 3c6c97bdeac822b8c4d1489ec4b1ef5825d6f248
- Date: 2026-10-21
- Verdict: CLEAR
- Diff scope (AI tab): profile Organize/BYOK list UX + `ollama-settings` Edge + Lore/Recap/ai-gm resolve + shared list hook

## Event

User saves Ollama prefs (local or Cloud) under Settings → AI → Organize; later Character-Lore / Session-Recap / AI-GM resolve **that same owner row** (else Env). Bild/3D/Video/Audio BYOK keep one credential row per `(user_id, provider_id)` via edit modal (UI-only change; vault hop unchanged).

## Hop chain

1. **Producer (UI):** `OllamaOrganizePanel` → `OllamaOrganizeEditDialog` → `ollamaSettingsService.invoke('ollama-settings')`
2. **Persist:** Edge `ollama-settings` → SSRF `assertSafeOllamaBaseUrl` → AES-GCM encrypt → upsert **one** `user_ai_provider_credentials` on `(user_id, provider_id=ollama)` with meta `{ useCloud, baseUrl, model }` (key never returned plaintext)
3. **Transform/resolve:** `_shared/ollama-llm-resolve` `loadOllamaSettingsForUser` → `prefsToProviderConfig` (local native vs cloud openai-compatible + Bearer)
4. **Consumers:** `character-lore` / `ai-gm` → `resolveLlmProviderForUser`; `session-recap` → prefs then Env fallback
5. **Side-effect:** one LLM HTTP call per existing lore/recap/gm request (unchanged cardinality)
6. **UI-label:** list shows Verbunden + Endpoint/Modell/keyHint (sans); no secret in DOM

BYOK Bild/3D/Video/Audio: `AiProviderCredentialsPanel` → `AiProviderCredentialsEditDialog` → `ai-provider-credentials` (existing hop; list/search/edit-modal only).

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| 1 event, N actors | User A prefs never apply to User B | JWT `user_id` + service_role filter on credentials; consumers pass caller userId | pass |
| invalid / missing | Bad URL / cloud without key / missing encrypt → fail-closed; no prefs → Env | `assertSafeOllamaBaseUrl`; cloud requires key; 503 `encryption-missing`; resolve falls back to env | pass |
| 2 consumers / crash | Lore + Recap + ai-gm share one prefs row; crash mid-upsert does not leak key | Same `provider_id=ollama`; client never stores secret; responses omit plaintext; upsert is merge-duplicates | pass |

## Live reachability (ops check, not hop meaning)

- `POST http://127.0.0.1:8000/functions/v1/ollama-settings` without JWT → **401** `Nicht angemeldet.` (function mounted; Kong OK)
- `CREDENTIALS_ENCRYPTION_KEY` present in `sagadrive-edge` env

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Skip reason

n/a
