# GATE-01 follow-up (#1043) — documented DatabaseSync / raw-SQL exceptions

Product repository adapters receive `HostDatabase` (`server/src/persistence/host-drizzle.ts`).
Parameterized product queries execute through the **Drizzle** `node-sqlite` session
(`prepare` bridge or query builder). The following paths may still touch
`node:sqlite` `DatabaseSync` directly:

| Path | Owner | Reason |
| --- | --- | --- |
| `server/src/persistence/open-database.ts` | persistence | Open file + apply GATE-04 PRAGMAs before wrapping |
| `HostDatabase.exec` for `BEGIN`/`COMMIT`/`ROLLBACK`/`SAVEPOINT`/`RELEASE`/`PRAGMA` | persistence | GATE-04 single-writer transaction control (ADR-ST-08) |
| `HostDatabase.$client` | persistence | Explicit unwrap for migration/integrity only |
| `server/src/persistence/migration-runner.ts` | ops | Schema catalog apply + `schema_migrations` journal under `BEGIN IMMEDIATE` |
| `server/src/persistence/integrity-check.ts` | ops | Post-migrate PRAGMA / catalog checks (via HostDatabase prepare) |
| `server/src/auth/cookie-profile.ts` | auth | Separate Better Auth `auth.sqlite` (not host product catalog) |
| Test/harness `db.exec(INSERT…)` multi-statement seeds | tests | Not product stores; prefer `prepare` for new tests |

## Inventory (product stores)

All module/`repositories`/`assets` stores that previously called `DatabaseSync.prepare`
now call `HostDatabase.prepare`, which binds `?` placeholders through Drizzle SQL
and runs `orm.all` / `orm.get` / `orm.run`.

Typed query-builder adapters (no `prepare` bridge):

- `server/src/repositories/world/sqlite-world-read-store.ts`
- `server/src/modules/world/internal/world-write-store.ts`

## CI enforcement (#1044)

Machine-readable allowlist: [`.qa/architecture/host-drizzle-exceptions.json`](../../.qa/architecture/host-drizzle-exceptions.json).  
Enforced by `checkHostDrizzlePersistenceBoundaries` inside `scripts/architecture-boundary-check.mjs` (`npm run test-gate`).

## Non-goals

- Production cutover / Supabase shutdown
- Changing GATE-04 PRAGMA policy
- Hand-editing generated migration registry contracts (#847/#849 evidence is additive)
