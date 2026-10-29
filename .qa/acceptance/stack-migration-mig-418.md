# Acceptance — MIG-418 Quests Quarantine (#834)

## Intent
Capture the legacy-unmounted Edge `quests` worker; keep production host/dispatcher at 404 until a separate human activation. Isolated characterization fixtures only — no public host route or RLS invention for in-memory Maps.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host routes + MIG-600; public activation remains unauthorized (`QUESTS_PUBLIC_ACTIVATION_AUTHORIZED === false`). FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] quests worker all routes remain 404 (allowlist excludes `quests`; create-app / route-registry have no quests mount; activation flag false; host probes 404).
- [x] Isolated objective completion proves missing objective is no-op and final completed objective changes status; no actual reward/character XP side effect.
- [x] Unknown generator type and negative/invalid level require explicit validation before any separately authorized replacement (quarantine documents unbounded legacy; activation false).
- [x] Legacy regression: unauthenticated Map writes; generated quests default empty projectId; completion does not grant rewards.
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-418-quests-quarantine.self-test.mjs` → PASS

## Security Coverage
- SC-01: Dispatcher/host deny before Map mutation; no auth invented for quarantine Maps.
- SC-02: N/A — no uploads.
- SC-03: N/A — no historical quota.
- SC-06: No provider keys.
- Out of scope: production cutover / host HTTP mount.

## Launch Checklist (SC)
N/A — not a launch ticket.

## Evidence
`node --experimental-strip-types scripts/mig-418-quests-quarantine.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Implementation Notes
Isolated quarantine under `server/src/modules/saga/internal/quests-quarantine.ts` + barrel exports; Edge allowlist unchanged; no `create-app` / route-registry mount.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-418.md` (CLEAR).
