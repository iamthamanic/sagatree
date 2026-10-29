# Acceptance — MIG-419 Rulesets Quarantine (#835)

## Intent
Capture the legacy-unmounted Edge `rulesets` worker; keep production host/dispatcher at 404 until a separate human activation. Isolated characterization fixtures only — no public Edge-shaped host route or RLS invention for in-memory Maps. Distinct from durable MIG-309 rulesets catalog ports.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
Authorized host routes + MIG-600; public activation remains unauthorized (`RULESETS_PUBLIC_ACTIVATION_AUTHORIZED === false`). FEATURE VERIFIED → MIG-600/#845 + MIG-602/#847. RELEASE APPROVED → human only.

## Required Tests
- [x] rulesets and supplemental routes stay dispatcher404 (allowlist excludes `rulesets`; create-app / route-registry have no Edge rulesets mount; activation flag false; host probes 404).
- [x] Isolated fixture checks defaults, enrich=true behavior and exact Open5e mapping; no network request during ordinary non-enrich catalog read.
- [x] HTTP failure/bad JSON produces empty supplement arrays; no assumption that limit500 follows pagination or includes all remote records.
- [x] Legacy regression: no auth/owner/creation validation; caller-supplied id overwrites Map entry; Open5e has no timeout/status/pagination beyond limit=500.
- [x] Touched files: zero type escape hatches.
- [x] `scripts/mig-419-rulesets-quarantine.self-test.mjs` → PASS

## Security Coverage
- SC-01: Dispatcher/host deny before Map mutation; no auth invented for quarantine Maps.
- SC-02: N/A — no uploads.
- SC-03: N/A — no historical quota.
- SC-06: Open5e fetch injectable; no provider keys in quarantine surface.
- Out of scope: production cutover / Edge-shaped host HTTP mount.

## Launch Checklist (SC)
N/A — not a launch ticket.

## Evidence
`node --experimental-strip-types scripts/mig-419-rulesets-quarantine.self-test.mjs` → PASS (wired into `npm run test-gate`).

## Implementation Notes
Isolated quarantine under `server/src/modules/rulesets/internal/edge-rulesets-quarantine.ts` + barrel exports; Edge allowlist unchanged; no `create-app` / route-registry Edge mount. Does not alter MIG-309 durable catalog ports.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-419.md` (CLEAR).
