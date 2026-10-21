# Composition Gate — stack-migration-mig-011-followup (#889)

- HEAD_SHA: ba175e28233a64bb1109d7fe29ddd2b735aac501
- BASE_SHA: 87bafeac2b62db98e6774fd2ea816a79d2fe3c9a
- Date: 2026-10-21
- Verdict: CLEAR

## Event

After MIG-011 merge, schema upgrade locking must not permanently brick the host after process death, and the migration catalog must refuse duplicate version prefixes instead of silently skipping a second file. Node engines require a release that can load `node:sqlite`.

## Hop chain

1. Producer: `runMigrations` → `acquireSchemaUpgradeLock`
2. Lock file stores holder PID; dead PID → recover; live PID → refuse
3. `listMigrationFiles` rejects duplicate numeric prefixes fail-closed
4. Consumer: bootstrap/start still only ready after successful migrate+integrity

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | One live lock blocks peers; dead PID lock recoverable | self-test lock section | pass |
| Invalid/missing | Two `0001_*.sql` files → fail (no silent skip) | listMigrationFiles throw + runMigrations error | pass |
| Two consumers / crash | Stale lock after kill does not block next start | tryRecoverStaleSchemaUpgradeLock removes dead PID lock | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

GATE-02/03/05 and cutover not approved. Does not reopen MIG-011 acceptance; follow-up to Codex P1 on #887 only.
