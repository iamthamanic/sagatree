# GATE-02 — real authentication and Chromium evidence

**Required Cookie-A R01: PASS (`authProfile: 'cookie'`; JWT escape remediaiton). Execution: PASS. Approval: NOT APPROVED.** Real Chromium proves page JS cannot restore a session without the HttpOnly cookie, and cannot mint a reusable JWT via `/api/auth/token` (hard-denied). Architecture freigabe still requires a human decision on #785.

The [report](report.json) records exact per-criterion status, assertions, versions and source hashes. [Observations](observations.json) record the actual runtime and timings. The [complete fixture README](../../../../../scripts/stack-migration-pocs/gate-02-03/README.md) explains reproduction, all severity levels, exact boundaries and primary sources. ADR draft: [`ADR-ST-06`](../../../../../docs/architecture/ADR-ST-06-gate-02-auth-handshake.md) (**PROPOSAL / DECISION PENDING**).

## Required criteria

| Row | Assertion / observed goal | A cookie | B JWT |
| --- | --- | --- | --- |
| 1 | Credential isolation: no JS-usable sign-in/bearer/JWT; `/api/auth/token` denied on cookie hosts; cookie path still authenticates | **PASS** | **NOT RUN** for secure browser JWT storage/transport |
| 2 | No credentials cannot join an actual room | PASS | PASS |
| 3 | Actual logout/revoke rejects new joins/reconnects and closes the old socket within 2 s | PASS | PASS |
| 4 | Valid reconnect restores room/seat; another actor or second login cannot take over the ticket | PASS | PASS |
| 5 | Player cannot claim GM/another character; client role spoof and outsider denied | PASS | PASS |
| 6 | Independent host credentials and foreign Origin denied for actual room access | PASS (cookie↔cookie) | **PASS** (jwt↔jwt via second `authProfile: 'jwt'` host + foreign JWKS negative; not cookie Bearer denial) |
| 7 | Solo plus public bind fails before listen; forged local identity cannot authorize remote room access | PASS | PASS |

The executed browser result uses **Chromium 140.0.7339.186 / Playwright 1.55.1**, a new nonpersistent context, real Better Auth HTTP login and the real Colyseus browser SDK. Cookies and Origin are not injected into the positive flow. Chrome stores the actual HttpOnly/SameSite=Lax cookie and `document.cookie` cannot read it. Ordinary `/api/whoami` GET without Origin succeeds; the real socket joins and acknowledges a command. A foreign-origin command actually carries the ambient same-site cookie but receives HTTP 403 with no revision change; the foreign-origin socket fails.

**Cookie profile:** opaque `bearer()` and JWT plugins unloaded; `/api/auth/token` hard-returns 404; browser-facing auth JSON strips session bearer fields and `set-auth-token`; JWT issuance only on a separate `authProfile: 'jwt'` host (Node B). Chromium confirms `bodyTokenReadable` / `bearerHeaderReadable` are false, token-endpoint mint is denied, and `credentials:'omit'` Authorization replay does not authenticate.

Expired/tampered credentials, foreign character seats, current roles, real sign-out/revoke and independent auth stores are also exercised. **B-6** uses a second independently initialized jwt-profile host (`jwt2`) so cross-host rejection is JWT/JWKS/issuer/session isolation — presenting a JWT only to a cookie host would mask missing jwt↔jwt isolation. Evidence keys include `isolationMode: "jwt-to-jwt"`, `foreignJwksRejectsLocalJwt`, `peerJwtHostAcceptsOwnJwt`, and `rejectionNotFromCookieProfileBearerDeny`. The JWT-signature canary shows that an unexpired revoked JWT remains cryptographically valid; the current-session lookup supplies the tested immediate rejection. Opaque bearer distinction is **NOT RUN** (plugin disabled).

## Recorded revocation observations

See [observations.json](observations.json) for the exact platform and timings. Timing begins before the real logout/revoke HTTP call and ends when the existing socket is observed closed. Every run asserts the 2,000 ms limit; active connections are checked every 250 ms.

These local observations are not worst-case production guarantees. HTTPS Secure-cookie behavior, other browser engines, a secure browser JWT profile/store, public TLS/proxies and all Tauri behavior remain **NOT RUN**. Complete GATE-01 owner/GM/invitation policy, distributed seat persistence and production abuse limits are outside the fixture.

## Reproduction semantics

```sh
npm ci --prefix scripts/stack-migration-pocs/gate-02-03 --ignore-scripts --no-audit --no-fund
node scripts/stack-migration-pocs/gate-02-03/node_modules/playwright/cli.js install --with-deps chromium
node scripts/stack-migration-pocs/gate-02-03/check.mjs --check
```

`--check` executes all probes, validates source/report identity and the saved historical measurement file, and prints new rerun metrics. Neither command stamps APPROVED. A supplied browser can be selected with `GATE0203_CHROMIUM=/absolute/path/to/chrome-headless-shell`.
