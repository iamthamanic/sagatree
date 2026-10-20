# Edge Function `session-recap`

## VORHER
- Path: `supabase/functions/session-recap/`
  - `supabase/functions/session-recap/index.ts`
- Methods: OPTIONS, POST
- Authz: JWT/membership required
- Shared: `cors.ts`, `session-recap-prompt.ts`, `session-recap-provider.ts`, `session-recap-rate-limit.ts`
- Secrets/env: `CHARACTER_AI_RATE_LIMIT_PER_MINUTE`, `SESSION_RECAP_AI_RATE_LIMIT_PER_MINUTE`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`
- Rate limits: rate-limit logic present in source — extract exact limits before port
- Side effects: Document DB/storage/provider writes from source before coding
- Call sites:
  - `src/infrastructure/session/session-recap-ai-service.ts`

### Payload
```json
{
  "note": "Parse index.ts before implement; document exact body fields in successor PR"
}
```

### Success
```json
{
  "note": "Match current response shape field-for-field"
}
```

### Errors
- `401/403` / `authz`: fail closed
- `4xx/5xx` / `errors`: no secret leakage

## NACHHER
- Service module: `server/src/services/session-recap/`
- Depends on gates: GATE-02, GATE-03
- Status: SPEC — implement after GATE-02/03 + host HTTP skeleton; no unsupervised API framework choice
- Must preserve fail-closed authz, secret handling, CORS shared pattern

## TESTS
- Auth reject without valid session (if auth function)
- Happy-path parity vs current Edge response shape
- Error bodies contain no env secrets
- CORS OPTIONS via shared cors equivalent

## GRENZEN
- No unsupervised choice of HTTP framework (GATE-03)
- No dropping membership/rate-limit/secret checks
- No production LiveKit/AI credentials in CI fixtures
- Do not mark GATE APPROVED from this ticket
