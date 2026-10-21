# GATE-04 executed evidence

**Executed fixture: PASS. Technology decision: APPROVED — implementation freigabe only (ADR-ST-08, 2026-10-21). Production capacity/cutover: NOT RUN.**

The reproducible entry point and full method/limits are documented in
[`scripts/stack-migration-pocs/gate-04/README.md`](../../../../../scripts/stack-migration-pocs/gate-04/README.md).

```sh
node scripts/stack-migration-pocs/gate-04/check.mjs --check
```

`report.json` records all 9 mandatory rows and 18 executed cases, the exact
source SHA-256s, and explicit NOT RUN boundaries. It is deterministic.
`observations.json` records the platform/runtime and measured timings of the
persisted `--write` run and binds those observations to the report's SHA-256.

Both the initial `--write` and the following independent `--check` execution
passed. The check reran the real SQLite workload and crash tests; it did not
merely validate JSON syntax or compare a prebuilt simulation.

| Observed result | Value |
| --- | --- |
| Runtime | Node 24.19.0, SQLite 3.53.3 |
| Executed platform | Linux x64, kernel 6.18.55 |
| Load | 20 concurrent logical clients × 50 commands |
| Logical commands committed | 1000 |
| Stale/current/future first-attempt mix | 950 conflicts; each resolved by an explicit snapshot resync and retry |
| Total write attempts in load | 1950 |
| Final revision / events / idempotency results | 1000 / 1000 / 1000 |
| Missing commits | 0 |
| Persisted run throughput | 943.795 committed commands/s |
| Following check throughput | 768.830 committed commands/s |
| Hard crash boundaries | After BEGIN, after state write, before COMMIT, after COMMIT, after reply/before notification |
| Crash signal verified | SIGKILL, each terminated writer spawned by this fixture |
| Negative control | Deliberate early state commit detected as 3 invariant violations after SIGKILL |
| Busy policy | 250 ms SQLite busy timeout; no automatic retry |

The throughput values are observations on a shared local execution host. The
varying measurements are excluded from deterministic equality and are not an SLA.

## What still requires a decision or further evidence

- The PoC uses the requested **stronger target replay contract**: required key,
  actor/payload binding, original stable result. The current SQL function accepts
  an optional key and returns the latest snapshot on a session/key replay.
  Product migration must resolve this explicit behavior change.
- Synthetic server-owned tokens and membership rows exercise auth denial and
  revocation, but do not prove OIDC, complete policy parity, or all 15 gameplay
  commands against a live Postgres backend.
- The tested counter state and controlled load do not determine whether a single
  writer meets the unspecified production size, hardware, session-mix and latency
  targets. That gate decision is **NOT RUN / needs human review**.
- SIGKILL verifies process recovery, not host power loss, kernel failure, disk
  exhaustion, faulty fsync or storage durability.
- Transactional cursor catch-up recovers a lost notification in this fixture.
  Production realtime subscription/catch-up, retention and backpressure require
  their own integration evidence.
- Node 22.13 API compatibility was checked against primary documentation. An
  execution on Node 22 and other operating systems/filesystems is **NOT RUN**.

Fixture `report.approval` stays NOT APPROVED; human ADR-ST-08 is the architecture decision. This evidence package does not claim production cutover.

## Additional CI-runtime execution — 2026-10-21

The same frozen Gate-04 scripts were subsequently executed with official Node v22.23.3 and SQLite 3.51.3 on Linux x64. All nine mandatory rows and all 18 cases passed again, including 1000 committed logical commands. The versioned runtime archive was checked against its published SHA-256. The separate `node22-compatibility.json` in the evidence directory records the command, result and matching source fingerprints. This adds a real Node-22 execution to the earlier Node-24 observations; other operating systems and production workloads remain untested. Architecture freigabe is recorded in ADR-ST-08 (implementation only); fixture report.approval remains NOT APPROVED by design.
