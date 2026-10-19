# Composition Gate — atlas-followup-real-donalu-inventory (#753)

**Status:** CLEAR  
**WORKTREE:** feat/issue-753-atlas-followup-real-donalu-inventory  
**Date:** 2026-10-19

## Event

Operator runs world-scoped Donalu inventory dry-run (`--world=WO-9FFK6`); report uses real place/map UUIDs; ambiguous kinds enter review; no DB writes.

## Hop chain

1. Producer: `#713` evidence CSVs (`donalu_places` / `donalu_maps` / saga) filtered by world scope
2. Domain: `buildWorldScopedInventory` → parent chains, primary maps, ambiguous review queue
3. Consumer A: `buildMigrationDryRun` (#723 classifier) on scoped rows only
4. Consumer B: `.qa/evidence/atlas-followup-real-donalu-inventory/` report (read-only)
5. Gate: `atlas_wb_migration_gates.enabled` remains default false (no apply)

## Simulations

| Case | Result |
|------|--------|
| N-actors / 38-world bag | `filterInventoryByWorld` / `countOrphanSettlementsForWorld` → Donalu counters stay at 1 orphan settlement |
| Invalid / missing `--world` | Dry-run fails closed (exit non-zero); no default Donalu merge |
| Two consumers / crash | Reports are files only; restore plan still points at #713 backups; no deletes |

## Flags

(none)
