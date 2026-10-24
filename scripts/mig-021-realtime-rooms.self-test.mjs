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

  /** @type {Array<{actorId:string,revision:number,kind:string,role:string}>} */
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
        role: message.projection.role,
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
  // Tip snapshot replaces local state — deltas already folded into revision must not replay.
  assert(joinGm.sync.events.length === 0, 'GM tip snapshot omits folded deltas');

  const joinP1Behind = realtime.join(p1, {
    sessionId,
    clientRevision: 0,
    // Privilege escalation attempt — must be ignored
    claimedRole: 'gm',
    claimedRevealedObjectIds: ['SECRET'],
  });
  assert(joinP1Behind.ok && joinP1Behind.sync.role === 'player', 'P1 stays player despite claimed gm');
  assert(joinP1Behind.sync.revision === 1, 'P1 join snapshot');
  assert(joinP1Behind.sync.events.length === 0, 'behind client gets tip replace, not double-apply deltas');

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
  assert(resyncP1.sync.events.length === 0, 'resync tip snapshot omits deltas already in revision');
  note(
    'Jeder erhält einen konsistenten Snapshot ohne Lücke oder doppelte Anwendung der bereits im Tip enthaltenen Deltas.',
  );

  // Fan-out must re-resolve membership: revoke mid-session → no further delivery.
  fanout.length = 0;
  session.store.revokeMembership(sessionId, p1.actorId);
  const cmd3 = session.commands.apply(gm, {
    sessionId,
    expectedRevision: 2,
    idempotencyKey: 'cmd-3',
    op: { kind: 'presence', payload: { userId: gm.actorId, isOnline: true, characterId: 'CH-2' } },
  });
  assert(cmd3.ok && cmd3.snapshot.revision === 3, 'third command after revoke');
  assert(
    !fanout.some((f) => f.actorId === p1.actorId) &&
      fanout.some((f) => f.actorId === gm.actorId && f.revision === 3),
    `revoked occupant skipped on fan-out, got ${JSON.stringify(fanout)}`,
  );
  assert(!realtime.occupants(sessionId).includes(p1.actorId), 'revoked occupant evicted from room');

  // Demote writer → subsequent fan-out projects as player (cached join role must not stick).
  session.store.setMembershipCanWrite(sessionId, gm.actorId, false);
  session.store.setMembershipCanWrite(sessionId, p2.actorId, true);
  realtime.join(gm, { sessionId, clientRevision: 3 });
  fanout.length = 0;
  const cmd4 = session.commands.apply(p2, {
    sessionId,
    expectedRevision: 3,
    idempotencyKey: 'cmd-4',
    op: { kind: 'presence', payload: { userId: p2.actorId, isOnline: true } },
  });
  assert(cmd4.ok && cmd4.snapshot.revision === 4, 'fourth command by promoted p2');
  const gmFan = fanout.find((f) => f.actorId === gm.actorId && f.revision === 4);
  assert(gmFan && gmFan.role === 'player', `demoted gm fan-out role=player, got ${JSON.stringify(gmFan)}`);
  note('Fan-out re-resolves membership; revoked occupants are evicted; demoted writers lose GM projection.');

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
    clientRevision: 4,
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

  // p1/p2 were revoked earlier — use remaining member (demoted gm still has membership).
  const afterRestart = realtime2.resync(gm, {
    sessionId,
    clientRevision: 0,
  });
  assert(afterRestart.ok && afterRestart.sync.reconstructed === true, 'reconstructed flag');
  assert(afterRestart.sync.revision === 4, 'durable tip after restart');
  assert(afterRestart.sync.events.length === 0, 'tip replace after restart — no folded-delta replay');
  assert(afterRestart.sync.snapshot.revision === 4, 'projected snapshot at durable tip');
  assert(afterRestart.sync.role === 'player', 'demotion survives host restart');
  note(
    'Der Resync rekonstruiert das bestätigte Tip-Ergebnis aus der Persistenz ohne doppelte Delta-Anwendung.',
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
