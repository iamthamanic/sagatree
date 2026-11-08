# Composition Gate — cut-04b-session-lobby-ready-host (#1162)

- HEAD_SHA: e17c83cdfe59cf0306fc05a922f346cc3de42e09
- BASE_SHA: 45f681e20a84671b13b81afd98b641320279785e
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none (ephemeral lobby ready via host SSE; Colyseus product rooms remain MIG-602)

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
| Two actors | A ready visible to B | SSE fan-out | pass |
| Spoof userId | Client claim ignored | Server stamps actor | pass |
| Stranger | Stream/publish DENY | 403/404 | pass |
| Unauth | DENY | 401/403 | pass |
| Soft-echo | Removed | Host SSE only | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
