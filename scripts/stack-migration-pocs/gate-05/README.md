# GATE-05 PoC — Tauri + Node sidecar packaging (execute unlock)

Owner selected **Variant A (Tauri + Node sidecar)** on 2026-10-23.
`APPROVED_TO_EXECUTE` (2026-11-01) unlocks this PoC; **desktop ship / MIG-703**
still needs full `APPROVED` after three-OS evidence.

## What this fixture proves

- Same Node host binary contract as the VPS/Docker profile (no second backend).
- Sidecar start/stop, port conflict, persistent data directory, failed-start path.
- Renderer must not receive host DB path or service-role secrets (contract audit).
- Product `package.json` does **not** gain a Tauri dependency from this PoC.
- Only **MIG-703** depends on GATE-05 in the intake graph.

## What stays NOT RUN / human

- Real Tauri shell packaging + code signing on macOS/Windows/Linux (matrix rows).
- Auto-update channel fail-closed against a live updater.
- Desktop product UI in `src/` or `desktop/`.

```sh
node scripts/stack-migration-pocs/gate-05/check.mjs --check
node scripts/stack-migration-pocs/gate-05/check.mjs --write
```

Evidence: `.qa/evidence/stack-migration-prep/pocs/gate-05/`
