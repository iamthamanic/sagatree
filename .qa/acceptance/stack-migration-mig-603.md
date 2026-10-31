# Acceptance — stack-migration-mig-603 (#848)

## Intent

SQLite-, WAL- und Asset-Backups sowie Update/Rollback mit tatsächlich ausgeführten
Restore-Drills unter `docs/ops/host` + `scripts/host-backup`.

## Acceptance tier

`isolated-contract` — SLICE DONE only. FEATURE VERIFIED → MIG-700/#849. RELEASE APPROVED → human only.

Deferred integration: successors of MIG-502/#843, MIG-503/#844, MIG-601/#846 (all CLOSED).

## Preconditions

- MIG-502/#843, MIG-503/#844, MIG-601/#846 CLOSED on main.

## Happy path

- Snapshot via `wal_checkpoint` + `VACUUM INTO` + asset copy; atomic publish under backup root.
- Restore on a new dataDir preserves SQLite integrity, session event/revision links, and asset SHA-256.
- Rollback drill reports measured duration, write-lock hold, schema version, host version, checksums.

## Edge / security

- Aborted / mid-stage backup never publishes a restore point; last good snapshot remains usable.
- Manifest path traversal rejected; checksum mismatch aborts before publish.
- Backup dirs treated as confidential (same as live DB/assets); not HTTP-exposed.

## Required Tests

- [x] Snapshot via wal_checkpoint + VACUUM INTO + asset copy; atomic publish under backup root.
- [x] Restore on a new dataDir preserves SQLite integrity, session event/revision links, and asset SHA-256.
- [x] Rollback drill reports measured duration, write-lock hold, schema version, host version, checksums.
- [x] Aborted / mid-stage backup never publishes; path traversal / checksum mismatch fail closed.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `scripts/mig-603-host-backup.self-test.mjs` → PASS (stdout only; does not rewrite this file).

## Security Coverage

| ID | How |
| --- | --- |
| Integrity | `PRAGMA integrity_check` + per-file SHA-256 before publish/restore |
| Consistency | VACUUM INTO after wal_checkpoint; no uncoordinated live copies |
| Fail-closed | Staging deleted on abort; previous published snapshot untouched |
| Path | Manifest relative paths reject `..` |

### Launch Checklist (SC)

N/A — not a launch ticket.

## Implementation Notes

- `scripts/host-backup/lib.mjs` + CLI (`create-snapshot`, `restore-snapshot`, `rollback-drill`)
- Runbooks: `docs/ops/host/backup-restore.md`, `docs/ops/host/update-rollback.md`
- Self-test covers Fall 1–3 + runbook presence

## Composition Gate

Proof: `.qa/runs/composition-gate-stack-migration-mig-603.md`
