# Host update & rollback drill (MIG-603)

Use with [`backup-restore.md`](backup-restore.md). Isolated-contract ops drill —
not a production cutover approval.

## Before update

1. Quiet or stop writers (`VACUUM INTO` briefly takes SQLite write locks).
2. Create a published snapshot:

```bash
node scripts/host-backup/cli.mjs create \
  --data-dir "$SAGATREE_DATA_DIR" \
  --backup-root /path/to/backups \
  --snapshot-id "pre-update-$(date -u +%Y%m%dT%H%M%SZ)" \
  --host-version "$(node -p "require('./package.json').version")"
```

3. Record from the JSON: `manifest.schemaVersion`, `writeLockHeldMs`,
   `durationMs`, file checksums. Keep the snapshot directory immutable.

## Update (test host)

1. Deploy / pull the new host image or binary against **test** data.
2. Boot; confirm `/health` and schema migrations apply cleanly.
3. Spot-check owner-scoped reads and one write path.

## Rollback drill (required evidence)

Automated drill (mutates `host.sqlite` then restores):

```bash
node scripts/host-backup/rollback-drill.mjs \
  --data-dir /path/to/test-data \
  --backup-root /path/to/drill-backups \
  --host-version 1.0.0-drill
```

Manual restore of a pre-update snapshot:

```bash
node scripts/host-backup/cli.mjs restore \
  --snapshot /path/to/backups/pre-update-… \
  --data-dir /path/to/rollback-data-dir
```

Evidence the drill report must include:

| Field | Meaning |
|-------|---------|
| `schemaVersion` | Schema compatibility of the restored catalog |
| `fileChecksums` / `host.sqlite` sha256 | Restored checksums match the pre-update snapshot |
| `measuredDurationMs` | Measured restore/drill duration |
| `writeLockHeldMs` | Documents exclusive lock held during snapshot |

Then start the previous host version against the restored data dir and confirm
`/health` + allowed player/owner actions.

## Never

- `docker compose down -v` on a volume that still holds the only copy of data.
- Promote a `.staging/*` directory as a restore point.
- Claim RELEASE APPROVED / Supabase shutdown from this drill alone.
