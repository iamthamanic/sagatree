# Acceptance — stack-migration-mig-601 (#846)

## Intent

Reproduzierbare Compose-Profile für den Node-Host und optionale AI-/Media-Dienste unter `deployment/` + `docs/ops`.

## Acceptance tier

`isolated-contract`

## Preconditions

- MIG-010/#789 host skeleton, MIG-014/#793 Better Auth, MIG-015/#794 solo identity,
  MIG-500/#841 assets, MIG-414/#830 edge-main port — CLOSED on main.

## Happy path

- Host-only Compose: named `host-data` volume, loopback publish, `/health` green only after DB readiness.
- Restart without `-v` keeps confirmed data under `SAGATREE_DATA_DIR`.
- `--profile ai` / `--profile media` are selectable; missing optional credentials do not block core host.

## Edge / security

- No cloud secrets in `Dockerfile.host`.
- Container uses remote bind + Better Auth secret injected via env (solo forbids `0.0.0.0`).
- AI without encryption key → `not-configured`; media without codecs → `unsupported` capability.
- Backup mount path documented (`/backups`).

## Required Tests

- [x] Health wird erst nach DB-Readiness grün; bestätigte Welt-/Session-Daten überleben Container-Neustart.
- [x] Der Host bleibt für lokale Kernfunktionen benutzbar, während der betroffene Provider einen erklärten Capability-Fehler meldet.
- [x] HTTP-/Realtime- und Persistenzverhalten stimmen überein; Ports, Datenpfade und Backup-Mounts sind im Runbook reproduzierbar festgehalten.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `scripts/mig-601-host-compose.self-test.mjs` → PASS (stdout only; does not rewrite this file).

## Security Coverage

| ID | How |
| --- | --- |
| B-01 | Auth secret required for remote container bind; not in image |
| B-07 | Capability errors explicit; no silent provider success |
| Path | Data + backup mounts fixed in runbook |

### Launch Checklist (SC)

N/A — not a launch ticket.

## Implementation Notes

- `deployment/docker-compose.host.yml`, `Dockerfile.host`, `.env.host.example`
- Runbook: `docs/ops/host-compose-profiles.md`
- Self-test covers static compose contract + native host ready/restart + AI/media capability gaps

## Composition Gate

Proof: `.qa/runs/composition-gate-stack-migration-mig-601.md`
