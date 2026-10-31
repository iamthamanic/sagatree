# Negative authz suite (#607)

Regression suite for deny paths on the promoted Compose stack.

## What it proves

| Check | Expected |
|-------|----------|
| Edge call with `apikey` only (no Bearer) | `401`/`403` |
| Edge call with invalid Bearer JWT | `401`/`403` |
| Valid member JWT → `dm-tools/dice` | `200` |
| Stranger JWT → `ai-gm` for foreign session | deny (`401`/`403`/`404`) |
| Stranger REST read of non-member project | empty or deny |
| Stranger REST read/update of foreign `rulesets` / `world_graphs` (#669) | empty or deny |
| Local Admin `admin`/`1234` | **DEV-only** (`import.meta.env.DEV`) |
| Weak seeds on internet-facing binds | blocked by loopback DB/Edge defaults (#605) |

## Edge JWT gate

Custom `supabase/functions/main` routes via `userWorkers`, so stock `VERIFY_JWT` alone is not enough. `#607` adds `gateEdgeRequestJwt` in `_shared/edge-jwt-gate.ts`, honoring compose `VERIFY_JWT` (default `true`; opt-out `VERIFY_JWT=false`).

## Quality gate

- **Static + evidence contract:** `node scripts/negative-authz-suite-check.mjs` (wired into `npm run test-gate`)
- **Live refresh:** `node scripts/negative-authz-suite.mjs` → `.qa/runs/negative-authz-suite/`

## Host parity (MIG-600 / #845)

Cross-cutting deny matrix + secret-marker projections + membership canary against
host SQLite (parity-harness roles). Does **not** claim HTTP publicActivation cutover
(FEATURE VERIFIED → MIG-602).

- **Suite:** `server/tests/authz/host-negative-authz-suite.ts`
- **Gate:** `node --experimental-strip-types scripts/mig-600-host-authz-parity.self-test.mjs`
- **Evidence:** `.qa/runs/mig-600-host-authz/report.json` + `coverage.md`
- **E2E contract:** `e2e/host-negative-authz-parity.spec.ts` (Browser E2E job)

Related: `scripts/sagatree-core-workflows-check.mjs` (happy path + edge neg), `docs/ops/compose-harden-defaults.md`.
