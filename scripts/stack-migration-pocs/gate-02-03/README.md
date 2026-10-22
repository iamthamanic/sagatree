# GATE-02 / GATE-03 — isolated executable candidates

These are real-library candidate probes, not product integration or technology approval. All accounts, passwords, roles, characters and state are synthetic; listeners and databases are isolated. The full real Chromium test **falsifies GATE-02 cookie credential isolation in the combined A/B auth profile**. Successful execution of that canary does not make the gate pass.

## Reproduce and interpret the exit status

From the repository root:

```sh
npm ci --prefix scripts/stack-migration-pocs/gate-02-03 --ignore-scripts --no-audit --no-fund
node scripts/stack-migration-pocs/gate-02-03/node_modules/playwright/cli.js install --with-deps chromium
node scripts/stack-migration-pocs/gate-02-03/check.mjs --write
node scripts/stack-migration-pocs/gate-02-03/check.mjs --check
```

The browser can alternatively be supplied through `GATE0203_CHROMIUM=/absolute/path/to/chrome-headless-shell`. The recorded platform uses Chrome 140.0.7339.186, Playwright 1.55.1, Node 24.19.0, Linux x64 and SQLite 3.53.3. Node 22, macOS, Windows, other browser engines and Tauri were not executed for this fixture. The package minimum is Node 22.13; the measured and CI target is Node 24. Installation needs registry/browser-download access, and execution needs loopback listeners plus permission to launch the isolated browser. No productive account, email delivery or paid provider is used.

`--write` executes the suite and saves both reports and observations even when a required gate objective fails. `--check` executes against new temporary databases, compares the stable report and validates the historical observation file, including its report hash and measurement invariants. It prints fresh rerun metrics. **Both commands exit nonzero when a required criterion is FAIL.** The known GATE-02 A/1 failure therefore makes the strict command fail even when every executable assertion succeeds. Neither command stamps APPROVED.

For an explicitly separate evidence-reproduction job, `--check-execution` also reruns all assertions and checks source/report/observation integrity, but its exit condition is successful execution and evidence consistency. It still prints `GATE-02 status: FAIL` and never changes that failed goal into PASS. This flag must not be presented as a passing architecture gate. Any unexpected assertion failure, missing browser, missing/corrupt historical observation or source/report drift still fails that execution check.

Timing samples are not compared for equality between runs. Historical observations must identify the exact stable report, have valid runtime/timestamp fields, correct sample counts and ordered finite percentiles, satisfy the 2-second revocation deadline, show zero lost ACKs/reconnects and record genuine request overlap. The nested package/lock pins dependencies independently of the product, and installed versions must equal both. Own sources, specifications and integration-sensitive installed library files have SHA-256 evidence.

## Exact candidate dependencies

| Dependency | Version | Purpose |
| --- | --- | --- |
| Better Auth | 1.7.12 | Real email/password login, SQLite sessions, cookie/bearer/JWT plugins, JWKS, logout/revoke |
| Colyseus core / schema | 0.18.20 / 5.0.8 | Actual matchmaking, room lifecycle, HTTP router and synchronized revision |
| Colyseus SDK / WS transport | 0.18.5 / 0.18.4 | Actual client reservation, WebSocket join, ACK and reconnect |
| Hono / Node adapter | 4.13.13 / 2.1.5 | HTTP variant B |
| jose / ws | 6.2.13 / 8.22.0 | JWT validation and Node WebSocket headers |
| TypeScript | 5.8.3 | Strict compilation of the actual HTTP client |
| Playwright / esbuild | 1.55.1 / 0.25.12 | Isolated real Chromium and bundling the pinned real browser SDK |

These are selected candidate versions, not a claim about future releases or an adoption recommendation. The lockfile records exact transitive packages and integrity hashes.

## Real boundaries and fixture boundaries

`server.mjs` runs each HTTP candidate in a separate child process with an actual Better Auth SQLite database, random secret and JWT signing keys. Real library migrations create the auth tables. Accounts sign up/sign in over real HTTP. Private harness IPC assigns synthetic roles/character ownership, expires actual test sessions and terminates the fixture's sockets. These controls are not public HTTP endpoints.

`policy.mjs` is the sole role, seat, command and query implementation used by both HTTP variants and Colyseus. Fixture roles are host-admin/player/outsider. They do not implement the full GATE-01 owner/GM/invitation contract. The counter and command results are in memory; there is no claim of production transaction/durability parity. The separate GATE-04 fixture has its own SQLite transaction scope.

`api-client.ts` uses explicit runtime typeguards/decoders for CommandAck, Snapshot and ApiFailure. JSON is treated as unknown until validated, and HTTP success must agree with the result shape. Seven actual malformed HTTP responses test bad ACK fields, invalid snapshot counters, invalid error codes, truncated JSON and contradictory status/body. A valid structured denial remains usable. The compiled client then drives real load commands and queries. `openapi.json` is an explicit limited fixture document; automatic generation is NOT RUN.

