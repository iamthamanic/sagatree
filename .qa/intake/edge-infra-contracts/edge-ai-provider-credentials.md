# Edge Function `ai-provider-credentials`

## VORHER
- Path: `supabase/functions/ai-provider-credentials/`
  - `supabase/functions/ai-provider-credentials/index.ts`
- Methods: OPTIONS, POST
- Authz: JWT/membership required
- Shared: `ai-provider-crypto.ts`, `ai-provider-meshy.ts`, `ai-provider-registry.ts`, `cors.ts`
- Secrets/env: `AI_PROVIDER_CREDENTIAL_RATE_LIMIT_PER_MINUTE`, `CREDENTIALS_ENCRYPTION_KEY`, `MESHY_API_BASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`
- Rate limits: rate-limit logic present in source — extract exact limits before port
- Side effects: Document DB/storage/provider writes from source before coding
- Call sites:
  - `src/infrastructure/ai/ai-provider-credentials-service.ts`

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
- Service module: `server/src/services/ai-provider-credentials/`
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

## FUNCTION-SPECIFIC (non-generic)
- **Purpose:** Store/retrieve AI provider credentials for owners
- **Auth:** Owner-only; never echo secrets in list endpoints
- **Security:** Encrypt-at-rest / redact in logs; rate-limit updates

