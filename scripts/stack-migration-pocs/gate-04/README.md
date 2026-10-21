# GATE-04: real SQLite transaction and recovery PoC

This isolated fixture executes the nine mandatory rows of
`.qa/design/gates/GATE-04-sqlite-revision-idempotency.md` against a file-backed
SQLite database. It does not import, replace, or deploy product code. The gate
remains **NOT APPROVED**. Production suitability still needs the gate review,
the auth/policy gate, and the per-command migration review.

## Run

```sh
node scripts/stack-migration-pocs/gate-04/check.mjs --check
```

`--check` runs the complete experiment again, including process termination. It
compares the deterministic outcome, workload ledger, and source hashes with the
committed `report.json`. It does not rewrite evidence. A failed mandatory test,
unsupported crash host, stale snapshot, or missing snapshot causes a nonzero exit.
The summary on stdout includes the current run's measured throughput.

After reviewing an intentional change, regenerate the evidence explicitly:

```sh
node scripts/stack-migration-pocs/gate-04/check.mjs --write
node scripts/stack-migration-pocs/gate-04/check.mjs --check
```

The scripts use only Node built-ins. They create synthetic databases in a new
temporary directory, spawn only their own child processes, and remove those
databases afterwards. They require Node **22.13 or later** with `node:sqlite`.
The API set was checked against Node 22.13 documentation; the recorded execution
used **Node 24.19.0 / SQLite 3.53.3 / Linux x64**. A Node 22 execution and the
Windows/macOS matrix are **NOT RUN**, not implied by API compatibility. Windows
does not satisfy the POSIX `SIGKILL` experiment and is reported as such.

## Files and evidence

| File | Purpose |
| --- | --- |
| `store.mjs` | Real SQLite schema, one atomic command transaction, scoped replay, fixture authorization and snapshot/catch-up query |
| `writer.mjs` | Dedicated process, serial IPC queue, post-commit reply/notification ordering and explicit fault checkpoints |
| `check.mjs` | Independent relational audit, concurrent clients, rollback tests, real process kills, WAL restart, negative control and evidence comparison |
| `.qa/evidence/stack-migration-prep/pocs/gate-04/report.json` | Deterministic test results, mandatory-row mapping, source SHA-256s, unexecuted scope and required contract decisions |
| `.qa/evidence/stack-migration-prep/pocs/gate-04/observations.json` | Timestamp, executed runtime/platform/kernel/CPU and non-deterministic timing observations from the last `--write` |

The deterministic report excludes elapsed time, host identity, and process IDs.
The load ledger includes a controlled fixture timestamp, so its digest is stable
across reruns. `observations.json` stores the digest of the deterministic report
to bind a measured run to its exact results. `--check` prints new measurements
without overwriting that original observation.

## Storage and command boundary

`session_runtime`, `session_events`, and `command_idempotency` are real `STRICT`
SQLite tables. `session_members` supplies the fixture authorization relation.
Every connection to the writer is configured and checked with:

```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=FULL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=250;
PRAGMA wal_autocheckpoint=0;
```

The command boundary is:

```js
applyCommand({
  sessionId: 'session-a',
  expectedRevision: 0,
  idempotencyKey: 'logical-command-key',
  op: { type: 'adjust', delta: 3, note: '' }
})
```

The `adjust` operation updates the fixture's `{value, applied, note}` state. It
tests storage semantics, not the fifteen SagaTree command kinds and their game
rules. `delta` is a safe integer from -100 to 100. `note` defaults to `''`.
Unknown command/operation fields, unsafe revisions, empty keys, keys above
128 UTF-8 bytes, and serialized state above 4096 bytes are rejected. The state
limit is also a SQLite `CHECK` constraint. A test covers the exact accepted
4096-byte boundary and both UTF-8 and JSON-overhead rejection.

Identity comes from a server-owned fixture token map. The payload cannot select
an actor or owner. Missing/invalid credentials, readers, nonmembers, and forged
actor fields fail before a write transaction starts. Membership is checked again
inside the transaction and **before** the stored-result lookup. Revoked actors
cannot replay results. Missing sessions and inaccessible sessions produce the
same `FORBIDDEN` response to authenticated actors.

