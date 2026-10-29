# Acceptance — MIG-422 Sessions Edge Quarantine (#838)

## Intent
Characterize unmounted Edge `sessions` as an isolated Map quarantine under the session module. Preserve external/host 404; no public activation or production cutover.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host HTTP + MIG-600/#845 + MIG-602/#847. `SESSIONS_EDGE_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] All sessions methods, including world-state and import, remain dispatcher/host 404.
- [x] Isolated fixture verifies per-Map numbering, start/pause/end, chat limits and save/load object shapes; another worker/process loses these records.
- [x] Body userId, type:dm and arbitrary world-state are not authority; create_play_session / apply_session_runtime_command must not call this worker.
- [x] Legacy regression: no membership/GM/owner validation; in-memory Maps are not durable.
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-422-sessions-quarantine.self-test.mjs` → PASS

## Security Coverage
- SC-01: Quarantine documents that body fields are not authz; host retains 404.
- SC-02: N/A — no uploads.
- SC-03: N/A — no quota in source worker.
- SC-06: N/A — no secrets in Map fixtures.
- Out of scope: production cutover / host HTTP mount.

## Launch Checklist (SC)
N/A — not a launch ticket.

## Evidence
`node --experimental-strip-types scripts/mig-422-sessions-quarantine.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Implementation Notes
Quarantine under `server/src/modules/session/internal/sessions-edge-quarantine.ts`; Edge allowlist unchanged (unmounted); no `create-app` mount.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-422.md` (CLEAR).
