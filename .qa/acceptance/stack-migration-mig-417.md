# Acceptance — MIG-417 npcs quarantine (#833)

## Intent
Capture the legacy-unmounted Edge `npcs` worker; keep production host/dispatcher at 404 until a separate human activation. Isolated characterization fixtures only — no public host route or RLS invention for in-memory Maps.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host routes + MIG-600; public activation remains unauthorized (`NPCS_PUBLIC_ACTIVATION_AUTHORIZED === false`). FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847. RELEASE APPROVED → human only (cutover / Supabase shutdown / desktop).

## Required Tests
- [x] npcs worker all CRUD/social/export/generator paths remain 404 (allowlist excludes `npcs`; create-app / route-registry have no npcs mount; activation flag false; host probes 404).
- [x] Isolated fixture pins defaults, generated ranges, memory slicing, replacement relationships and dialogue shape.
- [x] Request prompt does not trigger external provider; legacy NPC Map structure is not substituted for `npc_creature_definitions` / instances / controller policy.
- [x] Legacy regression characterized: no auth/ownership/session visibility; generated prompt unused; object spreads may override nominally generated dialogue `id`/`npcId`.
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-417-npcs-quarantine.self-test.mjs` → PASS

## Security Coverage
- SC-01: Dispatcher/host deny before any Map mutation; no auth invented for quarantine Maps.
- SC-02: N/A — no uploads in this slice.
- SC-03: N/A — historical worker has no quota.
- SC-06: No provider keys; prompt path must not call external LLM.
- Out of scope: production cutover / host HTTP mount / npc_creature policy replacement.

## Launch Checklist (SC)
N/A — not a launch ticket.

## Evidence
`node --experimental-strip-types scripts/mig-417-npcs-quarantine.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Implementation Notes
Isolated quarantine under `server/src/modules/npc-creature/internal/npcs-quarantine.ts` + barrel exports; Edge allowlist unchanged; no `create-app` / route-registry mount.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-417.md` (CLEAR).