The one writer process serializes requests on its queue. Within
`BEGIN IMMEDIATE` it checks `(session_id, idempotency_key)`, actor and operation
fingerprint, checks the expected revision, and writes all four effects:

1. State and `updated_at`.
2. Exactly one revision increment.
3. Exactly one append-only event at that revision and sequence.
4. The original canonical success JSON plus actor and payload hash.

All four are committed together. An event's sequence equals its command revision
in this fixture; this is not a claim that every event in the product has that
mapping. Idempotency has a composite primary key, so two sessions can use the
same key independently. Payload normalization sorts JSON keys and supplies the
documented default. `expectedRevision` is retry metadata and is excluded from the
operation fingerprint: the same logical command can recover its original result
even after later commands have advanced the session.

The internal IPC envelope includes `committed` for test instrumentation; the
canonical application `resultJson` is byte-identical on replay. The result
contains session ID, revision, event sequence, and state. A new commit sends its
reply only after `COMMIT`, followed by its notification. Replays send the stored
result and do not create another event or notification.

### Busy and retry policy

SQLite lock waiting is bounded by `busy_timeout=250` milliseconds. The PoC makes
**zero automatic database retries**. If `BEGIN IMMEDIATE` encounters a competing
writer until timeout, it returns `DATABASE_BUSY` with no persisted changes. The
negative test holds a real write lock on a second connection, observes this
failure, releases the lock, and retries the same logical key successfully.

Revision conflicts return `STALE_REVISION` with expected and actual revisions.
The load test obtains a fresh snapshot before retrying. It never silently applies
a stale command. After an ambiguous transport/process failure, the client repeats
the same session, actor, key, and operation; an already committed command replays
its saved result. A new key would be a new command and is not the recovery policy.
Queue length, cancellation, admission control and production retry budgets are
outside this isolated experiment.

## Executed coverage

The deterministic `report.json` contains the complete case-to-gate mapping and
observed counts. The first recorded run passed all **9 mandatory rows** and all
**18 executable cases**.

| Gate row | Evidence |
| --- | --- |
| 1 | One command produces revision 1, apply count 1, one event, one idempotency result |
| 2 | Stale and future revisions preserve every state/event/idempotency row |
| 3 | Original result remains stable after a later commit; changed actor/payload and revoked membership are denied; 20 concurrent duplicates commit once |
| 4 | Five concurrently outstanding conflicting commands produce exactly one winner and four conflicts |
| 5 | Real writer `SIGKILL` after BEGIN, after state write, before COMMIT, after COMMIT, and after reply/before notification |
| 6 | A separate reader keeps its old WAL snapshot while the writer commits; pinned-reader checkpoint reports busy; release allows truncation, restart and exact snapshot equality |
| 7 | 20 logical clients × 50 commands, stale/current/future initial revisions, 1000 final commits, 950 conflicts, 950 explicit resync retries, 1950 write attempts, zero missing keys/events/results |
| 8 | Mid-transaction failures after event and idempotency writes roll back all effects; every successful revision has exactly one matching event/result; crash canary detects deliberate split atomicity |
| 9 | The same actor and same key succeed independently in two sessions; a private third session cannot leak its result or snapshot |

The 20 clients are concurrent logical clients in one coordinator process sending
asynchronous IPC requests to a separate writer process. Every round begins with
20 outstanding write requests. Explicit resync retries use a controlled
round-robin order to make the result reproducible. This is not 20 separate client
machines, a socket benchmark, or a sustained production saturation test.

The audit reads persisted tables and verifies contiguous revisions/sequences,
exact counts, per-key/per-actor matching, operation fingerprints, saved results,
state hashes, final state, SQLite integrity, and foreign keys. The load workload
is also checked against a separately generated 1000-key ledger, including every
actor, delta, and note. Twenty original commands are replayed after the full load
and must return their original result bytes without changing the database.

### Crash checkpoints and notification loss

The writer sends an IPC checkpoint only after reaching the named SQL/transport
boundary and then stops processing its queue until killed. The coordinator sends
`SIGKILL` to that exact child and verifies the exit signal. It does not close the
database gracefully before the kill.

