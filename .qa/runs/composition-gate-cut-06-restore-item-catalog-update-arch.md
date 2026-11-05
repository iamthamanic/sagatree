# Composition Gate — cut-06-restore-item-catalog-update-arch (#1141)

- HEAD_SHA: 0993c0e08630af641132f6d5624e344fafa2717e
- BASE_SHA: fd4318190f7384c708015894024e5c8a44a750dd
- Date: 2026-11-05
- Verdict: CLEAR
- Acceptance tier: feature-integration
- Deferred integration: CUT-07 look versions (#1142)

## Event

Under host-first, item catalog update/archive/restore/fork use Host HTTP backed by
InventoryPorts on SQLite. Legacy Supabase remains only when host library is off.
Core/builtin fork resolves locally then creates a host definition.

## Hop chain

1. **Producer (UI):** Item workbench / library → `item-catalog-service`
2. **Gate:** `isHostLibraryEnabled()`
3. **Transport:** credentialed PATCH/POST via host-library-http
4. **Authorize:** Actor ids; personal owner or world edit ACL; standard immutable
5. **Persist:** SQLite `inventory_item_definitions` (status retained for instances)
6. **Consumer:** Same UI; list omits archived; fork returns new id

Cardinality: one definition row per id; fork allocates a new id. No cross-owner writes.

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Stranger cannot mutate | Owner/world ACL | pass |
| Invalid/missing | Missing id → 404; bad origin → 422 | Fail-closed | pass |
| Two consumers | Dual-path exclusive | Flag off → Supabase | pass |
| Idempotent archive | Re-archive returns archived | Status no-op | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |

## Verdict rationale

Service + backend + persistence hops changed; positive/negative auth covered in
cut-06-item-definition.self-test. CLEAR for feature-integration tier.
