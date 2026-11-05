# Composition Gate — cut-02-npc-controller-assignment-host (#1137)

- HEAD_SHA: 1bf0d043e601e47bc59002b1e53aee6d78bad170
- BASE_SHA: 8281ad3342b0bfe55129207629e255cbb44b48d3
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: CUT-03 instance spawn/runtime (#1138)

## Event

Under host-first (`isHostLibraryEnabled()`), NPC controller assign/load uses Host HTTP
`GET|POST /api/v1/library/npc-creatures/:id/controller` backed by
`NpcCreaturePorts.getControllerAssignment` / `assignController` + SQLite
`npc_creature_controller_assignments`. Legacy Supabase path remains only when host library is off.
`activeMemberUserIds` stays a client domain-plan hint; GM/membership authority is server-side.

## Hop chain

1. **Producer (UI):** `NpcCreatureAssignControllerDialog` → `npc-creature-service`
2. **Gate:** `isHostLibraryEnabled()` (`host-library-http`)
3. **Transport:** credentialed `fetch` to library controller routes
4. **Authorize:** Session actor; ports require active GM for mutate, active member for read
5. **Persist:** SQLite `npc_creature_controller_assignments` upsert (null controller = clear)
6. **Consumer:** Same facade re-reads host GET or legacy Supabase exclusively per env

Cardinality: one assignment row per `(projectId, definitionId)`. No cross-owner fan-out.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Player/stranger cannot assign; non-member controller rejected. | Port GM + membership checks. | pass |
| Invalid/missing | Unauth → 401; missing project → 422. | Fail-closed HTTP statuses. | pass |
| Two consumers / crash | Dual-path exclusive. | Flag off → Supabase; flag on → host. | pass |
| Clear / retry | Nullable clear + duplicate assign idempotent. | Upsert ON CONFLICT. | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Evidence

- `scripts/cut-02-npc-controller.self-test.mjs` PASS
- `scripts/cutover-parity-inventory-check.mjs` PASS (HOST_VERIFIED flip for #1137 rows)
- `scripts/fe-host-05-inventory-npc-http.self-test.mjs` PASS (regression)
- `scripts/mig-307-npc-adapter.self-test.mjs` PASS (ops surface +13)
