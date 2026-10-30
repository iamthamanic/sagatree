# Acceptance — MIG-311 Session Host Adapters (#810)

## Intent
Port `src/infrastructure/session` persistence callers onto approved host repository ports while Supabase remains the live default (no production cutover). Lobby ready stays non-authoritative; media Edge shapes stay unmounted.

## Acceptance tier
`isolated-contract` — SLICE DONE.

## Deferred integration
MIG-602/#847 feature E2E cutover; FEATURE VERIFIED → MIG-602/#847 + remaining MIG-30x. RELEASE APPROVED → human only.

## Required Tests
- [x] All 12 RPC names + 2 Edge names listed on host dual-path contract; host `createSessionPorts` preserves typed DENY for foreign actors on lifecycle/access/runtime/recap.
- [x] Runtime snapshot/presence/command paths return typed results; stranger cannot mutate foreign session runtime.
- [x] Lobby ready documented as ephemeral non-authoritative broadcast (legacy defect preserved).
- [x] Media token / recap Edge remain `PUBLIC_ACTIVATION_AUTHORIZED = false`; client media/runtime shapes retained.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).
- [x] `scripts/mig-311-session-adapter.self-test.mjs` → PASS

## Security Coverage
- Session membership/GM checks stay server-side on host ports (SC-01 / B-01).
- No client-claimed actor elevation; actor id is verified host actor only (B-07/B-08).
- Lobby ready userId is never gameplay authorization (legacy defect explicit).
- Launch SC-01…SC-07: N/A — not a launch ticket; inline SC-01/SC-02 covered above.

## Evidence
`node --experimental-strip-types scripts/mig-311-session-adapter.self-test.mjs` → PASS.

## Composition Gate
See `.qa/runs/composition-gate-stack-migration-mig-311.md`.

## Implementation Notes
- FE dual-path: `host-session-ports.contract.ts` + `createHostSessionAdapter`.
- `SESSION_INFRA_PUBLIC_ACTIVATION_AUTHORIZED = false`; `createHost` exposes `session` ports.
- Existing host stores (lifecycle/access/runtime/recap) reused; no production cutover.
