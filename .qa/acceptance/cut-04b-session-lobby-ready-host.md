# Acceptance — CUT-04b session lobby ready host realtime (#1162)

## Intent
Multiplayer session lobby ready signals fan out via host realtime (SSE + POST).
Soft local-echo is removed. No Supabase Realtime.

## Preconditions
- Better Auth cookie session (or solo loopback).
- Session membership (`getPlaySession` OK) for subscribe/publish.

## Happy Path
1. Two members open `GET /api/v1/sessions/:sessionId/lobby/ready/stream`.
2. One member `POST /api/v1/sessions/:sessionId/lobby/ready` with `{ ready: true }`.
3. Both streams receive `{ type: 'ready', userId, ready }` with **server-stamped** actor id.
4. FE `subscribeSessionLobbyReady` / `useSessionLobby` updates roster ready map.

## Edge Cases
- Unauthenticated → 401/403
- Foreign / non-member → 403/404
- Invalid `ready` payload → 422
- Client-claimed `userId` ignored for identity

## Security Coverage
- Actor from Better Auth; membership via session infra `getPlaySession`.
- Ready is never gameplay authorization.
- SC-01/02/03 inline; not a launch ticket.

## UI/UX
Existing SessionLobbyScreen ready toggle unchanged (German copy).

## Evidence
- `scripts/cut-04b-session-lobby-ready.self-test.mjs`
- Matrix `session-lobby.subscribe-ready` → HOST_VERIFIED

## Composition Gate
CLEAR — see `.qa/runs/composition-gate-cut-04b-session-lobby-ready-host.md`.
