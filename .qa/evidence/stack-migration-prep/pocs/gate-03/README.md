# GATE-03 — real Colyseus HTTP / Hono comparison

**Result: PASS for the isolated acceptance rows and concurrency probe; 10 cases PASS, 0 FAIL. Approval: NOT APPROVED.** This is measured candidate evidence, not a production framework choice. GATE-02 has a separate mandatory credential-isolation FAIL; this transport comparison does not resolve it.

The [report](report.json) contains per-variant assertions, exact dependencies and source hashes. [Observations](observations.json) contain the measured samples. The [fixture README](../../../../../scripts/stack-migration-pocs/gate-02-03/README.md) documents reproduction, full findings, source references and limitations.

## Acceptance evidence

| Row | Both real candidates |
| --- | --- |
| 1 | Shared current policy, identical HTTP/WS `GM_REQUIRED` denial, no unauthorized revision changes, public health versus authenticated command, and equal 400/`INVALID_PAYLOAD` for JSON null |
| 2 | Explicit six-path OpenAPI, strict typed-client compilation, actual runtime decoders and seven real malformed-response negatives; the client drives live load |
| 3 | 200 concurrent commands from 1 GM and 2 players, 200 unique ACK revisions, every observer receives all 200 deltas, final query state agrees |
| 4 | A caught HTTP 500 leaves the same room/seat connected and another WS command succeeds |
| 5 | Exact source sizes and one policy/business implementation, with auth/session/HTTP/realtime layout notes |

A uses actual Colyseus createRouter/createEndpoint; B uses actual Hono 4.13.13 / Node adapter 2.1.5 while preserving Colyseus matchmaking/realtime. Both run real Better Auth 1.7.12 and Colyseus core 0.18.20 with one shared application implementation. Each candidate is one process.

## Actual overlapping load

Each original storm mixes 100 HTTP and 100 WS commands. The additional probe creates and drops 200 actual sockets, starts all reconnects, then starts 200 parallel real HTTP commands at the first observed reconnect handshake while the burst remains active. It uses no artificial server delay. The checker verifies overlapping measured request intervals, real reconnect completions during in-flight HTTP requests, all 200 HTTP ACK ids and contiguous revisions, and all 200 restored room seats and roles. Reconnect latency includes the authenticated seat response. The same three signed-in users carry the sockets; this is not a 200-account login storm.

Recorded platform: **Node 24.19.0, SQLite 3.53.3, Linux x64 kernel 6.18.55**.

| Workload | Samples | p50 | p95 | p99 | Errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| Colyseus: original 200-command storm | 200 | 143.129 ms | 291.848 ms | 312.344 ms | 0% |
| Hono: original 200-command storm | 200 | 197.468 ms | 374.253 ms | 386.487 ms | 0% |
| Colyseus: 200 reconnects under HTTP load | 200 | 1061.881 ms | 1069.553 ms | 1070.021 ms | 0% |
| Hono: 200 reconnects under HTTP load | 200 | 756.607 ms | 1052.741 ms | 1068.590 ms | 0% |
| Colyseus: simultaneous 200 HTTP commands | 200 | 514.014 ms | 535.902 ms | 537.279 ms | 0% |
| Hono: simultaneous 200 HTTP commands | 200 | 243.266 ms | 259.301 ms | 260.368 ms | 0% |

| Candidate | Observed interval overlap | Reconnect completions while HTTP active | HTTP ACKs while reconnects active |
| --- | ---: | ---: | ---: |
| Colyseus | 547.675 ms | 20 | 200 |
| Hono | 274.788 ms | 6 | 200 |

Both original storms retain 200 ACKs and 600 observer deliveries. Both additional storms retain 200 reconnects and 200 more HTTP ACKs with zero unauthorized or lost revisions. The specification gives no p95 SLO; measurements and no lost ACKs are the stated criterion. These single local observations do not rank frameworks reliably or qualify production capacity.

## Review fixes and remaining limits

The real tests found and fixed a synchronous Colyseus health handler that caused HTTP 500, unchecked JSON response casts, inconsistent null-payload handling, a normal-browser GET Origin mismatch and missing historical-observation validation. The runtime decoder rejects seven actual malformed HTTP responses, including contradictory HTTP status/body. Saved observations are required and validated against the report hash, runtime/schema, counts, percentile ordering and concurrency/deadline invariants; fresh timing values are printed rather than silently presenting only historical data.

The HTTP failure test covers a caught request exception. It does not kill or stall the shared process, and Hono provides no separate-process isolation here. Full owner/GM policy, production logging/metrics, backpressure, lifecycle recovery, public TLS/proxies, distributed rooms, large state and soak tests remain **NOT RUN**. Automatic OpenAPI/client generation, asset downloads and OAuth callbacks are also NOT RUN. High/Medium/Low/Info findings are retained in the complete fixture README; notably GATE-02's actual Chromium token-exposure finding remains open and blocks its credential objective.

## Reproduce

```sh
npm ci --prefix scripts/stack-migration-pocs/gate-02-03 --ignore-scripts --no-audit --no-fund
node scripts/stack-migration-pocs/gate-02-03/node_modules/playwright/cli.js install --with-deps chromium
node scripts/stack-migration-pocs/gate-02-03/check.mjs --check
```

The strict command runs both gates, prints fresh measurements, and **returns nonzero because GATE-02 A/1 is FAIL**, even when GATE-03 and all execution assertions pass. The deliberately separate `--check-execution` checks reproducible execution/evidence without claiming the failed goal passed. All reports retain NOT APPROVED. See the shared README for browser selection and full CLI semantics.
