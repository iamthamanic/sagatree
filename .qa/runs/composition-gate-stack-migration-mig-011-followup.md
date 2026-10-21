# Composition Gate — stack-migration-mig-011-followup (#889)

- HEAD_SHA: 2a94e8612a76a5e4e971cc21ca2db6b7852bdadb
- BASE_SHA: 19c33a75a961d3c1635e366883db5b809dbe21eb
- Date: 2026-10-21
- Verdict: CLEAR

## Event

Schema upgrades use SQLite `BEGIN IMMEDIATE` (GATE-04 single-writer) with version re-read inside the transaction. A leftover legacy `schema-upgrade.lock` is never auto-deleted (an old host may still hold it); presence fails closed until an operator clears it after verified standstill. Uncommitted migration work must roll back after a real process SIGKILL.

## Hop chain

1. Producer: `bootstrapHostPersistence` → `runMigrations`
2. If `schema-upgrade.lock` present → fail-closed (no unlink)
3. Per pending file: `BEGIN IMMEDIATE` → re-read `schema_migrations` → apply SQL + journal insert → `COMMIT`
4. Consumer: host ready only after migrate + integrity; concurrent writers get busy or no-ops; SIGKILL mid-TX leaves no partial schema

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | Old host holds legacy lock + TX; new host starts | new host fail-closed; lock untouched until verified clear | pass |
| Invalid/missing | Broken SQL step / duplicate versions | rollback + sidecar / fail closed | pass |
| Two consumers / crash | SIGKILL mid-TX after uncommitted DDL; reopen + restart | partial rolled back; v1 journal intact; restart consistent | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

GATE-02/03/05 and cutover not approved. No ALLOW-KNOWN-RED implied. MERGE-889 waits for human freigabe on the final head.
