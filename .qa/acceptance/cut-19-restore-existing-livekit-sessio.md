# Acceptance — CUT-19 Restore existing LiveKit session media-token (#1154)

## Intent
Lobby/session media token issuance works via Host when LiveKit is configured.
Soft-DENY removed under host library. Without LiveKit: bounded German degraded
`media_service_unavailable`; gameplay continues. No Supabase Edge fallback on host-first.

## Preconditions
- Better Auth session (or solo loopback).
- Optional: `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL`.

## Happy Path
1. Active project member (GM/player) POSTs `/api/v1/sessions/:sessionId/media-token`.
2. Host hydrates session + `project_members` from SQLite; derives room/role server-side.
3. Response: `token` / `url` / `roomId` / `expiresAt` / `ttlSeconds` / `grant`.
4. Client-supplied role/capabilities/room ignored.

## Edge Cases
- No LiveKit env → 503 degraded
- Unauthenticated → 401/403
- Foreign / non-member → 403
- Invalid `ttlSeconds` → 400
- Soft-DENY string absent from FE client

## Security Coverage
- Actor from Better Auth; membership from host DB (linked solo ids honored).
- LiveKit secret server-only; never in response/logs.
- SC-01/02/03/06 inline; not a launch ticket.

## UI/UX
Existing LobbyDeviceBar / media preview / call UI unchanged.

## Evidence
- `scripts/cut-19-session-media-token.self-test.mjs`
- `scripts/mig-420-session-media-token.self-test.mjs` — activation true
- Matrix `session-media.fetch-token` → HOST_VERIFIED

## Composition Gate
CLEAR — see `.qa/runs/composition-gate-cut-19-restore-existing-livekit-sessio.md`.

## Implementation Notes
- Route POST `/api/v1/sessions/:sessionId/media-token`.
- Soft-DENY removed; Edge retained until CUT-20.
- Store flags: SQLite present → membership/config ready; LiveKit env optional.
