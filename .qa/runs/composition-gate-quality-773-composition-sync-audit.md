# Composition Gate — quality-773-composition-sync-audit

- HEAD_SHA: 8c7873512d5176ff9d8f427b2859f307008ab84b
- BASE_SHA: a678e6da30e87836222f141769dbe1dfd0435054
- HOP_DIGEST: f64b2f1d54b8bbb74a1cbce1fe93ca0c73f92ba56a2aac27e5b4f16e638b7db8
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Session `applyCommand` still produces a durable SQLite COMMIT; `onCommitted` is a post-commit side notification only. Composition-gate evaluation remains a CI producer→consumer hop check (no runtime event bus). GATE-02/03 PoC lockfile override is tooling evidence, not a live product hop.

## Hop chain

1. Producer: Host `SessionRuntimeUseCase` / `session-runtime-store.applyCommand`
2. Authenticate/Authorize: actor + membership inside TX (unchanged)
3. Validate → CAS → mutate → event + idempotency → COMMIT
4. Consumer A: SQLite WAL (durable truth)
5. Consumer B: `onCommitted` publisher — failures swallowed after COMMIT (no re-entry into TX)

## Simulations

### N-actors
Unchanged: one writer wins revision; publisher runs only for the committed winner. Publisher throw on winner does not roll back or free the revision for a second mutator with the same idempotency key.

### Invalid/missing
Deny/replay paths never reach `onCommitted`. Empty/forbidden commands unchanged.

### Two consumers / crash
Crash mid-TX still leaves no rows. After COMMIT, a throwing publisher leaves durable state queryable; idempotent replay returns committed:false without re-mutate.

## Flags

None. Composition-gate squash attestation is push/main-push only; pull_request mode still requires a resolvable proof HEAD_SHA.
