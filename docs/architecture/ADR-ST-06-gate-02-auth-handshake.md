# ADR-ST-06 — GATE-02: Auth handshake (Better Auth + Colyseus)

- **Status:** **PROPOSAL / DECISION PENDING** — **not APPROVED**
- **Date:** 2026-10-22
- **Issue:** [#785](https://github.com/iamthamanic/sagatree/issues/785)
- **Human source:** _pending explicit comment on #785_
- **Proposed decision text (not yet recorded):** `GATE-02: APPROVED — Variant A (session cookies)`

## Context

Epic #773 local-first stack migration requires a browser-capable auth handshake between Better Auth and Colyseus. Isolated PoC evidence lives under `scripts/stack-migration-pocs/gate-02-03/` and `.qa/evidence/stack-migration-prep/pocs/gate-02/`.

| Variant | Credential | Browser row 1 (R01) |
| --- | --- | --- |
| **A — session cookies** | HttpOnly `SameSite=Lax` Better Auth session cookie | Cookie-only PoC profile: Chromium PASS (no JS-usable sign-in/bearer tokens; cookie path whoami + Colyseus + CSRF negatives PASS) |
| **B — bearer JWT** | JWT plugin + session-store recheck | Node/ws PASS for rows 2–7; **browser/Tauri secure store NOT RUN** |

Decision package: `.qa/evidence/stack-migration-prep/GATE-02-decision-package.md` (status remains **NOT APPROVED / UNDECIDED** until human freigabe).

## Recommendation (proposal only)

**Prefer Variant A (session cookies)** after Cookie-A R01 PASS under the cookie-only PoC profile:

1. Disable opaque Better Auth `bearer()` for the browser path.
2. Do not return usable session bearer fields (or `set-auth-token`) to page JS on sign-in / browser-facing auth JSON.
3. Preserve HttpOnly `Set-Cookie` as the sole browser session credential.
4. Keep JWT issuance (`/api/auth/token`) available only where a non-browser Node client explicitly needs Variant B evidence — product adoption of B still requires a separate browser/Tauri secure-store proof.

This ADR **does not** grant architecture freigabe. Only an explicit human comment on #785 plus updates to `architecture-approvals.json` may set `GATE-02: APPROVED`.

## Consequences (if later APPROVED as Variant A)

### Binding

1. Browser clients authenticate with Better Auth session cookies; page JS must not receive restorable session bearers.
2. Colyseus `onAuth` / WS upgrade continue to resolve the current session (cookie or product-equivalent) and bind seats to the exact auth session.
3. CSRF story for cookie credentials remains mandatory for product routes (PoC foreign-origin negatives already PASS).

### Still NOT approved by a future A acceptance alone

- Variant B as the browser/Tauri default
- HTTPS `Secure` cookie / multi-engine / Tauri persistence gaps listed as NOT RUN in the decision package
- Production cutover / Supabase Auth shutdown
- GATE-03 / GATE-05

## Evidence summary

- Cookie-A R01: real Chromium isolation PASS under cookie-only PoC profile (`A-1-browser`, `credentialIsolationSatisfied: true`).
- Cookie rows 2–7 and JWT Node rows 2–7: PASS in fixture reports.
- B row 1 browser/Tauri secure JWT store: NOT RUN.
- Opaque bearer distinction case: NOT RUN (plugin disabled in cookie-preferred profile).
- Approval field in reports: always `NOT APPROVED` until human decision.
