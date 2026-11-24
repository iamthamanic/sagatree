# Auth + AI GM rate limits (#670)

> **Historisch — beschreibt den stillgelegten früheren Backend-Stack, nicht den Produkt-Stack.** Produktbetrieb: [`host-compose-profiles.md`](host-compose-profiles.md) · [`../../README_SELFHOST.md`](../../README_SELFHOST.md). Diese Seite bleibt nur, solange archivgebundene Checks sie lesen, und wird mit der Archiv-Löschung (#1328, Phase 2) entfernt.

Abuse ceilings for expensive and credential-stuffing surfaces.

## AI GM (`ai-gm`)

| Layer | Behavior |
|-------|----------|
| Postgres RPC `consume_ai_gm_rate_limit` | Atomic per-user window (default **12 / 60s**, env `AI_GM_RATE_LIMIT`) |
| Edge `ai-gm` | Calls RPC **after** membership gate, **before** Ollama/LLM |
| Missing service-role / RPC failure | **503 fail-closed** — no unbounded LLM calls |
| Quota exhausted | **429** with German error body |

**Dispatcher note:** `ai-gm` stays **off** the Edge allowlist (#668) until a remount ticket. The limiter lands first so remount cannot ship without quota. Live Ollama storm tests require an explicit allowlist change.

Static gate: `node scripts/ai-gm-auth-rate-limit-check.mjs` (wired into `test-gate`).

Unit: `deno test supabase/functions/_shared/ai-gm-rate-limit_test.ts`.

## Auth (login / signup)

| Layer | Behavior |
|-------|----------|
| Kong `rate-limiting` on `/auth/v1` | **30 req/min / IP**, `fault_tolerant: false` → **429** when exceeded or plugin store fails |
| GoTrue env ceilings | `GOTRUE_RATE_LIMIT_EMAIL_SENT` (default 10), OTP/verify/token-refresh caps in `docker-compose.yml` |
| Login UI | Maps HTTP **429** / rate-limit errors to: *„Zu viele Anmeldeversuche…“* |

Restart Kong after `kong.yml` / `KONG_PLUGINS` changes so the plugin loads (`docker compose up -d supabase-kong` or full stack recreate for plugin list).

## Related

- Pattern source: `003_character_lore_rate_limits.sql` / `character-lore-rate-limit.ts`
- Negative authz suite still covers JWT deny for foreign `ai-gm` sessions when the mount is reachable
