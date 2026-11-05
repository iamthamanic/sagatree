# Acceptance — cut-03-npc-session-instance-lifecycle (#1138)

## Intent

NPC/creature adventure instances (list, spawn, runtime update, remove, session temp-controller clear) run on host HTTP + SQLite under host-first; no soft-DENY.

## Composition Gate

See `.qa/runs/composition-gate-cut-03-npc-session-instance-lifecycle.md`.

## Evidence

- `scripts/cut-03-npc-instance.self-test.mjs` — GM spawn→update→clear-temp→remove; player/stranger DENY; snapshot frozen
- Dual-path: `npc-creature-service` + `host-library-http` / `host-session-http`
- Ports: `NpcCreaturePorts.listInstances|spawnInstance|updateRuntime|removeInstance|clearTempControllersForSession`

## UI/UX

Existing adventure/runtime and GM NPC instance panels unchanged; statuses update on command reply.
