# Composition Gate — cut-19-restore-existing-livekit-sessio (#1154)

- HEAD_SHA: WORKTREE (pre-commit; re-stamp after feature commit)
- BASE_SHA: 271c3232457e3a641566ef60e3d27323cbf8aed2
- Date: 2026-11-06
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: none (CUT-19 activates existing session-media-token host use-cases)

## Event

Under host-first, SessionMediaPlane / Lobby media calls `fetchSessionMediaToken` →
credentialed POST `/api/v1/sessions/:sessionId/media-token`. Actor from Better Auth;
membership from SQLite hydrate; LiveKit JWT minted server-side. Soft-DENY removed.
Without LiveKit: 503 degraded German message; game continues.

## Hop chain

1. **Producer (UI):** LobbyDeviceBar / SessionMediaPlane
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed POST `/api/v1/sessions/:id/media-token`
4. **Authorize:** Better Auth actor; project_members active role; client role/caps/room ignored
5. **Store:** SessionMediaTokenStore + LiveKit env (+ SQLite hydrate)
6. **Consumer:** same UI — token/url/roomId for LiveKit client

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot mint for foreign session | 403 before mint | pass |
| Invalid/missing | No LiveKit / bad ttl | 503 / 400 | pass |
| Dual-path | Flag off → Edge session-media-token | Exclusive | pass |
| Elevation | Client role=gm ignored | Server membership grant | pass |
| Two consumers / crash | Concurrent issues independent JWTs; no DB write | In-memory + LiveKit local sign | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
