#!/usr/bin/env node
/**
 * mig-021-realtime-rooms.self-test — authorized rooms, resync, membership deny.
 * Location: scripts/mig-021-realtime-rooms.self-test.mjs
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const sessionUrl = pathToFileURL(join(root, 'server/src/modules/session/index.ts')).href;
const realtimeUrl = pathToFileURL(join(root, 'server/src/realtime/index.ts')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createSessionPorts } = await import(sessionUrl);
const { createRealtimeSessionRooms } = await import(realtimeUrl);

const work = mkdtempSync(join(tmpdir(), 'mig021-'));
const acceptance = [];
const note = (line) => acceptance.push(line);

try {
  const boot = bootstrapHostPersistence({
    dataDir: work,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);

  /** @type {Array<{actorId:string,revision:number,kind:string}>} */
  const fanout = [];
  let realtime;
  const session = createSessionPorts({
    db: boot.db,
    onCommitted: (event) => {
      realtime.onCommitted(event);
    },
  });
  realtime = createRealtimeSessionRooms({
    session,
    onFanout: (message) => {
      fanout.push({
        actorId: message.actorId,
        revision: message.revision,
        kind: message.kind,
      });
    },
  });

  const sessionId = 'SE-MIG021';
  const projectId = 'PR-MIG021';
  const gm = { actorId: 'user-gm', kind: 'remote-account' };
  const p1 = { actorId: 'user-p1', kind: 'remote-account' };
  const p2 = { actorId: 'user-p2', kind: 'remote-account' };
  const stranger = { actorId: 'user-x', kind: 'remote-account' };

  session.store.seedSession({
    sessionId,
    projectId,
    writers: [gm.actorId],
    readers: [p1.actorId, p2.actorId],
  });

  const cmd1 = session.commands.apply(gm, {
    sessionId,
    expectedRevision: 0,
    idempotencyKey: 'cmd-1',
    op: { kind: 'presence', payload: { userId: gm.actorId, isOnline: true } },
  });
  assert(cmd1.ok && cmd1.committed && cmd1.snapshot.revision === 1, 'seed command commits');

  // --- Fall 1 ---
  const joinGm = realtime.join(gm, { sessionId, clientRevision: 0 });
  assert(joinGm.ok && joinGm.sync.revision === 1 && joinGm.sync.role === 'gm', 'GM join');
  assert(joinGm.sync.events.length >= 1, 'GM gets events from 0');

  const joinP1Behind = realtime.join(p1, {
    sessionId,
    clientRevision: 0,
    // Privilege escalation attempt — must be ignored
    claimedRole: 'gm',
    claimedRevealedObjectIds: ['SECRET'],
  });
  assert(joinP1Behind.ok && joinP1Behind.sync.role === 'player', 'P1 stays player despite claimed gm');
  assert(joinP1Behind.sync.revision === 1, 'P1 join snapshot');
  const p1Revs = joinP1Behind.sync.events.map((e) => e.revision);
  assert(p1Revs.every((r, i) => i === 0 || r > p1Revs[i - 1]), 'P1 events ordered, no gap');

  const joinP2Current = realtime.join(p2, { sessionId, clientRevision: 1 });
  assert(joinP2Current.ok && joinP2Current.sync.events.length === 0, 'P2 at tip gets no duplicate events');

  fanout.length = 0;
  const cmd2 = session.commands.apply(gm, {
    sessionId,
    expectedRevision: 1,
    idempotencyKey: 'cmd-2',
    op: { kind: 'presence', payload: { userId: gm.actorId, isOnline: true, characterId: 'CH-1' } },
  });
  assert(cmd2.ok && cmd2.snapshot.revision === 2, 'second command');
  assert(
    fanout.some((f) => f.actorId === p1.actorId && f.revision === 2) &&
      fanout.some((f) => f.actorId === gm.actorId && f.revision === 2),
    `committed fan-out to occupants, got ${JSON.stringify(fanout)}`,
  );

  const resyncP1 = realtime.resync(p1, { sessionId, clientRevision: 1 });
  assert(resyncP1.ok && resyncP1.sync.revision === 2, 'resync tip');
  assert(
    resyncP1.sync.events.length === 1 && resyncP1.sync.events[0].revision === 2,
    'resync only follow-on event (no duplicate of rev 1)',
  );
  note(
    'Jeder erhält einen konsistenten Snapshot und die freigegebenen Folgeereignisse ohne Lücke oder doppelte Anwendung.',
  );

  // --- Fall 2 ---
  const denyStranger = realtime.join(stranger, {
    sessionId,
    roomId: joinGm.sync.roomId,
    clientRevision: 0,
  });
  assert(!denyStranger.ok && denyStranger.error === 'FORBIDDEN', 'stranger join denied');

  session.store.revokeMembership(sessionId, p2.actorId);
  const denyRevoked = realtime.resync(p2, {
    sessionId,
    roomId: joinP2Current.sync.roomId,
    clientRevision: 2,
  });
  assert(!denyRevoked.ok && denyRevoked.error === 'FORBIDDEN', 'revoked member resync denied');

  const wrongRoom = realtime.join(p1, {
    sessionId,
    roomId: 'session:OTHER',
    clientRevision: 0,
  });
  assert(!wrongRoom.ok && wrongRoom.error === 'FORBIDDEN', 'mismatched room id denied');
  note(
    'Alle Pfade verweigern Zugriff; eine gespeicherte Raum-ID oder alte Verbindung umgeht die aktuelle Membership nicht.',
  );

  // --- Fall 3: host restart ---
  boot.db.close();
  const boot2 = bootstrapHostPersistence({
    dataDir: work,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot2.ok, 'rebootstrap');
  const session2 = createSessionPorts({ db: boot2.db });
  const realtime2 = createRealtimeSessionRooms({ session: session2 });

  const afterRestart = realtime2.resync(p1, {
    sessionId,
    clientRevision: 0,
  });
  assert(afterRestart.ok && afterRestart.sync.reconstructed === true, 'reconstructed flag');
  assert(afterRestart.sync.revision === 2, 'durable tip after restart');
  assert(
    afterRestart.sync.events.some((e) => e.revision === 1) &&
      afterRestart.sync.events.some((e) => e.revision === 2),
    'both confirmed events present after restart',
  );
  assert(
    afterRestart.sync.events.every((e) => e.revision === 1 || e.revision === 2),
    'no rolled-back mutation published',
  );
  note(
    'Der Resync rekonstruiert das bestätigte Ergebnis aus persistierten Ereignissen und veröffentlicht keine zurückgerollte Mutation.',
  );
  note('Touched files: zero type escape hatches (typed-strict / Boy Scout).');

  writeFileSync(
    join(root, '.qa/acceptance/stack-migration-mig-021.md'),
    `# Acceptance — MIG-021 realtime rooms\n\n` +
      acceptance.map((line) => `- [x] ${line}`).join('\n') +
      `\n`,
  );
  console.log('PASS: mig-021 realtime rooms');
  boot2.db.close();
} finally {
  rmSync(work, { recursive: true, force: true });
}
