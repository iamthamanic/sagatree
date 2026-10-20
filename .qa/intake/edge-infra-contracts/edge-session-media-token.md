# Edge Function `session-media-token`

## VORHER
- Path: `supabase/functions/session-media-token/`
  - `supabase/functions/session-media-token/index.ts`
- Methods: POST, OPTIONS
- Authz: Bearer JWT → auth/v1/user; membership via service-role REST on sessions + project_members (status=active)
- Shared: `cors.ts`, `session-media-token.ts`
- Secrets/env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`
- Rate limits: none documented — preserve any existing
- Side effects: None persistent. Mints short-lived LiveKit JWT; room name derived server-side; API secret never returned.
- Call sites:
  - `src/infrastructure/session/media/media-token-client.ts`

### Payload
```json
{
  "sessionId": "string (required)",
  "ttlSeconds": "number optional 30..300 (default 120)"
}
```

### Success
```json
{
  "ok": true,
  "token": "jwt",
  "url": "LIVEKIT_URL",
  "roomId": "sagatree-session-{sessionId}",
  "expiresAt": "ISO",
  "ttlSeconds": "number",
  "grant": {
    "canPublish": "bool",
    "canSubscribe": "bool",
    "receiveOnly": "bool"
  }
}
```

### Errors
- `401` / `unauthorized`: missing/invalid JWT
- `403` / `forbidden`: no active project_members OR role cannot subscribe
- `400` / `bad_request`: invalid JSON / missing sessionId
- `405` / `method_not_allowed`: non-POST
- `503` / `media_service_unavailable`: missing SUPABASE_* or LIVEKIT_* — gameplay continues degraded

## NACHHER
- Service module: `server/src/services/session-media/mint-session-media-token.ts`
- Depends on gates: GATE-02
- Status: BLOCKED until GATE-02 auth successor + LiveKit secret injection design (no prod secrets in CI)
- Must preserve fail-closed authz, secret handling, CORS shared pattern

## TESTS
- No Authorization → 401 unauthorized degraded; no token field
- Valid JWT but non-member → 403 forbidden; no LiveKit call
- Viewer without director → canSubscribe true, canPublish false, receiveOnly true
- Player/GM → canPublish+canSubscribe; roomId === sagatree-session-{id}
- Response body never contains LIVEKIT_API_SECRET or service role key
- ttlSeconds 999 clamped to 300; ttlSeconds 1 raised to 30
- Missing LIVEKIT_* → 503 media_service_unavailable; client treats as degraded not hard crash
- Cross-sessionId for other project → 403

## GRENZEN
- No unsupervised choice of HTTP framework (GATE-03)
- No dropping membership/rate-limit/secret checks
- No production LiveKit/AI credentials in CI fixtures
- Do not mark GATE APPROVED from this ticket
