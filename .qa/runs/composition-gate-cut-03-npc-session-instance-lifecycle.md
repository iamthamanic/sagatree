# Composition Gate — cut-03-npc-session-instance-lifecycle (#1138)

- HEAD_SHA: 9dc10a68643400eb8e793d467fe23b14bc327d22
- BASE_SHA: 430fe6d22801e05ed0806ce0e96740ee9228c83e
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: CUT-04 session delete (#1139)

## Event

Under host-first, NPC instance list/spawn/runtime/remove use Host HTTP
`GET|POST /api/v1/library/npc-instances` and
`PATCH|DELETE /api/v1/library/npc-instances/:id...` backed by
`NpcCreaturePorts.listInstances|spawnInstance|updateRuntime|removeInstance`.
Session temp-controller cleanup uses
`POST /api/v1/sessions/:sessionId/npc-temp-controllers/clear`.
Legacy Supabase path remains only when host library is off.

## Hop chain

1. **Producer (UI):** Adventure/spawn dialogs → `npc-creature-service`
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed fetch to library npc-instances + session clear routes
4. **Authorize:** Session actor; GM for mutate; active member for list
5. **Persist:** SQLite `npc_creature_instances` (snapshot frozen on runtime update)
6. **Consumer:** Same facade re-reads host GET exclusively per env

Cardinality: many instances per project; one row per instance id. No cross-owner fan-out.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Player/stranger cannot spawn/update/remove | Port GM checks | pass |
| Invalid/missing | Unauth → 401; missing instance → 404 | Fail-closed statuses | pass |
| Two consumers / crash | Dual-path exclusive | Flag off → Supabase; on → host | pass |
| Temp clear | Session-scoped temps cleared; campaign controllers untouched | clearTempControllersForSession | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Host ports already owned instance writes; CUT-03 mounts product HTTP + FE dual-path + listInstances read port so host-first UI no longer hits Supabase for instances.
