# Acceptance — stack-migration-mig-703 (#852 / MIG-703)

## Intent

Integrate the GATE-05–approved Tauri + Node sidecar packaging on the finished
browser host as an **isolated-contract** under `desktop/` + `docs/ops/desktop/`.

## Acceptance tier

`isolated-contract`. SLICE DONE does **not** imply product/store RELEASE or
store distribution — that remains a separate human decision.

## Preconditions

- GATE-05/#788 `APPROVED` with ADR-ST-09 + completionEvidence.
- MIG-602/#847, MIG-603/#848 DONE.

## Happy path

- Approvals without `APPROVED` keep desktop unlock blocked (no Tauri side-effect).
- Current host platform RUN lifecycle (start/stop, restart persistence, sidecar
  failure); other platforms remain NOT RUN open points.
- Bridge denies foreign origin / nonce mismatch / unknown op; update/rollback
  restores host state + permissions markers.

## Required Tests

- [x] MIG-703 bleibt gesperrt; Tauri/Electron-Abhängigkeiten werden nicht als Nebenwirkung früher Browser-Wellen eingeführt.
- [x] Pro Plattform sind App-/Sidecar-Lebenszyklus, Datenerhalt und erklärtes Fehlerbild belegt; nicht ausgeführte Plattformen bleiben offene Abnahmepunkte.
- [x] Die Bridge verweigert den Zugriff; ein Update-/Rollback-Drill erhält bestehende Host-Daten und ihre Berechtigungen.
- [x] `node --experimental-strip-types scripts/mig-703-tauri-integration.self-test.mjs` → PASS.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Security Coverage

| ID | How |
| --- | --- |
| Unlock gate | `evaluateDesktopUnlock` requires GATE-05 `APPROVED` + evidence on disk |
| Bridge allowlist | foreign-origin / manipulated-message / unknown-op |
| Lifecycle honesty | NOT RUN platforms stay open; never scored as PASS |
| Rollback | host fingerprint + `ownerUserId` / roles restored |

## Composition Gate

See `.qa/runs/composition-gate-stack-migration-mig-703.md`.

## Non-claims

- No Tauri dependency added to product Vite `package.json`.
- No claim that linux/win32 packaging RAN on this host.
- No store / product RELEASE authorization.
