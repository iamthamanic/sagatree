# Infrastructure `session`

## VORHER
- Area root: `src/infrastructure/session/`
  - `src/infrastructure/session/live-session-access.resolver.ts`
  - `src/infrastructure/session/media/index.ts`
  - `src/infrastructure/session/media/livekit-media-plane-adapter.ts`
  - `src/infrastructure/session/media/media-plane-adapter.ts`
  - `src/infrastructure/session/media/media-token-client.ts`
  - `src/infrastructure/session/media/memory-media-plane-adapter.ts`
  - `src/infrastructure/session/media/memory-media-plane-bus.ts`
  - `src/infrastructure/session/media/session-media-plane.ts`
  - `src/infrastructure/session/session-lobby-channel.ts`
  - `src/infrastructure/session/session-recap-ai-service.ts`
  - `src/infrastructure/session/session-recap-service.ts`
  - `src/infrastructure/session/session-runtime-channel.ts`
  - `src/infrastructure/session/session-runtime-service.ts`
  - `src/infrastructure/session/session-service.ts`
- RPCs: `apply_session_runtime_command`, `create_play_session`, `create_session_invite`, `get_session_recap`, `get_session_runtime_snapshot`, `join_session_by_code`, `leave_play_session`, `resolve_session_invite`, `revoke_session_invite`, `save_session_recap_summary`, `set_session_player_presence`, `set_session_status`
- Tables `.from`: `projects`
- Edge invokes: `session-media-token`, `session-recap`

## NACHHER
- src/infrastructure/session/** → HTTP/client to server/src/application/session/
- Depends: GATE-01, RPC:apply_session_runtime_command, RPC:create_play_session, RPC:create_session_invite, RPC:get_session_recap, RPC:get_session_runtime_snapshot, EDGE:session-media-token, EDGE:session-recap
- Status: SPEC — blocked on GATE-01 + linked RPC/Edge contracts; adapter must not invent elevated origins

## TESTS
- Owner-scoped read/write negative for foreign user
- Happy path journey touching this area still works after adapter swap
- No direct supabase import outside infrastructure after cutover
- RPC parity for: apply_session_runtime_command, create_play_session, create_session_invite, get_session_recap, get_session_runtime_snapshot, join_session_by_code, leave_play_session, resolve_session_invite…
- Edge invoke parity for: session-media-token, session-recap

## GRENZEN
- No inventing elevated origins or cross-owner FKs
- Keep app slices free of direct supabase client imports
