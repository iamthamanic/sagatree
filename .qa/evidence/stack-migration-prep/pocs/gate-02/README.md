# GATE-02 — real authentication and Chromium evidence

**Required goal: FAIL. Execution: 18 PASS assertions/canaries, 0 unexpected assertion failures, 1 JWT-browser case NOT RUN. Approval: NOT APPROVED.** Real Chromium falsifies required cookie-variant row 1 in the combined cookie/bearer/JWT candidate. A technically successful probe of that defect is not a successful credential-isolation objective.

The [report](report.json) records exact per-criterion status, assertions, versions and source hashes. [Observations](observations.json) record the actual runtime and timings. The [complete fixture README](../../../../../scripts/stack-migration-pocs/gate-02-03/README.md) explains reproduction, all severity levels, exact boundaries and primary sources.

## Required criteria

| Row | Assertion / observed goal | A cookie | B JWT |
| --- | --- | --- | --- |
| 1 | Credential isolation: real Chrome can replay JS-readable sign-in/header tokens without cookies | **FAIL** | **NOT RUN** for secure browser JWT storage/transport |
| 2 | No credentials cannot join an actual room | PASS | PASS |
| 3 | Actual logout/revoke rejects new joins/reconnects and closes the old socket within 2 s | PASS | PASS |
| 4 | Valid reconnect restores room/seat; another actor or second login cannot take over the ticket | PASS | PASS |
| 5 | Player cannot claim GM/another character; client role spoof and outsider denied | PASS | PASS |
| 6 | Independent host credentials and foreign Origin denied for actual room access | PASS | PASS |
| 7 | Solo plus public bind fails before listen; forged local identity cannot authorize remote room access | PASS | PASS |

The executed browser result uses **Chromium 140.0.7339.186 / Playwright 1.55.1**, a new nonpersistent context, real Better Auth HTTP login and the real Colyseus browser SDK. Cookies and Origin are not injected into the positive flow. Chrome stores the actual HttpOnly/SameSite=Lax cookie and `document.cookie` cannot read it. Ordinary `/api/whoami` GET without Origin succeeds after the scoped Host/Fetch-Metadata fix; the real socket joins and acknowledges a command. A foreign-origin command actually carries the ambient same-site cookie but receives HTTP 403 with no revision change; the foreign-origin socket fails.

**High, open:** sign-in JSON contains a page-readable token and bearer() emits a page-readable `set-auth-token`. Chrome uses each to call real `/api/auth/get-session` successfully with `credentials: omit`. The observed requests contain Authorization and no Cookie. This proves the tokens are usable credentials and the combined candidate fails A/1. No token value is stored in these artifacts. No unreviewed token proxy or complete cookie-only auth profile is supplied.

Expired/tampered credentials, foreign character seats, current roles, real sign-out/revoke and independent auth stores are also exercised. The JWT-signature canary shows that an unexpired revoked JWT remains cryptographically valid; the current-session lookup supplies the tested immediate rejection. Initial join/create HTTP reservation authenticates. Colyseus HTTP **reconnect reservation is ticket-based and does not itself rerun onAuth**; a reservation response is not room access. Current actor/login binding and Origin are enforced at the actual WS upgrade, with further checks on reconnect/messages.

## Recorded revocation observations

Node **24.19.0**, SQLite **3.53.3**, Linux x64 kernel **6.18.55**. Timing begins before the real logout/revoke HTTP call and ends when the existing socket is observed closed. Every run asserts the 2,000 ms limit; active connections are checked every 250 ms.

| Credential | Operation | End-to-end latency |
| --- | --- | ---: |
| Cookie | sign-out | 203.437 ms |
| Cookie | revoke-session | 129.400 ms |
| JWT | sign-out | 80.079 ms |
| JWT | revoke-session | 148.477 ms |

These local observations are not worst-case production guarantees. HTTPS Secure-cookie behavior, other browser engines, a secure browser JWT profile/store, public TLS/proxies and all Tauri behavior remain **NOT RUN**. Complete GATE-01 owner/GM/invitation policy, distributed seat persistence and production abuse limits are outside the fixture. The shared findings table retains the fixed GET-Origin and observation-integrity Medium findings, typed-decoder/null/async-handler Low findings, and Info/tech-debt.

## Reproduction semantics

```sh
npm ci --prefix scripts/stack-migration-pocs/gate-02-03 --ignore-scripts --no-audit --no-fund
node scripts/stack-migration-pocs/gate-02-03/node_modules/playwright/cli.js install --with-deps chromium
node scripts/stack-migration-pocs/gate-02-03/check.mjs --check
```

`--check` executes all probes, validates source/report identity and the saved historical measurement file, and prints new rerun metrics. **It exits nonzero for the known required GATE-02 failure.** `--check-execution` is explicitly a separate reproduction check: it can exit zero for consistent execution/evidence while still printing the objective FAIL. Neither approves a framework or turns the failed criterion green. A supplied browser can be selected with `GATE0203_CHROMIUM=/absolute/path/to/chrome-headless-shell`.
