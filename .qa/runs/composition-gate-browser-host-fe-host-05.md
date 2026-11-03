# Composition Gate — browser-host-fe-host-05 (#1097)

- HEAD_SHA: e0a8928826ac0cae0bb94fa1a8f8c4f08fa35ef6
- BASE_SHA: 6a10d113c6c30f5b15d36f2c51fa59ae196d7f67
- Date: 2026-11-03
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: #1098–#1101; item update/archive/fork host HTTP; NPC restore/duplicate

## Event

With `VITE_SAGATREE_HOST_LIBRARY=1` + host auth URL, Library item create and NPC
definition create/update/archive go to host HTTP (`/api/v1/library/items`,
`/api/v1/library/npc-creatures*`) backed by inventory / npcCreature ports + SQLite;
without the flag, existing Supabase repositories remain.

## Hop chain

1. **Producer (UI):** Library Items / NPC workbench call infrastructure facades
2. **Gate:** `isHostLibraryEnabled()` (`host-library-http`)
3. **Transport:** credentialed `fetch` to library catalog routes
4. **Authorize:** Actor from cookie session; ports deny foreign owners
5. **Persist:** SQLite inventory_item_definitions / npc_creature_definitions
6. **Consumer:** Same facades re-read host or Supabase path exclusively per process env

Cardinality: one catalog mutation per authenticated browser session. No cross-owner fan-out.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot mutate foreign personal catalog rows. | Ports require owner. | pass |
| Invalid/missing | Unauth create DENY; archive missing → 404. | 401/403/404 fail-closed. | pass |
| Two consumers / crash | Dual-path exclusive. | Flag off → Supabase; flag on → host. | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Hop digest

N/A (CLEAR lineage proof; digest optional for push-like squash path)
