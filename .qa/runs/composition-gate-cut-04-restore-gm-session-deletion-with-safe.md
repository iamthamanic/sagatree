# Composition Gate — cut-04-restore-gm-session-deletion-with-safe (#1139)

- HEAD_SHA: 18f1ad58a53d686b40c093f9cd9f3042db20717c
- BASE_SHA: 7bbec6b8ac95b7a18fc8aa02918b23c3ee2c413e
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: CUT-05 session-outcome promote (#1140)

## Event

Under host-first, GM session deletion uses Host HTTP
`DELETE /api/v1/sessions/:sessionId` backed by
`SessionLifecyclePort.deletePlaySession`. Cascades invites/players/recaps via FK;
clears `npc_creature_instances.session_id`; deletes session_runtime graph.
Legacy Supabase path remains only when host library is off.

## Hop chain

1. **Producer (UI):** SagaResourceScreen episode delete → `sessionService.deleteSession`
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed `DELETE` via `deleteHostPlaySession`
4. **Authorize:** Session actor; GM-only mutate
5. **Persist:** SQLite transaction (SET NULL npc → delete runtime graph → delete play_sessions)
6. **Consumer:** UI navigates back; reload finds session absent

Cardinality: one delete per session id. No cross-owner fan-out. Shared world/character assets retained.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Player/stranger cannot delete | Port GM check → 403/404 | pass |
| Invalid/missing | Unauth → 401; missing → 404; repeat delete safe | Fail-closed statuses | pass |
| Two consumers / crash | Dual-path exclusive | Flag off → Supabase; on → host | pass |
| Cascade | Invites/players/recaps gone; npc session_id null; runtime gone after restart | SQLite FK + explicit runtime deletes | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Lifecycle store already owned session rows; CUT-04 mounts product DELETE + FE dual-path so host-first UI no longer soft-DENYs session deletion.
