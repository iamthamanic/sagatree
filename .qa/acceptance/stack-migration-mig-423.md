# Acceptance — MIG-423 Spellbook Edge Quarantine (#839)

## Intent
Characterize unmounted Edge `spellbook` as an isolated Map quarantine under the character module. Preserve external/host 404; no public activation or production cutover.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host HTTP + ownership/class checks. `SPELLBOOK_EDGE_PUBLIC_ACTIVATION_AUTHORIZED === false`.

## Required Tests
- [x] All spellbook/spells methods remain dispatcher/host 404.
- [x] Isolated fixture verifies SRD seed, filters, learn/prepare/unprepare, cast slot burn without spell checks, restore; another store loses custom spells.
- [x] Path characterId and body spellId/level are not authority; membership store must not call this worker.
- [x] Legacy regression: no identity/owner validation; in-memory Maps are not durable; side-effecting GET creates books.
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-423-spellbook-quarantine.self-test.mjs` → PASS

## Security Coverage
- SC-01: Quarantine documents that path/body fields are not authz; host retains 404.
- SC-02: N/A — no uploads.
- SC-03: N/A — no quota beyond in-memory slot counters.
- SC-06: N/A — no secrets in Map fixtures.
- Out of scope: production cutover / host HTTP mount.

## Launch Checklist (SC)
N/A — not a launch ticket.

## Evidence
`node --experimental-strip-types scripts/mig-423-spellbook-quarantine.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Implementation Notes
Quarantine under `server/src/modules/character/internal/spellbook-edge-quarantine.ts`; Edge allowlist unchanged (unmounted); no `create-app` mount.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-423.md` (CLEAR).
