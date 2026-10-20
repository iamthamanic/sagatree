# Composition Gate — atlas-followup-donalu-backfill (#754)

- HEAD_SHA: PENDING_COMMIT
- BASE_SHA: cbf17375b56a9c98796cb695fb148c98f93ed7f6
- Date: 2026-10-20
- Verdict: CLEAR

## Event

Operator enables per-world migration gate on staging Donalu clone; gated apply creates continent→country placeholders, ensures primary map links, publishes identity/Saga diff; rollback + idempotent re-apply proven. Production remains gated off.

## Hop chain

1. Producer: local/staging Postgres Donalu `WO-9FFK6` + dry-run inventory (#753)
2. Gate: `atlas_wb_migration_gates.enabled=true` for that world only (default false elsewhere)
3. Domain/SQL: `atlas_wb_migration_apply` (expand-only; `mig.ph.*` seed keys) + identity snapshot
4. Consumer A: hierarchy chain `continent>country>settlement`; primary links; saga fingerprint unchanged
5. Consumer B: batch rollback restores UUID sets; second apply creates 0 places/maps
6. Production: `PRODUCTION_GATE.md` — not migrated without `PRODUCTION_APPLY_APPROVED` + `--allow-production`

## Simulations

- N-actors: gate+confirm tokens required; operator session flag `atlas.migration_operator` or world owner JWT.
- Invalid/missing: disabled gate / wrong confirm → fail closed; production without `--allow-production` refused in CLI.
- Two consumers / crash: apply is transactional; aborted batch leaves no partial `mig.ph.*` nodes (single function body).
- Review queue: site/dungeon/area kinds never rewritten.

## Flags

(none — production not approved)