Before-commit checkpoints must recover revision 0 with no event or stored result.
After-commit checkpoints must recover revision 1, one event and one result from
the nonempty WAL. Both paths converge to exactly one committed command after
retry. At `before-broadcast`, the success reply was received but the notification
was not. A restarted connection obtains the durable event with a sequence cursor;
advancing the cursor produces zero duplicates.

This proves durable catch-up for the fixture. It does not prove an atomic
subscribe/catch-up handshake, realtime delivery guarantees, event retention, or
backpressure in the successor application.

### Negative control

Only the canary fixture enables `brokenSplitCommit`: state/revision is committed
before event/idempotency insertion. The process is killed immediately after that
early commit. The recovered database intentionally contains revision 1 with zero
events and zero stored results. The ordinary audit must detect:

- `event-count-does-not-match-revision`
- `idempotency-count-does-not-match-revision`
- `runtime-does-not-match-committed-events`

The canary passes only when the broken implementation is detected. Its success
does not mark the corrupted fixture as correct. The temporary canary database is
removed with all other synthetic databases.

## Measured boundary and remaining gate decisions

The measured timing is recorded in `observations.json`, not hardcoded as an SLA.
The initial run committed 1000 commands in approximately 1.06 seconds, about
944 commits/second including deliberate conflicts and resync. Shared execution
host load and temporary filesystem behavior can change these numbers materially.

**Single-writer production sufficiency is NOT RUN / needs human decision.**
The gate does not specify target state sizes, session mix, hardware, minimum
throughput, latency percentile, acceptable queueing, or duration. Passing the
required 20×50 experiment supports this local workload; it cannot establish the
unspecified target. No ADR, migration unblock, Postgres removal, or APPROVED
status follows from this result.

| Severity | Remaining boundary or contract decision |
| --- | --- |
| High | Exact current RPC replay behavior differs: the effective `051_session_director_runtime.sql` accepts an optional key, does not bind it to actor/payload, and returns the current snapshot on replay. This PoC intentionally tests the stronger requested target contract; migration parity is not established. |
| High | Real policy/OIDC authorization and all fifteen gameplay command kinds are not implemented or compared against a live backend. |
| Medium | Hardware/OS power loss, disk-full, fsync failure, corruption, sustained overload and production backpressure have not been exercised. `SIGKILL` is a process-crash test. |
| Medium | The reconnect query is transactionally consistent, but the production subscribe/catch-up protocol and event-retention policy require separate evidence. |
| Low | Node 22.13 API compatibility is documentation-checked; only the runtime/platform listed in observations was executed. Node's SQLite API is experimental in the referenced Node 22 release. |
| Info | Fixed timestamps, fixture credentials, a bounded counter state, and deterministic client rounds are reproducibility controls, not production implementations. |

## Primary API and engine references

- [Node 22.13 SQLite API](https://nodejs.org/download/release/v22.13.0/docs/api/sqlite.html): `DatabaseSync`, `exec`, `prepare`, bound `run/get/all`, and `close`.
- [SQLite transactions](https://www.sqlite.org/lang_transaction.html): one simultaneous writer, `BEGIN IMMEDIATE`, rollback and busy behavior.
- [SQLite WAL](https://www.sqlite.org/wal.html): readers, writer, checkpoint behavior and recovery assumptions.
- [SQLite busy_timeout](https://www.sqlite.org/pragma.html#pragma_busy_timeout): connection lock-wait budget.
- [SQLite synchronous](https://www.sqlite.org/pragma.html#pragma_synchronous): FULL durability setting and its dependence on the operating/storage environment.

Repository reference hashes are embedded in `report.json`. They bind this PoC to
the reviewed specification and branch source; they do not attest a live backend.

## Additional CI-runtime execution — 2026-10-21

The same frozen Gate-04 scripts were subsequently executed with official Node v22.23.3 and SQLite 3.51.3 on Linux x64. All nine mandatory rows and all 18 cases passed again, including 1000 committed logical commands. The versioned runtime archive was checked against its published SHA-256. The separate `node22-compatibility.json` in the evidence directory records the command, result and matching source fingerprints. This adds a real Node-22 execution to the earlier Node-24 observations; other operating systems and production workloads remain untested. Architecture approval remains NOT APPROVED.
