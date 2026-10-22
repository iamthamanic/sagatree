# Acceptance — MIG-010 / #789 Node host skeleton (+ hardening)

## Status

Implementation acceptance: **hardening in review** (HTTP boundary, identity fail-closed, privilege-independent data-dir deny).

## Evidence

| AC / finding | Proof |
| --- | --- |
| Readiness only after init; same data dir after restart | `scripts/mig-010-host-skeleton.self-test.mjs` AC1 |
| Invalid config / busy port / data-dir deny → exit + redacted cause | self-test AC2 — (A) regular file as path; (B) force-unwritable hook; (C) **real `accessSync(W_OK)`** on existing mode-0500 dir under non-root (PASS euid=501); root → NOT RUN |
| Shutdown rejects mutations; confirmed data retained | self-test AC3 |
| HTTP invalid request-target → 400; host stays healthy | self-test Regression 1 (raw `GET http://[`) |
| Unexpected handler error → 500, no promise rejection, no secret leak | self-test Regression 1 (throwing health use-case) |
| Corrupt identity with secret marker → exit 1, ready:false, no marker/raw leak | self-test Regression 2 (`createHost` + `main.ts` spawn) |
| Module boundaries | `checkRegisteredHostPackages` via architecture-boundary-check |

## Composition Gate

See `.qa/runs/composition-gate-stack-migration-mig-010.md`.

## Non-claims

GATE-02..05 and production cutover are **not** approved by this ticket. GATE-04 is a separate human decision.
