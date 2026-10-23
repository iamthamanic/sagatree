# Acceptance — gate-02-b6-jwt-cross-host-ci (#785 remediaiton / PR #905 P1)

## Intent

Close the GATE-02 B-6 false positive where Variant B cross-host isolation presented a JWT only to a cookie-profile host (Bearer hard-deny masks missing JWT↔JWT isolation). Prove jwt↔jwt via a second independently initialized `authProfile: 'jwt'` host plus foreign JWKS negative control. Pin GATE-02/03 CI to `ubuntu-24.04` so Playwright 1.55.1 Chromium install succeeds. GATE-02 architecture freigabe remains **NOT APPROVED**.

## Acceptance

- [x] B-6 boots second jwt host (`jwt2`); `isolationMode: "jwt-to-jwt"`; JWKS negative + peer own-JWT whoami PASS.
- [x] Cookie A-6 remains `cookie-to-cookie` against hono host.
- [x] `node scripts/stack-migration-pocs/gate-02-03/check.mjs --write` and `--check` PASS (17 GATE-02 executed, 0 FAIL).
- [x] Decision package PoC run date / report hash match current `pocs/gate-02/report.json`.
- [x] Workflow `auth-http-realtime-candidates` uses `runs-on: ubuntu-24.04` (Playwright Chromium vs ubuntu26).
- [x] ADR-ST-06 / PoC README / evidence README document jwt2 + B-6; approval stays **NOT APPROVED** / no `architecture-approvals.json` APPROVED edit.
- [x] Composition gate CLEAR for this remediaiton HEAD.

## Composition Gate

Proof: `.qa/runs/composition-gate-gate-02-b6-jwt-cross-host-ci.md`
