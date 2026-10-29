# Acceptance — MIG-420 Session-Media-Token Host Port (#836)

## Intent
Port allowlisted Edge `session-media-token` contracts onto the host as an isolated use-case surface under `server/src/application/session-media-token/`. Edge remains the live mount; no public activation or production cutover.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host HTTP adapters + MIG-600/#845 + MIG-602/#847. `SESSION_MEDIA_TOKEN_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] Distinct active player/GM/viewer accounts receive only server-derived room/identity/grants; foreign account 403 and caller-supplied role/capabilities/room ignored.
- [x] Decode JWT and verify HS256 signature, iss/sub/nbf/iat/exp plus room; TTL omitted→120, 1→30, 999→300.
- [x] No project_members row → 403 even if legacy session_players fixture exists; inactive member → 403.
- [x] Missing LIVEKIT_URL/API_KEY/API_SECRET → 503 degraded and no secret values in response; gameplay state unchanged.
- [x] Record null-body/nonfinite-TTL and config/auth gaps as required successor input/error tests.
- [x] Legacy regression: no explicit fetch timeout, no worker-wide exception normalization, no finite TTL guard; source verification does not approve those gaps.
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-420-session-media-token.self-test.mjs` → PASS

## Security Coverage
- SC-01: /auth identity → sessions.project_id → project_members(status=active); session_players never grants; roles gm→gamemaster, observer→viewer; capabilities not trusted from client.
- SC-02: N/A — no uploads.
- SC-03: N/A — no worker-specific quota in source.
- SC-06: LiveKit API secret never returned; degraded errors omit secrets.
- Out of scope: production cutover / host HTTP mount.

## Launch Checklist (SC)
N/A — not a launch ticket.

## Evidence
`node --experimental-strip-types scripts/mig-420-session-media-token.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Implementation Notes
Isolated host ports under `server/src/modules/session/internal/session-media-token.ts` + slim barrel + application use-cases; Edge allowlist unchanged; no `create-app` mount.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-420.md` (CLEAR).