`browser.mjs` bundles the installed real Colyseus SDK and launches a fresh nonpersistent Chromium context. Login is an ordinary browser fetch. Cookies and Origin are not injected into the positive flow. Its two public test-only asset paths (`/__poc/browser`, `/__poc/colyseus-browser.js`) serve a minimal test document and SDK only; they are separate from the six application OpenAPI paths. No user browser profile is reused. Auth credentials and actual seat/reconnect identifiers are never stored in evidence.

Actual outgoing Cookie/Origin/Fetch-Metadata evidence comes from Chromium `Network.requestWillBeSentExtraInfo`. Renderer-facing request header views can omit network-added headers and are not treated as proof of their absence.

## GATE-02: executed flows and failed credential objective

The combined candidate enables both Better Auth bearer and JWT plugins. A uses the real signed session cookie; B uses actual JWT-plugin output, EdDSA/JWKS verification and a signed session id (`sid`) that must still identify a current, unexpired database session belonging to the subject. The opaque bearer-plugin token is independently tested and is not confused with the JWT.

Both variants exercise real sign-in, HTTP whoami, unauthenticated join denial, logout and revoke-session, new-join and reconnect denial after revocation, active-socket closure within 2 seconds, valid reconnect with seat/room preservation and token rotation, GM/foreign-character/outsider denial, forged client roles, expired/tampered credentials and independent host/origin negatives. Active clients are rechecked every 250 ms. The measured deadline begins before the actual logout/revoke HTTP call. A signature-only canary proves that the unexpired revoked JWT still passes cryptographic validation; the current-session policy rejects it.

Initial join/create HTTP reservations authenticate through static onAuth. **The pinned Colyseus HTTP reconnect reservation itself uses the existing reconnect ticket and does not rerun onAuth.** With a valid ticket it can return reservation metadata without auth, including on a wrong-Origin HTTP request. That is not room access. The actual WebSocket upgrade checks Origin and binds the reserved seat to the exact current Better Auth user and login. Room reconnect and every application message check current auth/policy again. Another actor and a second login of the same actor are both denied ticket replay, after which the original login reconnects successfully. The binding relies on the pinned `reserveSeatFor` use of `authData.sessionId` and official `beforeUpgrade` hook; distributed/restart persistence is not demonstrated.

Better Auth cookies and JWTs are not put into URLs. Colyseus protocol seat/reconnection identifiers do use SDK URLs, and the additional actor/session binding is explicitly tested. The SDK `client.auth.token` path places `_authToken` in a socket URL; the fixture rejects that auth-token path. This distinction does not make protocol identifiers public or eliminate their sensitivity.

### Actual browser result

Chrome sets the signed HttpOnly/SameSite=Lax cookie automatically. `document.cookie` cannot read it. Real same-origin GET `/api/whoami` and a real browser Colyseus room join/command succeed. A foreign-origin command actually carries the ambient same-site cookie but receives HTTP 403 without a revision change. The foreign-origin socket attempt fails and the original session remains valid.

The browser also exposed a real bug in the original fixture: ordinary GET omits Origin and was incorrectly denied. The fix accepts absent Origin only for the safe HTTP whoami/snapshot actions with exact Host and browser Fetch Metadata `Sec-Fetch-Site: same-origin`. Missing/foreign metadata, explicit wrong Origin, writes and sockets do not gain that exception. The new actual-browser flow plus originless negative cases exercise the boundary.

**GATE-02 A/1 is FAIL.** Although the cookie is HttpOnly, sign-in JSON exposes a token and the bearer plugin exposes `set-auth-token` to page JavaScript. Chrome reads both and successfully authenticates with each bearer while explicitly omitting all cookies; the observed requests confirm no Cookie header was sent. Thus the combined A/B profile fails full credential isolation. The canary is an executed PASS observation of a failed security objective, and the criterion mapping explicitly preserves the objective FAIL. No unreviewed token-filter/proxy or complete cookie-only profile is supplied. Removing one plugin is not claimed sufficient; all reachable auth token/session responses require review for a separated candidate.

HTTPS Secure-cookie behavior, a secure browser JWT transport/store, other browser engines and Tauri remain NOT RUN. Browser B and future desktop work are not inferred from Node custom headers. The solo negative rejects `mode: solo` with `0.0.0.0` before opening a listener and denies forged local-identity headers/payloads; actual Tauri identity/bootstrap is not executed.

## GATE-03: shared HTTP/WS behavior and actual concurrency

A uses real Colyseus createRouter/createEndpoint routes. B mounts application HTTP through actual Hono and preserves Colyseus matchmaking/realtime. Better Auth's Node handler mounts before both. Each candidate shares one process, so Hono does not by itself provide process failure isolation.

A player's GM command has the identical `GM_REQUIRED` response over HTTP/WS with no revision change. Public health succeeds without credentials; unauthenticated commands fail. JSON null is rejected identically as HTTP 400 / `INVALID_PAYLOAD` on both HTTP adapters and over WS; it cannot create a revision.

For each candidate, 1 GM and 2 players issue 200 commands concurrently: 100 through the runtime-validated typed HTTP client and 100 through Colyseus request/ACK. Every unique ACK/revision is checked, each of three observers receives every delta exactly once, and final query state agrees. A deliberate caught HTTP 500 leaves the same room/seat connected and a subsequent command succeeds. This tests a caught request error, not a killed or stalled shared process.

