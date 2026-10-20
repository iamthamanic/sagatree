# Edge Function `character-avatar-meshy`

## VORHER
- Path: `supabase/functions/character-avatar-meshy/`
  - `supabase/functions/character-avatar-meshy/index.ts`
- Methods: OPTIONS, POST
- Authz: JWT/membership required
- Shared: `ai-provider-resolve-meshy.ts`, `avatar-3d-generation.ts`, `avatar-meshy-rate-limit.ts`, `avatar-meshy-remesh.ts`, `avatar-meshy-rigging.ts`, `avatar-meshy-text-to-3d.ts`, `cors.ts`, `item-model3d-glb.ts`, `item-model3d-meshy.ts`
- Secrets/env: `MESHY_API_BASE_URL`, `MESHY_AVATAR_USE_MOCK`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`
- Rate limits: rate-limit logic present in source — extract exact limits before port
- Side effects: Document DB/storage/provider writes from source before coding
- Call sites:
  - `src/infrastructure/character/avatar/character-avatar-meshy-service.ts`

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
- Service module: `server/src/services/character-avatar-meshy/`
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
