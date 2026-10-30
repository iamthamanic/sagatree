# Feature: GATE-01-FOLLOWUP: Drizzle ORM in produktiven SagaTree-Host-Persistenzadaptern umsetzen

<!-- seeded by ecc-runner from issue #1043 on 2026-10-30 — refined during implement -->

## Intent
Die in GATE-01 (#784) und ADR-ST-05 verbindlich beschlossene Persistenzarchitektur **Drizzle ORM + SagaTree Policy Service** in den tatsächlich angebundenen Node-/SQLite-Host-Repositories umsetzen.

## Happy Path
- [x] Drizzle ORM is a real **runtime** dependency (`drizzle-orm@1.0.0-rc.5` in root + `server/`); product adapters use `HostDatabase` whose `prepare`/`orm` paths execute via the Drizzle `node-sqlite` session — proven by `scripts/gate-01-drizzle-host-persistence.self-test.mjs`.
- [x] Inventory of host data-access paths documented in `docs/architecture/gate-01-drizzle-host-exceptions.md`; product stores no longer call `DatabaseSync.prepare` directly — they use `HostDatabase.prepare` (Drizzle bind) or typed query builders (world read/write).
- [x] Integration/negative tests on isolated SQLite: MIG-011/012/013, session-runtime, world-places, session-access, project-membership + GATE-01 self-test (policy stranger deny, durable reopen, BEGIN IMMEDIATE).
- [x] `npm run test-gate` wires `checkGate01DrizzleHostPersistence`; existing MIG-011/012/013 remain green.
- [x] Touched files: zero type escape hatches (no `any` / `@ts-ignore` added).

## Edge Cases
- [x] Existing SQLite file reopens after adapter switch (self-test reopen).
- [x] SQLITE_BUSY helper retained; GATE-04 BEGIN IMMEDIATE via documented `exec` exception.
- [x] Stranger cannot read foreign world through policy + drizzle adapters.
- [x] Raw `DatabaseSync` limited to open/PRAGMA/migration/auth.sqlite exceptions.

## Regression
- [x] MIG-010/011/012/013/022 + selected RPC host self-tests PASS

## Assumptions
- `drizzle-orm@1.0.0-rc.5` chosen for native `node-sqlite` + better-auth peerOptional (`>=1.0.0-rc.1`); driver remains `node:sqlite` (no better-sqlite3 cutover in this ticket).

## Screenshots
N/A (host persistence, no UI)

## Implementation Notes
- `server/src/persistence/host-drizzle.ts` — HostDatabase wrapper
- `server/src/persistence/schema/**` — typed worlds/world_maps/projects mirrors
- World read/write stores use Drizzle query builder
- All other product stores use HostDatabase.prepare bridge
- Exceptions: `docs/architecture/gate-01-drizzle-host-exceptions.md`
- Follow-up CI import ban: #1044; fold evidence into #847/#849 via SoT later
