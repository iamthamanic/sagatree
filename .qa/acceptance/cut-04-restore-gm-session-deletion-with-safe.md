# Acceptance — cut-04-restore-gm-session-deletion-with-safe (#1139)

## Intent

GM deletes a play session via host HTTP + SQLite under host-first; no soft-DENY.
Cascades invites/players/recaps; clears npc instance `session_id`; removes session_runtime graph.

## Composition Gate

See `.qa/runs/composition-gate-cut-04-restore-gm-session-deletion-with-safe.md`.

## Evidence

- `scripts/cut-04-session-delete.self-test.mjs` — GM delete OK; player/stranger DENY; missing/idempotent; cascade + npc SET NULL; restart durable
- Dual-path: `session-service.deleteSession` + `deleteHostPlaySession`
- Port: `SessionLifecyclePort.deletePlaySession` → `DELETE /api/v1/sessions/:sessionId`

## UI/UX

Existing SagaResourceScreen episode delete confirmation, pending/error, and navigation back to sessions unchanged.
