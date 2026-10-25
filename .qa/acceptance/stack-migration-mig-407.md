# Acceptance — MIG-407 dm-tools quarantine (#823)

## Intent
Capture legacy-unmounted `dm-tools`; keep host/dispatcher at 404 until separate human activation. Isolated seeded dice/combat fixtures only.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
authorized host routes + MIG-600; `DM_TOOLS_PUBLIC_ACTIVATION_AUTHORIZED === false`. FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] dm-tools routes remain 404 at host (dice/health included) via createRouteHandler probes + allowlist deny.
- [x] Seeded fixtures: d20 advantage, notation/call-site modifier, initiative ordering, next-round and end-combat logs.
- [x] Invalid notation / missing target throw; no authenticated combat or durable Redis claim.
- [x] Legacy regression: unauthenticated client authority; unbounded dice-count; REDIS_URL unused.
- [x] Touched files: zero type escape hatches.
- [x] scripts/mig-407-dm-tools-quarantine.self-test.mjs → PASS


## Evidence
`node --experimental-strip-types scripts/mig-407-dm-tools-quarantine.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-407.md`.
