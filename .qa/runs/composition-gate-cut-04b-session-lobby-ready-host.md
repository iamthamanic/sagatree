# Composition Gate — cut-04b-session-lobby-ready-host (#1162)

- HEAD_SHA: 7f48d6a00a718750b99c4a6aee8776610e1c1c0c
- BASE_SHA: 2fcc61186c525790c9e2f531bb069e613512c407
- Date: 2026-11-08
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: Colyseus product rooms remain MIG-602; lobby ready is ephemeral in-process SSE

## Event

`useSessionLobby` → `subscribeSessionLobbyReady` → credentialed SSE
`GET /api/v1/sessions/:id/lobby/ready/stream` + POST publish. Actor from Better Auth;
membership via `getPlaySession`. Soft local-echo removed. Server stamps `userId`.

## Hop chain

1. **Producer (UI):** SessionLobbyScreen ready toggle → `setReady`
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** SSE subscribe + POST `/api/v1/sessions/:id/lobby/ready`
4. **Authorize:** Better Auth actor; `sessionInfra.getPlaySession`
5. **Hub:** in-process `LobbyReadyHub` fan-out (ephemeral)
6. **Consumer:** peer SSE listeners → `mergeLobbyReadyMap` → roster

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | A ready visible to B | SSE fan-out | pass |
| Invalid/missing | Unauth / stranger session | 401 / 403 | pass |
| Two consumers / crash | Two lobby UIs observe same ready map | Shared hub subscribers | pass |
| Spoof userId | Client claim ignored | Server stamps actor | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Evidence

- `scripts/cut-04b-session-lobby-ready.self-test.mjs`

## CI retrigger

- At: 2026-11-08T16:51:28Z
