# Edge Function `ai-gm`

## VORHER
- Path: `supabase/functions/ai-gm/`
  - `supabase/functions/ai-gm/index.ts`
- Methods: GET /health, POST, OPTIONS
- Authz: assertSessionMemberAccess(sessionId) before any LLM/lorekeeper; persistent per-user rate limit (#670)
- Shared: `cors.ts`, `ai-gm-rate-limit.ts`, `session-membership-gate.ts`
- Secrets/env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `CHARACTER_AI_PROVIDER`, `CHARACTER_AI_MODEL`, `CHARACTER_AI_BASE_URL`, `CHARACTER_AI_API_KEY`, `OLLAMA_HOST`, `OLLAMA_MODEL`, `AI_GM_RATE_LIMIT`, `LOREKEEPER_URL`, `SESSIONS_URL`
- Rate limits: AI_GM persistent quota
- Side effects: May call lorekeeper NPC context; may updateSessionWorldState; consumes persistent rate-limit counter; must not leak gm_only lore to non-GM (verify/filter parity)
- Call sites:
  - `*(none found in src — verify dispatcher/main or dead)*`

### Payload
```json
{
  "sessionId": "string",
  "action": "string ≤5000",
  "context": "Partial SessionContext",
  "stream": "bool default true",
  "ruleset": "dnd5e|pathfinder2e|custom",
  "tone": "serious|lighthearted|dark|heroic"
}
```

### Success
```json
{
  "stream": "NDJSON narrative chunks then complete with worldStateUpdate/diceRollsRequired/combatInitiated",
  "nonStream": "GMResponse JSON"
}
```

### Errors
- `400` / `validation`: missing sessionId/action or action too long
- `401` / `Authentication required`: rate-limit path without user
- `403` / `membership gate`: assertSessionMemberAccess deny
- `429` / `rate limit`: persistent AI_GM quota window
- `503` / `service unavailable`: missing service-role config or rate-limit store failure

## NACHHER
- Service module: `server/src/services/ai-gm/generate-gm-narrative.ts`
- Depends on gates: GATE-02, GATE-03
- Status: BLOCKED on GATE-02/03 + provider credential store design (ai-provider-credentials parity)
- Must preserve fail-closed authz, secret handling, CORS shared pattern

## TESTS
- Non-member POST → 403 before provider call (mock provider must not be hit)
- Missing JWT on rate-limit path → 401
- Exceed AI_GM_RATE_LIMIT in window → 429 German error; no narrative
- Happy path stream emits narrative then complete metadata
- action length >5000 → 400
- Provider/API key never present in error JSON
- GM-only NPC memories not included for player-role callers (document filter; mark BLOCKED parity gap if current edge lacks filter)
- Health GET returns provider+model without secrets

## GRENZEN
- No unsupervised choice of HTTP framework (GATE-03)
- No dropping membership/rate-limit/secret checks
- No production LiveKit/AI credentials in CI fixtures
- Do not mark GATE APPROVED from this ticket
