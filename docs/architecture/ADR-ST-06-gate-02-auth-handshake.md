# ADR-ST-06 — GATE-02: Auth handshake (Better Auth + Colyseus)

- **Status:** **APPROVED — Variant A**, product implementation only (platform release / production cutover NOT approved)
- **Date:** 2026-10-22
- **Issue:** [#785](https://github.com/iamthamanic/sagatree/issues/785)
- **Human source:** [owner decision, delegated recording on #785](https://github.com/iamthamanic/sagatree/issues/785#issuecomment-6364772323) (explicit owner confirmation 2026-10-23)
- **Decision:** `GATE-02: APPROVED — Variant A (session cookies)`

## Context

Epic #773 local-first stack migration requires a browser-capable auth handshake between Better Auth and Colyseus. Isolated PoC evidence lives under `scripts/stack-migration-pocs/gate-02-03/` and `.qa/evidence/stack-migration-prep/pocs/gate-02/`.

| Variant | Credential | Browser row 1 (R01) |
| --- | --- | --- |
| **A — session cookies** | HttpOnly `SameSite=Lax` Better Auth session cookie on `authProfile: 'cookie'` hosts | Chromium PASS after JWT-escape remediaiton: no JS-usable sign-in/bearer tokens; `/api/auth/token` hard-denied; cookie whoami + Colyseus + CSRF PASS |
| **B — bearer JWT** | Separate `authProfile: 'jwt'` host; JWT plugin + session-store recheck | Node/ws PASS for rows 2–7; **browser/Tauri secure store NOT RUN** |

Decision package: `.qa/evidence/stack-migration-prep/GATE-02-decision-package.md` (historical PoC status NOT APPROVED; human approval follows as a separate GitHub decision, and must not change observed PoC fields).

## Approved implementation decision

**Prefer Variant A (session cookies)** after Cookie-A R01 PASS under the split cookie PoC profile:

1. Disable opaque Better Auth `bearer()` for the browser path.
2. Do **not** load the JWT plugin on cookie-profile hosts; hard-deny `/api/auth/token` (not via User-Agent / Origin / Fetch-Metadata alone).
3. Do not return usable session bearer fields (or `set-auth-token`) to page JS on sign-in / browser-facing auth JSON.
4. Preserve HttpOnly `Set-Cookie` as the sole browser session credential; cookie hosts reject `Authorization` Bearer.
5. Run Variant B JWT issuance only on a **separate** jwt-profile host for Node clients — product adoption of B still requires a separate browser/Tauri secure-store proof.

**History:** PR #900 left `/api/auth/token` reachable on the cookie PoC (external P1). Follow-up remediaiton closes that escape; R01 was FAIL until then.

The owner confirmed Variant A. Approval is evidenced by the issue comment and architecture-approvals.json; it does not claim that NOT RUN platform tests have passed.

## Consequences of Variant A approval

### Binding

1. Browser clients authenticate with Better Auth session cookies; page JS must not receive restorable session bearers.
2. Colyseus `onAuth` / WS upgrade continue to resolve the current session (cookie or product-equivalent) and bind seats to the exact auth session.
3. CSRF story for cookie credentials remains mandatory for product routes (PoC foreign-origin negatives already PASS).

### Still NOT approved by this A decision alone

- Variant B as the browser/Tauri default
- HTTPS `Secure` cookie / multi-engine / Tauri persistence gaps listed as NOT RUN in the decision package
- Production cutover / Supabase Auth shutdown
- GATE-03 / GATE-05

## Evidence summary

- Cookie-A R01: real Chromium isolation PASS under `authProfile: 'cookie'` (`A-1-browser` includes `/api/auth/token` 404 negative + auth-path credential scan; `credentialIsolationSatisfied: true`).
- Cookie rows 2–7 on cookie hosts and JWT Node rows 2–7 on separate jwt hosts: PASS in fixture reports (B-6 = jwt↔jwt via second independently initialized jwt host + foreign JWKS negative control; not cookie-profile Bearer denial).
- B row 1 browser/Tauri secure JWT store: NOT RUN.
- Opaque bearer distinction case: NOT RUN (plugin disabled; JWT isolated to jwt host).
- Fixture report preserves the historical PoC `NOT APPROVED` observation; a separate owner GitHub comment dated 2026-10-23 is the binding decision. HTTPS/Tauri platform proofs remain NOT RUN.
