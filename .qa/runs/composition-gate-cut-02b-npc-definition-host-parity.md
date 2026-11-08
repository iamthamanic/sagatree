# Composition Gate — cut-02b-npc-definition-host-parity (#1159)

- HEAD_SHA: 49e264abbcb4ee72e59ab37d6702df2e53db21df
- BASE_SHA: 45f681e20a84671b13b81afd98b641320279785e
- Date: 2026-11-08
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: world payload `modules` authoring UI remains defaults-only (no new product surface)

## Event

Under host-first, NPC definition duplicate/restore/world-catalog/promote/availability use
typed Host Library HTTP backed by `NpcCreaturePorts` + SQLite `npc_creature_definitions`.
No Soft-DENY; no Supabase under host product runtime.

## Hop chain

1. **Producer (UI):** `NpcCreatureLibraryBrowser` / `WorldNpcCreatureCatalogSection` / `CharacterEditor` → `npc-creature-service`
2. **Gate:** `isHostLibraryEnabled()` (`host-library-http`)
3. **Transport:** credentialed fetch to `/api/v1/library/npc-creatures` (+ `/duplicate`, `/restore`, filtered GET, PATCH)
4. **Authorize:** Session actor; personal owner / world edit ACL on mutate; readable ACL on duplicate
5. **Persist:** SQLite `npc_creature_definitions`
6. **Consumer:** Same facade remaps host DTOs to catalog records

Cardinality: one definition row per id; duplicate inserts a new personal row.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Two owners cannot mutate each other's personal defs | Port mutable ACL → 403 | pass |
| Invalid/missing | Unauth / bad id | 401 / 404 from library actor + ports | pass |
| Two consumers / crash | Library browser + world catalog both list after restore | Shared host list filter | pass |
| Soft-DENY | Must not succeed as soft unavailable | restore uses host route | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Evidence

- `scripts/cut-02b-npc-definition.self-test.mjs` PASS
- `scripts/cutover-parity-inventory-check.mjs` PASS (HOST_VERIFIED flip for #1159 rows)
