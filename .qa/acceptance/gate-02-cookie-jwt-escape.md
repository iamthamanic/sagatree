# Acceptance — gate-02-cookie-jwt-escape (#785 remediaiton / PR #900 P1)

## Intent

Close the Cookie-A JWT escape on the GATE-02 PoC: cookie `authProfile` hosts must not load the Better Auth JWT plugin and must hard-deny `/api/auth/token`; Variant B JWT issuance stays on a separate jwt-profile host; Chromium asserts the token endpoint returns 404 and yields no JS-readable JWT. GATE-02 architecture freigabe remains **NOT APPROVED**.

## Acceptance

- [x] Cookie-profile fixture: no JWT plugin; `/api/auth/token` → 404 `JWT_ISSUANCE_DISABLED` (not UA/Origin/Fetch-Metadata).
- [x] JWT issuance only on separate `authProfile: 'jwt'` host (Variant B Node path).
- [x] `node scripts/stack-migration-pocs/gate-02-03/check.mjs --write` and `--check` PASS, including A-1-browser token-endpoint deny.
- [x] Decision package PoC run date / report hash match current `pocs/gate-02/report.json`.
- [x] ADR-ST-06 and PoC README document the profile split; approval stays **NOT APPROVED** / no `architecture-approvals.json` APPROVED edit.
- [x] Composition gate CLEAR for this remediaiton HEAD.

## Composition Gate

Proof: `.qa/runs/composition-gate-gate-02-cookie-jwt-escape.md`
