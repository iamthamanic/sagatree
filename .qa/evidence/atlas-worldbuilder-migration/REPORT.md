# Evidence — Atlas Worldbuilder Migration (#723)

- Dry-run only against evidence inventory (+ optional local inventory RPC).
- Gate table `atlas_wb_migration_gates` defaults **enabled=false**.
- No place/map deletes; no public_id rewrites.
- Backup/restore baseline: `.qa/evidence/atlas-worldbuilder-evidence/backups/` (#713).

## Artifacts

- `dry-run-report.json`
- `REVIEW_QUEUE.md`

## Donalu gate

Enable only after review: insert into `atlas_wb_migration_gates` for Donalu world UUID with `enabled=true`.
