# Composition Gate — stack-migration-mig-603 (#848)

- HEAD_SHA: f455a0f624561fc5a7929cc5782b8040089134c3
- BASE_SHA: de267052cb78558fc76ee33c7f3abc0f82cabfe2
- Date: 2026-10-30
- Verdict: CLEAR
- Note: DONE-evidence sync pins HEAD to squash-merge #1056 on main; CLEAR hop chain unchanged.

## Event

Ops deliverable: SQLite/WAL/asset backup + restore + update/rollback drills under
`docs/ops/host` and `scripts/host-backup`. Snapshots use `BEGIN IMMEDIATE` →
`COMMIT` → `wal_checkpoint(PASSIVE)` → `VACUUM INTO` (never raw multi-file copies
under write load). Staging publishes only after integrity + asset-hash verification.

## Hop chain

1. Producer: operator `node scripts/host-backup/cli.mjs create --data-dir … --backup-root …`
2. Snapshot: VACUUM INTO host.sqlite + asset tree + manifest (event/revision links)
3. Verify: `PRAGMA integrity_check` + SHA-256 file map + asset catalog hashes
4. Restore: stage → verify → swap into target dataDir
5. Consumer: restore host opens worlds / session_events / assets; rollback drill report

## Simulations

### N-actors
N/A (ops surface). Owner-scoped world row readable after restore (self-test).

### Invalid/missing
Aborted mid-stage backup (`failAfterStage`) does not publish; last good snapshot
still verifies. Aborted restore (`failBeforePublish`) leaves prior tree consistent.

### Two consumers / crash
Poisoned live DB after snapshot → rollback drill restores checksums/schema;
`writeLockHeldMs` + `measuredDurationMs` recorded in report.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: FEATURE VERIFIED → MIG-700/#849; RELEASE APPROVED → human only
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
