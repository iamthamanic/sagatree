# Composition Gate — stack-migration-mig-503 (#844)

- HEAD_SHA: 1a7467f17ff0df507faf2304a0b0bdefb274ca71
- BASE_SHA: b6bc4b085c21444346013b2b98de6ebaf9276105
- Date: 2026-10-23
- Verdict: CLEAR

## Event

Synthetic Postgres-like fixture rows enter the host SQLite catalog via `server/src/migration/postgres` dry-run. Transfer is transactional; incomplete table maps fail closed before any write. Known legacy permission defects are recorded as document-only deviations — never imported as production data.

## Hop chain

1. Producer: CLI / self-test → `runPgSqliteDryRun({ fixture, dataDir })`
2. Mapping gate: every fixture table must be in `MAPPED_TABLES` (worlds / projects / project_members) or run blocks
3. Host bootstrap (`bootstrapHostPersistence`) opens empty SQLite + approved catalog
4. Transactional insert with type mappings (UUID/timestamptz/jsonb/boolean → TEXT/INTEGER)
5. Consumers: integrity check + owner/GM/player projection + per-table canonical checksum report

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Owner / GM / player / inactive / stranger stay distinct after transfer | visibilityContract + projection check | pass |
| Invalid/missing | Unmapped fixture table | `blocked_unmapped`; no host.sqlite | pass |
| Two consumers / crash | Abort mid-transfer then retry same snapshotId | ROLLBACK + incomplete meta; retry no duplicate IDs | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

No production Postgres connection or cutover. No GATE-02/03/05 freigabe. Legacy `RPC-SEC-LEGACY-MAP-FLAG` is documented as deviation only — not parity.
