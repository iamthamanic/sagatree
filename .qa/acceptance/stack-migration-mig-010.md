# Acceptance — MIG-010 / #789 Node host skeleton

## Status

Implementation acceptance: **ready for review** (local self-test PASS).

## Evidence

| AC | Proof |
| --- | --- |
| Readiness only after init; same data dir after restart | `scripts/mig-010-host-skeleton.self-test.mjs` (AC1) |
| Invalid config / busy port / unwritable dir → exit code + redacted cause | self-test AC2 |
| Shutdown rejects mutations; confirmed data retained | self-test AC3 (`/v1/ping` + ping-log + identity file) |
| `server/` registered; bootstrap wires identity/permissions/ops; public APIs; `checkRegisteredHostPackages` | live `server/src/**` + `npm run test-gate` architecture-boundary (+ self-test regressions already on main) |
| No type escape hatches | TypeScript under `server/src` uses explicit types; no `any` / `as unknown as` |

## Composition Gate

See `.qa/runs/composition-gate-stack-migration-mig-010.md`.

## Non-claims

GATE-02..05 and production cutover are **not** approved by this ticket.
