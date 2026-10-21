# Edge Function `characters`

## VORHER
- Path: `supabase/functions/characters/`
  - `supabase/functions/characters/index.ts`
- Methods: DELETE, GET, OPTIONS, POST, PUT
- Authz: **UNREACHABLE via `main` dispatcher**; `edge-dispatcher-allowlist.ts` denies this legacy unauthenticated worker. Do not expose successor until a verified owner/service authorization contract is implemented and approved.
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
- Service module: `server/src/services/characters/`
- Depends on gates: GATE-02, GATE-03
- Status: **BLOCKED — do not mount the successor** until owner/service authorization, denylist parity and the exact operation-specific contract are verified; GATE-02/03 approval is necessary but not sufficient.
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
