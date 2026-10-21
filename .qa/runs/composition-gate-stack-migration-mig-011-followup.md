# Composition Gate — stack-migration-mig-011-followup (#889)

- HEAD_SHA: 385a77ea022a67e6b23e787872e235fb29640d08
- BASE_SHA: 87bafeac2b62db98e6774fd2ea816a79d2fe3c9a
- Date: 2026-10-21
- Verdict: CLEAR

## Event

Schema upgrades must remain single-writer under GATE-04 without a file/PID lock that can steal, block forever on PID reuse, or race during recovery. Exclusive authority is SQLite BEGIN IMMEDIATE around each migration step with version re-read inside the transaction; SQLITE_BUSY fails closed.

## Hop chain

1. Producer: `bootstrapHostPersistence` → `runMigrations`
2. Optional discard of legacy `schema-upgrade.lock` (non-authoritative)
3. Per pending file: `BEGIN IMMEDIATE` → re-read `schema_migrations` → apply SQL + journal insert → `COMMIT`
4. Consumer: host ready only after migrate + integrity; concurrent second writer gets busy or no-ops

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Two concurrent boots on same DB | child-process self-test | pass (journal stays 1; busy fail-closed OK) |
| Invalid/missing | Broken step / duplicate versions | rollback + sidecar / fail closed | pass |
| Two consumers / crash | Crash mid-v2 then restart | v1 intact; same failed step | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

GATE-02/03/05 and cutover not approved. No ALLOW-KNOWN-RED implied.
