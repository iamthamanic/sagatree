import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir, platform, arch, release, cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';
import { POLICY, seed, inspect, digest, canonical } from './store.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const evidence = join(repo, '.qa/evidence/stack-migration-prep/pocs/gate-04');
const mode = process.argv[2] ?? '--check';
if (!['--check', '--write'].includes(mode) || process.argv.length > 3) throw new Error('Usage: node scripts/stack-migration-pocs/gate-04/check.mjs [--check|--write]');
const version = process.versions.node.split('.').map(Number);
if (version[0] < 22 || (version[0] === 22 && version[1] < 13)) throw new Error('This PoC requires Node >=22.13 with node:sqlite; no dependency is installed automatically.');

const activeWriters = new Set();
const transient = await mkdtemp(join(tmpdir(), 'sagatree-gate-04-'));
const tokens = { 'fixture-alice': 'alice', 'fixture-bob': 'bob', 'fixture-reader': 'reader', 'fixture-outsider': 'outsider' };
const cases = [];
const measurements = {};
let fixtureCount = 0;
let engine;

class Writer {
  constructor() {
    this.child = fork(join(here, 'writer.mjs'), [], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], execArgv: [] });
    this.pending = new Map();
    this.points = new Map();
    this.replies = new Map();
    this.broadcasts = [];
    this.nextId = 1;
    this.peakPending = 0;
    this.stderr = '';
    this.child.stderr.on('data', (chunk) => { this.stderr += chunk; });
    this.child.stdout.on('data', () => {});
    this.exited = new Promise((resolveExit) => {
      this.child.once('exit', (code, signal) => {
        this.exitResult = { code, signal };
        for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(new Error(`WRITER_EXIT:${code}:${signal}`)); }
        this.pending.clear();
        activeWriters.delete(this);
        resolveExit(this.exitResult);
      });
    });
    this.child.on('message', (message) => {
      if (message.type === 'broadcast') { this.broadcasts.push(message); return; }
      if (message.type === 'checkpoint') { this.points.get(message.id)?.resolve(message); return; }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.type === 'fatal') pending.reject(new Error(message.error));
      else { this.replies.set(message.id, message.value); pending.resolve(message.value); }
    });
    activeWriters.add(this);
  }

  start(type, args = {}) {
    const id = this.nextId++;
    let pointTimer;
    const checkpoint = new Promise((resolvePoint, reject) => {
      if (args.pauseAt) pointTimer = setTimeout(() => reject(new Error(`Checkpoint timeout: ${args.pauseAt}`)), 10000);
      this.points.set(id, { resolve: (message) => { clearTimeout(pointTimer); resolvePoint(message); } });
    });
    const promise = new Promise((resolveReply, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Writer timeout: ${type}`)); }, 10000);
      this.pending.set(id, { resolve: resolveReply, reject, timer });
      this.peakPending = Math.max(this.peakPending, this.pending.size);
      this.child.send({ id, type, ...args }, (error) => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
      });
    });
    // Crash requests may intentionally never reply; attach immediately to avoid unhandled rejection.
    promise.catch(() => {});
    checkpoint.catch(() => {});
    return { id, promise, checkpoint };
  }

  request(type, args) { return this.start(type, args).promise; }
  apply(command, token = 'fixture-alice', extra = {}) { return this.request('apply', { token, command, ...extra }); }
  reconnect(sessionId, afterSequence = 0, token = 'fixture-alice') { return this.request('reconnect', { token, sessionId, afterSequence }); }
  async close() {
    if (this.exitResult) return;
    await this.request('close');
    assert.deepEqual(await this.exited, { code: 0, signal: null });
  }
  async kill() {
    if (!this.exitResult) this.child.kill('SIGKILL');
    return this.exited;
  }
}

async function writer(path, fixtureTokens = tokens, options = {}) {
  const instance = new Writer();
  const config = await instance.request('init', { path, tokens: fixtureTokens, options });
  assert.equal(config.journalMode, 'wal');
  assert.equal(config.synchronous, 2);
  assert.equal(config.busyTimeoutMs, POLICY.busyTimeoutMs);
  assert.equal(config.walAutocheckpoint, 0);
  engine = config.sqlite;
  return instance;
}

async function fixture(sessions = [{ id: 'session-a', writers: ['alice', 'bob'], readers: ['reader'] }], fixtureTokens = tokens, options) {
  const path = join(transient, `fixture-${++fixtureCount}.sqlite`);
  seed(path, sessions);
  return { path, worker: await writer(path, fixtureTokens, options) };
}

const command = (key, revision, delta = 1, sessionId = 'session-a', note = '') => ({ sessionId, expectedRevision: revision, idempotencyKey: key, op: { type: 'adjust', delta, note } });
function ok(response) { assert.equal(response.ok, true, canonical(response)); return JSON.parse(response.resultJson); }
function errorCode(response, code) { assert.deepEqual(response, { ok: false, error: { code } }); }

function auditViolations(snapshot) {
  const issues = [];
  const { runtime, events, idempotency } = snapshot;
  if (!runtime) return ['runtime-missing'];
  const state = JSON.parse(runtime.state_json);
  if (events.length !== runtime.revision) issues.push('event-count-does-not-match-revision');
  if (idempotency.length !== runtime.revision) issues.push('idempotency-count-does-not-match-revision');
  if (state.applied !== runtime.revision) issues.push('state-apply-count-does-not-match-revision');
  const results = new Map(idempotency.map((row) => [row.idempotency_key, row]));
  let folded = { value: 0, applied: 0, note: '' };
  for (const [index, event] of events.entries()) {
    if (event.event_sequence !== index + 1 || event.revision !== index + 1) issues.push('noncontiguous-event-revision');
    const idempotent = results.get(event.idempotency_key);
    if (!idempotent) { issues.push('event-without-idempotency'); continue; }
    const payload = JSON.parse(event.payload_json);
    const result = JSON.parse(idempotent.result_json);
    folded = { value: folded.value + payload.op.delta, applied: folded.applied + 1, note: payload.op.note };
    if (canonical(result.state) !== canonical(folded)) issues.push('saved-result-does-not-match-event-fold');
    if (result.revision !== event.revision || result.eventSequence !== event.event_sequence || result.sessionId !== runtime.session_id) issues.push('result-identifiers-do-not-match-event');
    if (event.actor_user_id !== idempotent.actor_user_id) issues.push('actor-binding-mismatch');
    if (idempotent.payload_hash !== digest({ version: 1, op: payload.op })) issues.push('payload-binding-mismatch');
    if (payload.stateHash !== digest(canonical(result.state))) issues.push('event-state-hash-mismatch');
  }
  if (canonical(folded) !== canonical(state)) issues.push('runtime-does-not-match-committed-events');
  if (canonical(snapshot.integrity) !== canonical([{ integrity_check: 'ok' }])) issues.push('sqlite-integrity-failed');
  if (snapshot.foreignKeys.length) issues.push('foreign-key-violation');
  return [...new Set(issues)];
}

function audit(path, sessionId = 'session-a') {
  const snapshot = inspect(path, sessionId);
  assert.deepEqual(auditViolations(snapshot), []);
  return snapshot;
}

async function runCase(id, title, execute) {
  const before = new Set(activeWriters);
  try { cases.push({ id, title, status: 'PASS', evidence: await execute() }); }
  catch (error) {
    cases.push({ id, title, status: 'FAIL', error: String(error.message).split(transient).join('<temporary-directory>') });
    process.stderr.write(`${id} FAIL: ${error.message}\n`);
  } finally {
    for (const instance of activeWriters) if (!before.has(instance)) await instance.kill();
  }
}

try {
  await runCase('R1', 'Atomic happy path increments revision exactly once', async () => {
    const { path, worker } = await fixture();
    const result = ok(await worker.apply(command('happy', 0, 3)));
    assert.deepEqual(result, { sessionId: 'session-a', revision: 1, eventSequence: 1, state: { value: 3, applied: 1, note: '' } });
    const data = audit(path);
    assert.equal(data.runtime.revision, 1);
    await worker.close();
    return { revision: 1, value: 3, events: 1, idempotency: 1 };
  });

  await runCase('R2', 'Stale and future revisions leave every persisted row unchanged', async () => {
    const { path, worker } = await fixture();
    ok(await worker.apply(command('initial', 0)));
    const before = inspect(path, 'session-a');
    for (const expected of [0, 99]) {
      assert.deepEqual(await worker.apply(command(`conflict-${expected}`, expected)), { ok: false, error: { code: 'STALE_REVISION', expected, actual: 1 } });
      assert.deepEqual(inspect(path, 'session-a'), before);
    }
    await worker.close();
    return { conflicts: 2, persistedChangesFromConflicts: 0 };
  });

  await runCase('R3', 'Stored replay is stable and bound to authenticated actor plus canonical operation', async () => {
    const { path, worker } = await fixture();
    const first = await worker.apply(command('original', 0, 3));
    ok(first);
    ok(await worker.apply(command('later', 1, 7)));
    const before = inspect(path, 'session-a');
    const replay = await worker.apply({ op: { note: '', delta: 3, type: 'adjust' }, idempotencyKey: 'original', expectedRevision: 999, sessionId: 'session-a' });
    assert.equal(replay.resultJson, first.resultJson);
    assert.equal(replay.committed, false);
    assert.equal(ok(replay).revision, 1);
    errorCode(await worker.apply(command('original', 0, 4)), 'IDEMPOTENCY_MISMATCH');
    errorCode(await worker.apply(command('original', 0, 3), 'fixture-bob'), 'IDEMPOTENCY_MISMATCH');
    assert.deepEqual(inspect(path, 'session-a'), before);
    await worker.request('revoke', { sessionId: 'session-a', actor: 'alice' });
    errorCode(await worker.apply(command('original', 0, 3)), 'FORBIDDEN');
    assert.deepEqual(inspect(path, 'session-a'), before);
    await worker.close();
    return { savedReplayRevision: 1, currentRevision: 2, changedPayloadDenied: true, changedActorDenied: true, revokedActorReplayDenied: true, canonicalPropertyOrderStable: true };
  });

  await runCase('R4', 'Five concurrent conflicting clients produce exactly one winner', async () => {
    const { path, worker } = await fixture();
    const responses = await Promise.all(Array.from({ length: 5 }, (_, i) => worker.apply(command(`race-${i}`, 0, i + 1))));
    assert.equal(responses.filter((r) => r.ok).length, 1);
    assert.equal(responses.filter((r) => r.error?.code === 'STALE_REVISION').length, 4);
    const data = audit(path);
    assert.equal(data.runtime.revision, 1);
    assert.equal(worker.peakPending, 5);
    await worker.close();
    return { clients: 5, winners: 1, conflicts: 4, events: 1, peakOutstandingRequests: 5 };
  });

  await runCase('N-concurrent-replay', 'Twenty simultaneous deliveries of one key commit once', async () => {
    const { path, worker } = await fixture();
    const responses = await Promise.all(Array.from({ length: 20 }, () => worker.apply(command('same-key', 0, 8))));
    responses.forEach(ok);
    assert.equal(responses.filter((r) => r.committed).length, 1);
    assert.equal(new Set(responses.map((r) => r.resultJson)).size, 1);
    assert.equal(audit(path).runtime.revision, 1);
    await worker.close();
    return { deliveries: 20, commits: 1, stableResults: 20 };
  });

  const crashPhases = ['after-begin', 'after-state-write', 'before-commit', 'after-commit', 'before-broadcast'];
  for (const phase of crashPhases) {
    const id = `R5-${phase}`;
    if (platform() === 'win32') { cases.push({ id, title: `SIGKILL at ${phase}`, status: 'NOT RUN', reason: 'POSIX SIGKILL semantics require a Unix test host.' }); continue; }
    await runCase(id, `Real SIGKILL at ${phase}, reopen, retry and reconnect`, async () => {
      const { path, worker } = await fixture();
      const original = command(`crash-${phase}`, 0, 11);
      const ticket = worker.start('apply', { token: 'fixture-alice', command: original, pauseAt: phase });
      const point = await ticket.checkpoint;
      assert.equal(point.phase, phase);
      const committedBeforeKill = ['after-commit', 'before-broadcast'].includes(phase);
      const repliedBeforeKill = worker.replies.has(ticket.id);
      assert.equal(repliedBeforeKill, phase === 'before-broadcast');
      assert.equal(worker.broadcasts.length, 0);
      const beforeKill = audit(path);
      assert.equal(beforeKill.runtime.revision, committedBeforeKill ? 1 : 0);
      const walBytes = (await stat(`${path}-wal`)).size;
      if (committedBeforeKill) assert.ok(walBytes > 0, 'Committed data must be in a nonempty WAL before kill.');
      assert.deepEqual(await worker.kill(), { code: null, signal: 'SIGKILL' });
      await ticket.promise.catch(() => undefined);
      const recovered = audit(path);
      assert.deepEqual(recovered, beforeKill);
      const replacement = await writer(path);
      const retry = await replacement.apply(original);
      assert.equal(ok(retry).revision, 1);
      assert.equal(retry.committed, !committedBeforeKill);
      if (committedBeforeKill) assert.equal(retry.resultJson, recovered.idempotency[0].result_json);
      const reconnected = await replacement.reconnect('session-a');
      assert.equal(reconnected.snapshot.revision, 1);
      assert.equal(reconnected.events.length, 1);
      assert.equal((await replacement.reconnect('session-a', 1)).events.length, 0);
      assert.equal(audit(path).runtime.revision, 1);
      await replacement.close();
      return { signal: 'SIGKILL', revisionBeforeRetry: committedBeforeKill ? 1 : 0, responseReceivedBeforeKill: repliedBeforeKill, broadcastsBeforeKill: 0, revisionAfterRetry: 1, eventsAfterRetry: 1, idempotencyAfterRetry: 1, recoveredEventsAfterCursor: 1, duplicateEventsAfterCursorAdvance: 0 };
    });
  }

  await runCase('R6', 'WAL readers, checkpoint busy state, truncation and restart preserve the snapshot', async () => {
    const { path, worker } = await fixture();
    const reader = new DatabaseSync(path, { readOnly: true });
    try {
      reader.exec('BEGIN');
      assert.equal(reader.prepare('SELECT revision FROM session_runtime').get().revision, 0);
      for (let i = 0; i < 5; i++) ok(await worker.apply(command(`wal-${i}`, i, i + 1)));
      assert.equal(reader.prepare('SELECT revision FROM session_runtime').get().revision, 0);
      const blockedCheckpoint = await worker.request('checkpoint');
      assert.equal(blockedCheckpoint.busy, 1);
      reader.exec('COMMIT');
      assert.equal(reader.prepare('SELECT revision FROM session_runtime').get().revision, 5);
    } finally { reader.close(); }
    const before = audit(path);
    const checkpoint = await worker.request('checkpoint');
    assert.equal(checkpoint.busy, 0);
    assert.equal((await stat(`${path}-wal`)).size, 0);
    await worker.close();
    const replacement = await writer(path);
    assert.deepEqual(audit(path), before);
    const reconnect = await replacement.reconnect('session-a', 2);
    assert.deepEqual(reconnect.events.map((event) => event.event_sequence), [3, 4, 5]);
    assert.equal(reconnect.snapshot.revision, 5);
    ok(await replacement.apply(command('after-restart', 5, -2)));
    assert.equal(audit(path).runtime.revision, 6);
    await replacement.close();
    return { readerSnapshotRevisionDuringWrites: 0, committedRevisionDuringReader: 5, pinnedReaderCheckpointBusy: 1, releasedReaderCheckpointBusy: 0, truncatedWalBytes: 0, restartSnapshotIdentical: true, reconnectEventSequences: [3, 4, 5], nextRevisionAfterRestart: 6 };
  });

  await runCase('R7', '20 clients × 50 logical commands with stale/current/future revisions lose zero commits', async () => {
    const clients = Array.from({ length: 20 }, (_, index) => ({ id: `client-${index}`, token: `fixture-client-${index}` }));
    const loadTokens = Object.fromEntries(clients.map((client) => [client.token, client.id]));
    const { path, worker } = await fixture([{ id: 'load', writers: clients.map((client) => client.id) }], loadTokens);
    const ledger = new Map();
    const savedResults = new Map();
    const latencies = [];
    let conflicts = 0;
    const started = performance.now();
    for (let round = 0; round < 50; round++) {
      const base = round * 20;
      const commands = clients.map((client, index) => {
        const expected = index === 0 ? base : index % 3 === 0 ? base + 10000 : index % 3 === 1 ? base : Math.max(0, base - 1);
        const value = command(`${client.id}/command-${round}`, expected, (index % 5) - 2, 'load', `round-${round}-client-${index}`);
        ledger.set(value.idempotencyKey, { actor: client.id, delta: value.op.delta, note: value.op.note });
        return value;
      });
      const starts = commands.map(() => performance.now());
      const responses = await Promise.all(commands.map((value, index) => worker.apply(value, clients[index].token)));
      assert.equal(responses.filter((response) => response.ok).length, 1);
      for (const [index, response] of responses.entries()) {
        let accepted = response;
        if (!response.ok) {
          assert.equal(response.error.code, 'STALE_REVISION');
          conflicts++;
          // Retry only after explicit resync. Round-robin retry order is deliberate and deterministic.
          const fresh = await worker.reconnect('load', response.error.actual, clients[index].token);
          accepted = await worker.apply({ ...commands[index], expectedRevision: fresh.snapshot.revision }, clients[index].token);
        }
        ok(accepted);
        savedResults.set(commands[index].idempotencyKey, accepted.resultJson);
        latencies.push(performance.now() - starts[index]);
      }
    }
    const elapsedMs = performance.now() - started;
    const data = audit(path, 'load');
    assert.equal(conflicts, 950);
    assert.equal(data.runtime.revision, 1000);
    assert.equal(data.events.length, 1000);
    assert.equal(data.idempotency.length, 1000);
    assert.equal(worker.peakPending, 20);
    assert.deepEqual([...data.idempotency.map((row) => row.idempotency_key)].sort(), [...ledger.keys()].sort());
    for (const event of data.events) {
      const expected = ledger.get(event.idempotency_key);
      const payload = JSON.parse(event.payload_json);
      assert.equal(event.actor_user_id, expected.actor);
      assert.equal(payload.op.delta, expected.delta);
      assert.equal(payload.op.note, expected.note);
    }
    assert.equal(JSON.parse(data.runtime.state_json).value, [...ledger.values()].reduce((sum, entry) => sum + entry.delta, 0));
    for (const client of clients) {
      const key = `${client.id}/command-0`;
      const item = ledger.get(key);
      const replay = await worker.apply(command(key, 0, item.delta, 'load', item.note), client.token);
      assert.equal(replay.resultJson, savedResults.get(key));
      assert.equal(replay.committed, false);
    }
    assert.deepEqual(audit(path, 'load'), data);
    const sorted = [...latencies].sort((a, b) => a - b);
    measurements.load = { elapsedMs: Number(elapsedMs.toFixed(3)), committedCommandsPerSecond: Number((1000 / (elapsedMs / 1000)).toFixed(3)), logicalLatencyMs: { p50: Number(sorted[499].toFixed(3)), p95: Number(sorted[949].toFixed(3)), max: Number(sorted[999].toFixed(3)) }, note: 'IPC fixture including conflict responses and explicit snapshot resync; 50 deterministic rounds, not a production saturation benchmark.' };
    await worker.close();
    return { clients: 20, commandsPerClient: 50, logicalCommands: 1000, writeAttempts: 1950, initialConflicts: 950, successfulResyncRetries: 950, committedRevisions: 1000, events: 1000, idempotencyRows: 1000, lostCommits: 0, extraReplayProbes: 20, peakOutstandingRequests: 20, finalStateValue: 0, ledgerSha256: digest(data) };
  });

  await runCase('R8', 'Injected failures after event/idempotency writes roll back all four effects', async () => {
    const { path, worker } = await fixture();
    const before = inspect(path, 'session-a');
    for (const phase of ['after-event-write', 'before-commit']) {
      errorCode(await worker.apply(command(`failure-${phase}`, 0, 9), 'fixture-alice', { failAt: phase }), 'INJECTED_FAILURE');
      assert.deepEqual(inspect(path, 'session-a'), before);
    }
    ok(await worker.apply(command('success-after-rollback', 0, 2)));
    assert.equal(audit(path).runtime.revision, 1);
    await worker.close();
    return { injectedFailures: 2, leakedStateChanges: 0, leakedEvents: 0, leakedIdempotencyResults: 0, successfulRevisionAfterRollback: 1 };
  });

  await runCase('R9', 'Composite session/key scope prevents cross-session replay and leakage', async () => {
    const { path, worker } = await fixture([
      { id: 'session-a', writers: ['alice', 'bob'] },
      { id: 'session-b', writers: ['alice', 'bob'] },
      { id: 'private', writers: ['bob'] },
    ]);
    const a = await worker.apply(command('shared-key', 0, 3));
    const b = await worker.apply(command('shared-key', 0, 9, 'session-b'));
    const privateResult = await worker.apply(command('shared-key', 0, 42, 'private'), 'fixture-bob');
    [a, b, privateResult].forEach(ok);
    assert.equal(ok(a).state.value, 3);
    assert.equal(ok(b).state.value, 9);
    assert.notEqual(a.resultJson, b.resultJson);
    assert.equal((await worker.apply(command('shared-key', 0, 3))).resultJson, a.resultJson);
    assert.equal((await worker.apply(command('shared-key', 0, 9, 'session-b'))).resultJson, b.resultJson);
    errorCode(await worker.apply(command('shared-key', 0, 42, 'private')), 'FORBIDDEN');
    errorCode(await worker.reconnect('private'), 'FORBIDDEN');
    errorCode(await worker.reconnect('nonexistent'), 'FORBIDDEN');
    for (const sessionId of ['session-a', 'session-b', 'private']) assert.equal(audit(path, sessionId).runtime.revision, 1);
    await worker.close();
    return { sameActorSameKeyIndependentSessions: 2, independentlyCommittedPrivateSession: 1, foreignSessionReplayDenied: true, foreignSnapshotDenied: true, nonexistentSessionIndistinguishable: true };
  });

  await runCase('N-auth', 'Empty/invalid auth, reader, outsider and actor forgery deny before write transaction', async () => {
    const { path, worker } = await fixture();
    const before = inspect(path, 'session-a');
    for (const token of ['', 'invalid-token']) errorCode(await worker.apply(command(`auth-${token}`, 0), token), 'UNAUTHENTICATED');
    for (const token of ['fixture-reader', 'fixture-outsider']) errorCode(await worker.apply(command(`auth-${token}`, 0), token), 'FORBIDDEN');
    errorCode(await worker.apply(command('absent-session', 0, 1, 'absent')), 'FORBIDDEN');
    errorCode(await worker.apply({ ...command('forged-actor', 0), actorUserId: 'bob' }), 'INVALID_COMMAND');
    errorCode(await worker.apply({ ...command('forged-owner', 0), op: { type: 'adjust', delta: 1, ownerUserId: 'bob' } }), 'INVALID_OPERATION');
    assert.equal((await worker.request('stats')).transactionsBegun, 0);
    assert.deepEqual(inspect(path, 'session-a'), before);
    await worker.close();
    return { deniedRequests: 7, transactionsBegun: 0, persistedChanges: 0 };
  });

  await runCase('N-validation', 'Required keys, UTF-8 byte limit and safe revision types are enforced', async () => {
    const { path, worker } = await fixture();
    const before = inspect(path, 'session-a');
    for (const key of [undefined, '', '   ', 'é'.repeat(65)]) errorCode(await worker.apply(command(key, 0)), 'INVALID_IDEMPOTENCY_KEY');
    for (const revision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, null]) errorCode(await worker.apply(command(`revision-${revision}`, revision)), 'INVALID_REVISION');
    errorCode(await worker.apply(command('oversize-unicode', 0, 1, 'session-a', '💥'.repeat(1025))), 'STATE_TOO_LARGE');
    // The serialized state boundary also accounts for JSON framing, not only note characters.
    const overhead = Buffer.byteLength(canonical({ value: 1, applied: 1, note: '' }));
    errorCode(await worker.apply(command('oversize-json', 0, 1, 'session-a', 'a'.repeat(POLICY.maxStateBytes - overhead + 1))), 'STATE_TOO_LARGE');
    assert.deepEqual(inspect(path, 'session-a'), before);
    ok(await worker.apply(command('exact-boundary', 0, 1, 'session-a', 'a'.repeat(POLICY.maxStateBytes - overhead))));
    assert.equal(Buffer.byteLength(audit(path).runtime.state_json), POLICY.maxStateBytes);
    await worker.close();
    return { invalidKeysRejected: 4, invalidRevisionsRejected: 4, oversizedStatesRejected: 2, exactStateLimitAcceptedBytes: 4096 };
  });

  await runCase('N-busy', 'A competing SQLite writer returns bounded busy without partial changes, then retry commits once', async () => {
    const { path, worker } = await fixture();
    const locker = new DatabaseSync(path);
    const before = inspect(path, 'session-a');
    const started = performance.now();
    try {
      locker.exec('BEGIN IMMEDIATE');
      errorCode(await worker.apply(command('busy-retry', 0, 4)), 'DATABASE_BUSY');
      measurements.busyWaitMs = Number((performance.now() - started).toFixed(3));
      assert.deepEqual(inspect(path, 'session-a'), before);
      locker.exec('ROLLBACK');
    } finally { locker.close(); }
    ok(await worker.apply(command('busy-retry', 0, 4)));
    assert.equal(audit(path).runtime.revision, 1);
    await worker.close();
    return { configuredBusyTimeoutMs: 250, automaticRetries: 0, failedAttemptPersistedChanges: 0, successfulExplicitRetryRevisions: 1 };
  });

  if (platform() === 'win32') cases.push({ id: 'CANARY', title: 'Crash canary detects a deliberately split transaction', status: 'NOT RUN', reason: 'POSIX SIGKILL requires a Unix test host.' });
  else await runCase('CANARY', 'Crash canary detects durable state without event and idempotency', async () => {
    const { path, worker } = await fixture(undefined, tokens, { brokenSplitCommit: true });
    const ticket = worker.start('apply', { token: 'fixture-alice', command: command('broken-atomicity', 0, 7), pauseAt: 'canary-after-state-commit' });
    await ticket.checkpoint;
    assert.deepEqual(await worker.kill(), { code: null, signal: 'SIGKILL' });
    await ticket.promise.catch(() => undefined);
    const broken = inspect(path, 'session-a');
    const detected = auditViolations(broken);
    assert.equal(broken.runtime.revision, 1);
    assert.equal(broken.events.length, 0);
    assert.equal(broken.idempotency.length, 0);
    assert.deepEqual(detected, ['event-count-does-not-match-revision', 'idempotency-count-does-not-match-revision', 'runtime-does-not-match-committed-events']);
    return { negativeControlDetected: true, signal: 'SIGKILL', durableRevision: 1, durableEvents: 0, durableIdempotencyResults: 0, detectedViolations: detected };
  });

  const criterionMap = [
    ['1', ['R1']], ['2', ['R2']], ['3', ['R3', 'N-concurrent-replay']], ['4', ['R4']],
    ['5', crashPhases.map((phase) => `R5-${phase}`)], ['6', ['R6']], ['7', ['R7']],
    ['8', ['R1', 'R8', ...crashPhases.map((phase) => `R5-${phase}`), 'CANARY']], ['9', ['R9']],
  ];
  const criteria = criterionMap.map(([row, ids]) => ({ row, cases: ids, status: ids.every((id) => cases.find((entry) => entry.id === id)?.status === 'PASS') ? 'PASS' : ids.some((id) => cases.find((entry) => entry.id === id)?.status === 'FAIL') ? 'FAIL' : 'NOT RUN' }));
  const sourcePaths = [
    'scripts/stack-migration-pocs/gate-04/check.mjs',
    'scripts/stack-migration-pocs/gate-04/store.mjs',
    'scripts/stack-migration-pocs/gate-04/writer.mjs',
    '.qa/design/gates/GATE-04-sqlite-revision-idempotency.md',
    '.qa/design/player-test-realtime-runtime-state.md',
    'supabase/migrations/051_session_director_runtime.sql',
    'src/domains/session/contracts/session-runtime.ts',
  ];
  const sources = await Promise.all(sourcePaths.map(async (path) => ({ path, sha256: digest(await readFile(join(repo, path), 'utf8')) })));
  const report = {
    schemaVersion: 1,
    gate: 'GATE-04',
    status: cases.every((entry) => entry.status === 'PASS') ? 'PASS' : cases.some((entry) => entry.status === 'FAIL') ? 'FAIL' : 'NOT RUN',
    approval: 'NOT APPROVED',
    scope: 'Executed storage-semantics fixture; not deployed-product parity or a technology approval.',
    policy: POLICY,
    criteria,
    cases,
    notRun: [
      { id: 'production-command-parity', status: 'NOT RUN', reason: 'Fixture adjust operation is not the 15-kind SagaTree RPC or its gameplay resolvers; live Postgres comparison requires the migration command ports.' },
      { id: 'target-concurrency-capacity-decision', status: 'NOT RUN', reason: '20×50 local workload passed when R7 is PASS, but target state sizes, throughput/latency SLO, hardware, long-running contention and session mix are unspecified. Human GATE review must decide sufficiency.' },
      { id: 'power-loss-durability', status: 'NOT RUN', reason: 'SIGKILL proves process-crash recovery; no kernel, host-power, disk-full, fsync-failure or faulty-storage simulation.' },
      { id: 'production-auth-and-realtime', status: 'NOT RUN', reason: 'Server-owned fixture tokens/memberships and IPC notifications exercise the boundary; OIDC, service policy parity, sockets, backpressure, event retention and an atomic subscribe/catch-up protocol are separate gates.' },
      { id: 'platform-matrix', status: 'NOT RUN', reason: 'Evidence records the exact executed host/runtime. Other OS, filesystem and Node versions require their own execution; Node 22.13 API compatibility is documentation-checked only.' },
    ],
    contractDecisionsRequired: [
      'Require a nonempty idempotency key versus the legacy optional key.',
      'Persist/replay the original result versus legacy current-snapshot replay.',
      'Bind replay to authenticated actor and canonical operation; changed expectedRevision alone is accepted as retry metadata.',
      'Keep append-only audit events authoritative for reconnect, without claiming full event sourcing or guaranteed delivery of a live notification.',
    ],
    sources,
    primaryDocumentation: [
      'https://nodejs.org/download/release/v22.13.0/docs/api/sqlite.html',
      'https://www.sqlite.org/lang_transaction.html',
      'https://www.sqlite.org/wal.html',
      'https://www.sqlite.org/pragma.html#pragma_busy_timeout',
      'https://www.sqlite.org/pragma.html#pragma_synchronous',
    ],
  };
  const observations = {
    schemaVersion: 1, gate: 'GATE-04', runAt: new Date().toISOString(), status: report.status,
    node: process.version, sqlite: engine, os: platform(), architecture: arch(), kernel: release(), cpuModel: cpus()[0]?.model ?? 'unknown',
    filesystemScope: 'Ephemeral local temporary directory on this execution host; filesystem type, mount durability and host fsync guarantees were not qualified.',
    measurements,
    deterministicReportSha256: digest(canonical(report)),
  };
  if (mode === '--write') {
    await mkdir(evidence, { recursive: true });
    await writeFile(join(evidence, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(join(evidence, 'observations.json'), `${JSON.stringify(observations, null, 2)}\n`);
  } else {
    const committed = JSON.parse(await readFile(join(evidence, 'report.json'), 'utf8'));
    assert.deepEqual(report, committed, 'Deterministic GATE-04 evidence differs. Inspect the test failure/source changes; regenerate explicitly with --write.');
  }
  process.stdout.write(`${JSON.stringify({ gate: 'GATE-04', status: report.status, mode, mandatoryRows: criteria.map(({ row, status }) => `${row}:${status}`), cases: cases.length, approval: report.approval, node: observations.node, sqlite: engine, load: measurements.load })}\n`);
  if (report.status !== 'PASS') process.exitCode = 1;
} finally {
  for (const instance of activeWriters) await instance.kill();
  await rm(transient, { recursive: true, force: true });
}
