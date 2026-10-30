# Composition Gate — gate-01-drizzle-host-persistence (#1043)

- HEAD_SHA: (filled at commit)
- BASE_SHA: 7dab6658845e6d8e9517291207aec30ee2ecec63
- Date: 2026-10-30
- Verdict: CLEAR
- Scope: committed HEAD (Drizzle host persistence wrapper + world query-builder adapters)

## Event

Host opens SQLite with GATE-04 PRAGMAs, wraps the connection in Drizzle `HostDatabase`, and serves world read/write (and all other product stores via prepare-bridge) through the ORM session. Policy Service remains the authorization entry; strangers cannot read foreign worlds.

## Hop chain

1. Producer: Host use-case / port calls world read or write store
2. Authorize: SagaTree Policy Service (`permissions`) deny-by-default before projection
3. Persist: Drizzle `node-sqlite` session (`orm` query builder or `prepare` → bindQuestionMarks → `orm.all/get/run`); native `$client` only for documented TX/PRAGMA/migration exceptions
4. Project: World DTO / store row without leaking owner fields to unauthorized actors
5. Consumer: Application ports / HTTP commands consuming policy-scoped results

## Simulations

### N-actors
Owner list/get succeeds. Stranger getWorld on foreign id → `not-authorized` with no payload (GATE-01 self-test + mig-012).

### Invalid/missing
Empty worldId → missing-world. Placeholder count mismatch on prepare bridge throws. Bootstrap integrity/migrate failures close the DB.

### Two consumers / crash
Reopen same SQLite file after close retains renamed world title. BEGIN IMMEDIATE/COMMIT via documented exec exception; busy helper unchanged.

## Flags

- Acceptance tier: host-persistence / architecture
- Browser E2E: SKIPPED (no UI surface; host SQLite/ORM only)
- Deferred: #1044 CI import-boundary guard; fold runtime evidence into #847/#849 via Source-of-Truth (no hand-edit of generated contracts in this PR)
