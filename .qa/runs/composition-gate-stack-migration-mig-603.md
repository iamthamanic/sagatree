# Composition Gate — stack-migration-mig-603 (#848)

- HEAD_SHA: (filled at tip)
- BASE_SHA: de267052cb78558fc76ee33c7f3abc0f82cabfe2
- Date: 2026-10-30
- Verdict: CLEAR

## Event

Ops deliverable: host SQLite/WAL/asset snapshots under `scripts/host-backup` with
atomic staging→publish, restore drills, and runbooks under `docs/ops/host`.
Snapshots use `VACUUM INTO` (not uncoordinated multi-file copies). Aborted
staging never becomes a restore point; last published snapshot stays usable.

## Hop chain

1. Operator → `cli.mjs create` / `create-snapshot.mjs`
2. Library → wal_checkpoint + VACUUM INTO + hashed assets → `.staging/<id>`
3. Publish → rename to `<backupRoot>/<id>` + `manifest.json`
4. Restore / rollback-drill → verify integrity + checksums → swap dataDir
5. Consumer: runbooks + `mig-603-host-backup.self-test.mjs` in test-gate

## Simulations

### N-actors
N/A (ops surface). Owner-scoped live data remains policy-gated; backups inherit
the same confidentiality class as the live dataDir.

### Invalid/missing
Aborted create (`failAfterStage`) / aborted restore (`failBeforePublish`) → no
publish; previous good snapshot / dataDir remains consistent.

### Two consumers / crash
Rollback drill mutates then restores; report records duration + writeLockHeldMs
+ schemaVersion + checksums.

## Flags

- Acceptance tier: isolated-contract
- Deferred integration: live Docker-in-CI drills → MIG-602/#847; human release → MIG-700/#849
- SLICE DONE does not imply FEATURE VERIFIED or RELEASE APPROVED
