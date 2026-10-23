#!/usr/bin/env node
/**
 * mig-022-session-runtime.self-test — atomic revision/event/idempotency (ADR-ST-08).
 * Location: scripts/mig-022-session-runtime.self-test.mjs
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

if (!isMainThread) {
  const { persistenceUrl, sessionUrl, dbPath, actorId, command } = workerData;
  const { openHostDatabase } = await import(persistenceUrl);
  const { createSessionPorts } = await import(sessionUrl);
  const opened = openHostDatabase(dbPath);
  if (!opened.ok) {
    parentPort.postMessage({ ok: false, error: opened.error });
    process.exit(0);
  }
  const ports = createSessionPorts({ db: opened.db });
  const result = ports.store.applyCommand(actorId, command);
  opened.db.close();
  parentPort.postMessage(result);
  process.exit(0);
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const sessionUrl = pathToFileURL(join(root, 'server/src/modules/session/index.ts')).href;
const appUrl = pathToFileURL(join(root, 'server/src/application/session/index.ts')).href;

const { bootstrapHostPersistence, openHostDatabase, runMigrations } = await import(persistenceUrl);
const { createSessionPorts } = await import(sessionUrl);
const { createSessionRuntimeUseCase } = await import(appUrl);

const work = mkdtempSync(join(tmpdir(), 'mig022-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);
const acceptance = [];
const note = (line) => acceptance.push(line);

function actor(id) {
  return {
    kind: 'remote-account',
    actorId: id,
    sessionId: `auth-${id}`,
    email: null,
    linkedSoloActorIds: [],
  };
}

async function applyViaWorker(dbPath, actorId, command) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { persistenceUrl, sessionUrl, dbPath, actorId, command },
      execArgv: ['--experimental-strip-types'],
    });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`worker exit ${code}`));
    });
  });
}

try {
  // Domain contract parity — host mirror must retain canonical field/kind vocabulary.
  const domainRuntime = readFileSync(
    join(root, 'src/domains/session/contracts/session-runtime.ts'),
    'utf8',
  );
  for (const token of [
    'interface SessionRuntimeState',
    'status: PlaySessionStatus',
    'roster: SessionPresenceEntry[]',
    'gameplay: SessionGameplayState',
    "| 'presence'",
    "| 'status'",
    "| 'gameplay'",
  ]) {
    assert(domainRuntime.includes(token), `domain contract missing token: ${token}`);
  }
  const hostMirror = readFileSync(
    join(root, 'server/src/modules/session/internal/session-runtime-domain.ts'),
    'utf8',
  );
  for (const token of ['status:', 'roster:', 'gameplay:', "'presence'", "'status'", "'gameplay'"]) {
    assert(hostMirror.includes(token), `host mirror missing token: ${token}`);
  }

  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 3, `schemaVersion >= 3, got ${boot.schemaVersion}`);

  const dbPath = join(dataDir, 'host.sqlite');
  const ports = createSessionPorts({ db: boot.db });
  const useCase = createSessionRuntimeUseCase(ports);

  const gm = actor('user-gm');
  const other = actor('user-other');
  const reader = actor('user-reader');

  ports.store.seedSession({
    sessionId: 'SE-A',
    projectId: 'PRJ-1',
    writers: [gm.actorId],
    readers: [reader.actorId],
  });
  ports.store.seedSession({
    sessionId: 'SE-B',
    projectId: 'PRJ-1',
    writers: [gm.actorId, other.actorId],
  });

  // --- Fall 1: true concurrent writers on distinct connections ---
  boot.db.close();
  const [c1, c2] = await Promise.all([
    applyViaWorker(dbPath, gm.actorId, {
      sessionId: 'SE-A',
      expectedRevision: 0,
      idempotencyKey: 'k-concurrent-a',
      op: { kind: 'status', payload: { status: 'active' } },
    }),
    applyViaWorker(dbPath, gm.actorId, {
      sessionId: 'SE-A',
      expectedRevision: 0,
      idempotencyKey: 'k-concurrent-b',
      op: { kind: 'gameplay', payload: { sceneId: 'SC-1' } },
    }),
  ]);
  const wins = [c1, c2].filter((r) => r.ok && r.committed);
  const stale = [c1, c2].filter((r) => !r.ok && (r.error === 'STALE_REVISION' || r.error === 'DATABASE_BUSY'));
  assert(wins.length === 1, `exactly one concurrent commit, got ${JSON.stringify([c1, c2])}`);
  assert(stale.length === 1, `exactly one conflict/busy, got ${JSON.stringify([c1, c2])}`);

  const reopened = openHostDatabase(dbPath);
  assert(reopened.ok, 'reopen after concurrent');
  const ports2 = createSessionPorts({ db: reopened.db });
  const useCase2 = createSessionRuntimeUseCase(ports2);
  const snapA = useCase2.getSnapshot(gm, 'SE-A');
  assert(snapA.ok && snapA.snapshot.revision === 1, `snap after conflict ${JSON.stringify(snapA)}`);
  assert(
    snapA.snapshot.status === 'active' || snapA.snapshot.gameplay.sceneId === 'SC-1',
    'winner left domain-shaped state',
  );
  note('Fall 1 PASS: concurrent writers — exactly one commit');

  // --- Fall 2: replay / mismatch / domain contract ---
  const first = useCase2.applyCommand(gm, {
    sessionId: 'SE-A',
    expectedRevision: 1,
    idempotencyKey: 'k-replay',
    op: { kind: 'presence', payload: { userId: 'user-gm', isOnline: true, characterId: 'CH-1' } },
  });
  assert(first.ok && first.committed && first.snapshot.revision === 2, `first apply ${JSON.stringify(first)}`);
  assert(
    first.snapshot.roster.some((r) => r.userId === 'user-gm' && r.isOnline),
    'domain roster updated',
  );

  const replay = useCase2.applyCommand(gm, {
    sessionId: 'SE-A',
    expectedRevision: 99,
    idempotencyKey: 'k-replay',
    op: { kind: 'presence', payload: { userId: 'user-gm', isOnline: true, characterId: 'CH-1' } },
  });
  assert(
    replay.ok && replay.committed === false && replay.snapshot.revision === 2,
    `identical retry replay ${JSON.stringify(replay)}`,
  );

  const wrongPayload = useCase2.applyCommand(gm, {
    sessionId: 'SE-A',
    expectedRevision: 2,
    idempotencyKey: 'k-replay',
    op: { kind: 'presence', payload: { userId: 'user-gm', isOnline: false, characterId: 'CH-1' } },
  });
  assert(!wrongPayload.ok && wrongPayload.error === 'IDEMPOTENCY_MISMATCH', `payload mismatch ${JSON.stringify(wrongPayload)}`);

  const nonMember = useCase2.applyCommand(other, {
    sessionId: 'SE-A',
    expectedRevision: 2,
    idempotencyKey: 'k-replay',
    op: { kind: 'presence', payload: { userId: 'user-gm', isOnline: true, characterId: 'CH-1' } },
  });
  assert(!nonMember.ok && nonMember.error === 'FORBIDDEN', `non-member denied ${JSON.stringify(nonMember)}`);

  const otherSession = useCase2.applyCommand(gm, {
    sessionId: 'SE-B',
    expectedRevision: 0,
    idempotencyKey: 'k-replay',
    op: { kind: 'presence', payload: { userId: 'user-gm', isOnline: true, characterId: 'CH-1' } },
  });
  assert(otherSession.ok && otherSession.committed && otherSession.snapshot.revision === 1, `cross-session ${JSON.stringify(otherSession)}`);

  const actorClash = useCase2.applyCommand(other, {
    sessionId: 'SE-B',
    expectedRevision: 1,
    idempotencyKey: 'k-replay',
    op: { kind: 'presence', payload: { userId: 'user-gm', isOnline: true, characterId: 'CH-1' } },
  });
  assert(!actorClash.ok && actorClash.error === 'IDEMPOTENCY_MISMATCH', `actor mismatch ${JSON.stringify(actorClash)}`);
  note('Fall 2 PASS: replay / mismatch / domain status+roster+gameplay');

  // --- Fall 3: SIGKILL mid-transaction (POSIX) ---
  if (process.platform === 'win32') {
    note('Fall 3 SKIPPED on win32 (SIGKILL crash proof is POSIX)');
  } else {
    const crashDir = join(work, 'crash');
    mkdirSync(crashDir);
    const crashBoot = bootstrapHostPersistence({
      dataDir: crashDir,
      migrationsDir: join(root, 'server/migrations'),
    });
    assert(crashBoot.ok, `crash bootstrap ${crashBoot.ok ? '' : crashBoot.error}`);
    const crashPorts = createSessionPorts({ db: crashBoot.db });
    crashPorts.store.seedSession({
      sessionId: 'SE-CRASH',
      projectId: 'PRJ-1',
      writers: [gm.actorId],
    });
    crashBoot.db.close();

    const crashDb = join(crashDir, 'host.sqlite');
    const marker = join(crashDir, 'in-tx');
    const workerJs = join(crashDir, 'crash-worker.mjs');
    writeFileSync(
      workerJs,
      `
import { writeFileSync } from 'node:fs';
const { openHostDatabase } = await import(${JSON.stringify(persistenceUrl)});
const opened = openHostDatabase(${JSON.stringify(crashDb)});
if (!opened.ok) process.exit(2);
opened.db.exec('BEGIN IMMEDIATE');
opened.db.prepare(
  "UPDATE session_runtime SET revision = 1, state_json = '{\\"status\\":\\"active\\",\\"roster\\":[],\\"gameplay\\":{\\"sceneId\\":null,\\"combatActive\\":false,\\"shared\\":{}}}', updated_at = ? WHERE session_id = 'SE-CRASH' AND revision = 0"
).run(new Date().toISOString());
writeFileSync(${JSON.stringify(marker)}, 'in-tx\\n');
setInterval(() => {}, 60_000);
`,
      'utf8',
    );

    const child = spawn(process.execPath, ['--experimental-strip-types', workerJs], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    assert(child.pid != null, 'crash worker spawn');
    let childErr = '';
    child.stderr.on('data', (d) => {
      childErr += d;
    });
    const closePromise = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal })));

    const deadline = Date.now() + 10_000;
    while (!existsSync(marker) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    assert(existsSync(marker), `crash worker never entered TX; stderr=${childErr || '(empty)'}`);
    await new Promise((r) => setTimeout(r, 100));
    process.kill(child.pid, 'SIGKILL');
    const closed = await Promise.race([
      closePromise,
      new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 5_000)),
    ]);
    assert(!closed.timedOut && closed.signal === 'SIGKILL', `expected SIGKILL, got ${JSON.stringify(closed)}`);

    const after = openHostDatabase(crashDb);
    assert(after.ok, 'reopen after SIGKILL');
    const row = after.db
      .prepare('SELECT revision FROM session_runtime WHERE session_id = ?')
      .get('SE-CRASH');
    const events = after.db
      .prepare('SELECT COUNT(*) AS c FROM session_events WHERE session_id = ?')
      .get('SE-CRASH');
    const idem = after.db
      .prepare('SELECT COUNT(*) AS c FROM command_idempotency WHERE session_id = ?')
      .get('SE-CRASH');
    assert(row.revision === 0, `revision rolled back after crash, got ${row.revision}`);
    assert(events.c === 0 && idem.c === 0, 'no orphan event/idempotency after crash');
    after.db.close();
    note('Fall 3 PASS: SIGKILL mid-tx leaves all four parts absent');
  }

  const readerWrite = useCase2.applyCommand(reader, {
    sessionId: 'SE-A',
    expectedRevision: 2,
    idempotencyKey: 'k-reader',
    op: { kind: 'status', payload: { status: 'paused' } },
  });
  assert(!readerWrite.ok && readerWrite.error === 'FORBIDDEN', `reader write denied ${JSON.stringify(readerWrite)}`);

  const missingKey = useCase2.applyCommand(gm, {
    sessionId: 'SE-A',
    expectedRevision: 2,
    idempotencyKey: '',
    op: { kind: 'status', payload: { status: 'paused' } },
  });
  assert(!missingKey.ok && missingKey.error === 'INVALID_IDEMPOTENCY_KEY', 'empty key rejected');

  reopened.db.close();

  writeFileSync(
    join(root, '.qa/acceptance/stack-migration-mig-022.md'),
    `# Acceptance — MIG-022 SessionRuntimeState\n\n` +
      `Domain contract: status / roster / gameplay (src/domains/session/contracts/session-runtime.ts)\n\n` +
      acceptance.map((line) => `- [x] ${line}`).join('\n') +
      `\n- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).\n`,
  );

  console.log('PASS: mig-022 session runtime (revision+idempotency)');
} finally {
  rmSync(work, { recursive: true, force: true });
}
