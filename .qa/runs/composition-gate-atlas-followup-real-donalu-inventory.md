# Composition Gate — atlas-followup-real-donalu-inventory (#753)

- HEAD_SHA: 8c57102ba6e70f6e20aa7933a5420a302da23dc5
- BASE_SHA: 2c65e5432c2232b2c6386c6368ffd78cf7dd46a9
- Date: 2026-10-19
- Verdict: CLEAR

## Event

Operator runs world-scoped Donalu inventory dry-run (`--world=WO-9FFK6`); report uses real place/map UUIDs; ambiguous kinds enter review queue; no DB writes.

## Hop chain

1. Producer: `#713` evidence CSVs (`donalu_places` / `donalu_maps` / saga) filtered by world scope
2. Domain: `buildWorldScopedInventory` → parent chains, primary maps, ambiguous review queue
3. Consumer A: `buildMigrationDryRun` (#723 classifier) on scoped rows only
4. Consumer B: `.qa/evidence/atlas-followup-real-donalu-inventory/` report (read-only)
5. Gate: `atlas_wb_migration_gates.enabled` remains default false (no apply)

## Simulations

- N-actors: `filterInventoryByWorld` / `countOrphanSettlementsForWorld` keep Donalu counters at 1 orphan settlement when scoped; concurrent dry-runs are read-only.
- Invalid/missing: dry-run fails closed without `--world=`; no default Donalu merge from the 38-world bag.
- Two consumers / crash: reports are files only; restore plan still points at #713 backups; no deletes.

## Flags

(none)
