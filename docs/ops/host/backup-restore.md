# Host backup & restore (MIG-603)

Isolated ops contract for the Node host under `SAGATREE_DATA_DIR`. Backups hold
the same protected data as live files — treat snapshot directories like production
data (permissions, encryption at rest, access control).

**Not** a production RELEASE APPROVED cutover. Evidence tier: `isolated-contract`.

## What is snapshotted

| Path under data dir | Method |
| --- | --- |
| `host.sqlite` (+ WAL) | `wal_checkpoint(PASSIVE)` → `VACUUM INTO` (never inside a transaction) — **not** a raw multi-file copy |
| `auth.sqlite` (if present) | `wal_checkpoint(PASSIVE)` → `VACUUM INTO` (same as host.sqlite — never a raw file copy) |
| `assets/` | recursive copy; verified against `assets.checksum_sha256` |

Uncoordinated `cp host.sqlite*` while writers run is **forbidden** — it can publish
a torn `-wal`/`-shm` pair that looks like a restore point but fails integrity.

## CLI

```bash
# Create (atomic: .staging/<id> → rename only after integrity + hashes PASS)
node scripts/host-backup/cli.mjs create \
  --data-dir /path/to/data \
  --backup-root /path/to/backups \
  --snapshot-id snap-$(date -u +%Y%m%dT%H%M%SZ)

# Verify manifest checksums + PRAGMA integrity_check + asset hashes
node scripts/host-backup/cli.mjs verify --snapshot /path/to/backups/snap-…

# Restore into a data dir — staging swap; previous live tree moved aside and
# removed only after the new tree verifies
node scripts/host-backup/cli.mjs restore \
  --snapshot /path/to/backups/snap-… \
  --data-dir /path/to/data-restored
```

Aliases: `create-snapshot.mjs` / `restore-snapshot.mjs` / `restore.mjs` /
`rollback-drill.mjs` call the same library.

Compose backup mount (MIG-601): `${SAGATREE_BACKUP_MOUNT:-./backups}` → `/backups`
inside `deployment/docker-compose.host.yml`. Prefer writing snapshots there.

## Publishing rules

1. Work under `<backup-root>/.staging/<id>`.
2. Host `PRAGMA integrity_check` must be `ok`; asset hashes must match.
3. Only then: atomic rename to `<backup-root>/<id>` + `manifest.json`.
4. Aborted / failed runs **do not** publish a restore point (`.staging` removed).

## Failure modes

| Situation | Expected behavior |
|-----------|-------------------|
| Disk full / aborted copy | Staging discarded; no published id |
| Hash / integrity failure | Staging discarded; last good snapshot stays usable |
| Restore abort before publish | Previous live tree remains consistent |

## Related

- Update / rollback drill: [`update-rollback.md`](update-rollback.md)
- Host Compose profiles: [`../host-compose-profiles.md`](../host-compose-profiles.md)
- Architecture WAL/backup rules: [`../../architektur-sqlite-based.md`](../../architektur-sqlite-based.md)
