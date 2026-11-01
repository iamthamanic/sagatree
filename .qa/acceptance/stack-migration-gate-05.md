# Acceptance — stack-migration-gate-05 (#788 / GATE-05)

## Intent

Execute Variant A (Tauri + Node sidecar) packaging **PoC** under
`APPROVED_TO_EXECUTE` (2026-11-01 Freigabe A). Prove sidecar start/stop, port
conflict, persistent data dir, failed boot, secrets-not-in-renderer contract,
and intake graph: only MIG-703 depends on GATE-05. No product Tauri activation.

## Acceptance tier

`isolated-contract` (PoC evidence). Fixture PASS does **not** imply technology
`APPROVED` or MIG-703 unlock — intake must stay `ready` until full APPROVED.

## Preconditions

- MIG-602/#847 + MIG-603/#848 DONE.
- Owner `GATE-05` status `APPROVED_TO_EXECUTE` in `architecture-approvals.json`.
- Dornhain Freigabe A recorded (`releases.CUTOVER-DORHAIN`).

## Happy path

- Sidecar listens on loopback, `/health` OK, SIGTERM exits `{code:0,signal:null}`.
- Data-dir marker survives shutdown and a second boot (restart persistence).
- Occupied port → exit **exactly 4** (no timeout PASS); `GATE05_FAIL_BOOT=1` → exit 3.
- `/secrets-leak-probe` returns 404.
- Product `package.json` has no Tauri deps; no `src-tauri/` from this PoC.
- Intake dependents of GATE-05 === `['MIG-703']`.
- `--check` verifies `observations.reportSha256`, platform matrix, and criterion↔case ledger.

## Edge / security

- Unexecuted platforms (linux/win32 on this host) remain **NOT RUN**.
- Signed updates / live updater + product `server/` packaging remain **NOT RUN** (fixture uses `sidecar.mjs` stand-in).
- Partial smoke must not ship desktop product UI or mark GATE-05 intake `done`.

## Required Tests

- [x] Start/Stop + health + restart persistence (darwin RUN).
- [x] Port conflict exit 4 + failed sidecar start exit 3 (no timeout PASS).
- [x] Secrets probe 404; no product Tauri / no `src-tauri`.
- [x] Only MIG-703 depends on GATE-05 (intake assert).
- [x] Product host binary packaging + signed updates + non-RUN OS platforms recorded as NOT RUN.
- [x] `--check` digest + platform + criterion ledger vs committed report.
- [x] `node scripts/stack-migration-pocs/gate-05/check.mjs --check` → PASS.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Security Coverage

| ID | How |
| --- | --- |
| Loopback only | Sidecar binds `127.0.0.1` |
| Secrets isolation | `/secrets-leak-probe` → 404 |
| No product activation | package.json + src-tauri asserts |
| Fail-closed listen | Port conflict exit 4 |

### Launch Checklist (SC)

N/A — PoC fixture only. MIG-703 / desktop ship needs full GATE-05 APPROVED +
three-OS packaging evidence.

## Composition Gate

See `.qa/runs/composition-gate-stack-migration-gate-05.md`.

## Non-claims

- No Tauri product dependency added.
- No Windows/Linux packaging executed on this host.
- No production cutover / Supabase shutdown (Dornhain path remains MIG-700..702).
- Intake GATE-05 remains `ready` (cannot mark `done` without full APPROVED).
