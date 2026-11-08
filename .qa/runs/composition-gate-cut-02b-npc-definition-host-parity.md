# Composition Gate — cut-02b-npc-definition-host-parity (#1159)

- HEAD_SHA: pending-commit
- BASE_SHA: 45f681e20a84671b13b81afd98b641320279785e
- Date: 2026-11-08
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred: world payload `modules` authoring UI (defaults only)

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
| Foreign owner | Stranger cannot duplicate/restore/promote | Port mutable/readable ACL → 403 | pass |
| Unauth | No cookie → 401 | resolveLibraryActor | pass |
| Catalog archived | includeArchived=1 returns archived | listDefinitions filter | pass |
| Soft-DENY | Must not succeed as empty/throw soft message | restore uses host route | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Evidence

- `scripts/cut-02b-npc-definition.self-test.mjs` PASS
- `scripts/cutover-parity-inventory-check.mjs` PASS (HOST_VERIFIED flip for #1159 rows)