The additional storm creates and drops 200 real sockets, starts all 200 reconnects, and launches 200 parallel real HTTP commands at the first observed reconnect handshake while the reconnect burst is still active. There is no artificial server delay. All 200 HTTP ACK ids/revisions and all 200 restored seats/roles are checked. Request intervals must overlap and real reconnect completions must occur while HTTP requests remain in flight. Historical observations record overlap duration and completion counts, including zero counts rather than inventing bidirectional interleaving. Reconnect latency includes its authenticated seat response. The workload reuses three signed-in identities; it is not a 200-account login/password-hashing storm.

No p95 SLO is invented: the spec asks for measurements and no lost ACKs. Single local measurements do not rank frameworks reliably or qualify production hardware, state sizes, TLS/proxies, distributed rooms, backpressure or long soak behavior.

### Application surface and layout notes

| Surface | Behavior |
| --- | --- |
| GET /health | Public health; exact Host still required |
| GET /api/whoami | Current identity; ordinary safe same-origin browser GET supported |
| GET /api/snapshot?sessionId=demo | Shared authorized query |
| POST /api/ping-session | Shared authorized command; strict Origin |
| POST /api/gm-command | Same command boundary with current host-admin role |
| GET /api/failure | Test-only caught exception, not a proposed product endpoint |
| /api/auth/* | Actual Better Auth endpoints and their distinct cookie/bearer/JWT surfaces |
| /matchmake/* and room socket | Actual Colyseus protocol with the initial/reconnect distinction above |

Future layout notes for a human-approved server architecture: auth/session resolution, one session application service, thin HTTP adapter and thin realtime adapter. The approved GATE-01 policy belongs behind their shared port. Neither transport should implement a second set of business rules. Exact line counts are recorded, but no product server tree or AGENTS.md is changed. Asset downloads, OAuth callbacks, automatic OpenAPI generation, product-wide client generation and production logging/metrics qualification remain NOT RUN.

## Findings retained for review

| Severity | Finding | State |
| --- | --- | --- |
| High | Real Chromium reads and replays authenticating sign-in/header tokens despite HttpOnly cookie storage in the combined A/B profile. | OPEN; mandatory GATE-02 A/1 and gate overall FAIL. |
| High | Unexpired JWT signatures survive logout/revocation. | Mitigated in fixture by current actual session lookup; signature-only canary executed. |
| High | A replayed reconnect ticket must be bound to the actual current peer/user/login at WS upgrade. | Mitigated for room access; another actor/session denied. Ticket-only HTTP reservation remains documented. |
| Medium | Browser GET without Origin was masked by Node-injected headers. | Fixed with narrowly scoped safe-read/Host/Fetch-Metadata check and actual Chromium regression. |
| Medium | Missing or changed historical observations were not checked by the first checker. | Fixed: required recorded file, report linkage, schema and measurement invariants checked. |
| Medium | Public TLS/proxies, production abuse limits, distributed lifecycle and complete owner/GM policy are unqualified. | NOT RUN; fixture rate limiting is disabled and state/seat maps are in memory. |
| Low | Synchronous Colyseus health handler caused HTTP 500 because the installed API requires a Promise. | Found by first full run; fixed and retested. |
| Low | Generic JSON cast supplied unverified TypeScript response types. | Replaced with explicit decoders; seven actual malformed-response negatives. |
| Low | JSON null produced inconsistent 403/500 responses between adapters. | Shared object guard and equal 400/INVALID_PAYLOAD; no side effects. |
| Info / tech-debt | Schema, route setup, seat binding and reconnect hooks depend on exact installed APIs. | Pins, source hashes and executable boundary probes; upgrades require rerunning. |
| Info / tech-debt | Explicit OpenAPI/client and minimal test assets do not prove product-wide generators/assets/callbacks. | NOT RUN. |

## Primary sources

- [Better Auth SQLite](https://better-auth.com/docs/adapters/sqlite), [migrations](https://better-auth.com/docs/concepts/database), [sessions](https://better-auth.com/docs/concepts/session-management), [bearer](https://better-auth.com/docs/plugins/bearer), [JWT/JWKS](https://better-auth.com/docs/plugins/jwt).
- [Colyseus auth](https://docs.colyseus.io/auth/room), [reconnection](https://docs.colyseus.io/room/reconnection), [server/router](https://docs.colyseus.io/server), [WS transport](https://docs.colyseus.io/server/transport/ws), [schema](https://docs.colyseus.io/state/schema).
- [Hono Node](https://hono.dev/docs/getting-started/nodejs), [Playwright browser](https://playwright.dev/docs/api/class-browser), [isolated browser contexts](https://playwright.dev/docs/api/class-browsercontext).
- [Chromium network request ExtraInfo](https://chromedevtools.github.io/devtools-protocol/tot/Network/#event-requestWillBeSentExtraInfo).

Installed source hashes identify the exact implementations actually exercised; the gate specifications remain the acceptance source. This is candidate evidence for a later human decision, with approval always NOT APPROVED.
