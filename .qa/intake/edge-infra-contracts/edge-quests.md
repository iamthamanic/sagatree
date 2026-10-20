# Edge Function `quests`

## VORHER
- Path: `supabase/functions/quests/`
  - `supabase/functions/quests/index.ts`
- Methods: GET, OPTIONS, POST, PUT
- Authz: Document if public/dispatcher-only
- Shared: `cors.ts`
- Secrets/env: n/a
- Rate limits: rate-limit logic present in source — extract exact limits before port
- Side effects: Document DB/storage/provider writes from source before coding
- Call sites:
  - `*(none found in src — verify dispatcher/main or dead)*`

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
- Service module: `server/src/services/quests/`
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
