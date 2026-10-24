# Composition Gate — stack-migration-mig-502 (#843)

- HEAD_SHA: c834dacc85a926c87aea01118332b7a6c6ac27c7
- BASE_SHA: 5d68e4afbea953155fef10b10a8ff04264def63f
- Date: 2026-10-24
- Verdict: CLEAR

## Event

Host operators export a signed world/saga/asset bundle from SQLite, then import it onto an empty or non-conflicting host. Checksum/path failures abort before authoritative publish. Restore drills remap ownership and prove stranger DENY without the source instance.

## Hop chain

1. Producer: `exportHostBundle` reads owner-scoped tables + asset bytes
2. Sign: SHA-256 over stable payload (format v1)
3. Consumer: `importHostBundle` validates → BEGIN IMMEDIATE inserts → COMMIT (or ROLLBACK)
4. Drill: `runRestoreDrill` composes export→import on a fresh host

## Simulations

| Case | Result |
|------|--------|
| N-actors | restore owner vs stranger world counts | pass |
| Invalid/missing | unsupported version / traversal / checksum → no partial rows | pass |
| Two consumers / crash | atomic tx; overwrite denied on second import | pass |

## Flags

- Acceptance tier: `isolated-contract`
- Deferred integration: TBD by dependency successors: MIG-500/#841, MIG-503/#844, MIG-020/#795
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED

## Non-claims

No production cutover. No Supabase shutdown. No HTTP export surface in this slice.
