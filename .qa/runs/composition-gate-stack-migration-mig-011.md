# Composition Gate — stack-migration-mig-011 (#790)

- HEAD_SHA: c8af12cebf4ccca816a7f4604cbeae095f932c4b
- Date: 2026-10-21
- Verdict: CLEAR

## Event

Host bootstrap opens SQLite, applies the approved schema catalog through an atomic migration journal, and only then may mark ready. Failed migration steps roll back schema+journal together and surface the same failed step on the next start; integrity rejects orphan memberships / FK violations before readiness.

## Hop chain

1. Producer: `bootstrap/create-host.ts` → `persistence/bootstrapHostPersistence`
2. `openHostDatabase` applies GATE-04 PRAGMAs (`foreign_keys=ON`, WAL, `synchronous=FULL`, `busy_timeout=250`) + upgrade lock
3. `runMigrations` applies `server/migrations/*.sql` with journal row in the same transaction
4. `runIntegrityCheck` + table ownership registry
5. Consumer: host `start()` sets `ready` only after successful bootstrap; HTTP `/health` reflects ready

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| N-actors | One upgrade lock; concurrent upgrade refused | Second lock → LOCK error; first completes | pass (lock file O_EXCL) |
| Invalid/missing | Broken SQL step → rollback; sidecar records step id | schema_version unchanged; next run reports same `failedStep.id` | pass (self-test AC2) |
| Two consumers / crash | Orphan membership must not pass integrity | `runIntegrityCheck` FAIL; bootstrap returns error; host not constructed ready | pass (self-test AC3) |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | | | | |

## Non-claims

GATE-02/03/05 and production cutover not approved. GATE-04 capacity remains NOT RUN (#849). Drizzle adapters / Policy Service are successor tickets.
