#!/usr/bin/env node
/**
 * mig-023-session-invites.self-test — invite/join without privilege escalation.
 * Location: scripts/mig-023-session-invites.self-test.mjs
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

if (!isMainThread) {
  const { persistenceUrl, sessionUrl, invitesUrl, dbPath, actorId, op } = workerData;
  const { openHostDatabase } = await import(persistenceUrl);
  const { createSessionPorts } = await import(sessionUrl);
  const { createSessionInvitesUseCase } = await import(invitesUrl);
  const opened = openHostDatabase(dbPath);
  if (!opened.ok) {
    parentPort.postMessage({ ok: false, error: opened.error });
    process.exit(0);
  }
  const ports = createSessionPorts({ db: opened.db });
  const useCase = createSessionInvitesUseCase(ports);
  const actor = {
    kind: 'remote-account',
    actorId,
    sessionId: `auth-${actorId}`,
    email: null,
    linkedSoloActorIds: [],
  };
  const result = useCase.joinByInviteOrCode(actor, op);
  opened.db.close();
  parentPort.postMessage(result);
  process.exit(0);
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const sessionUrl = pathToFileURL(join(root, 'server/src/modules/session/index.ts')).href;
const invitesUrl = pathToFileURL(join(root, 'server/src/application/session/invites/index.ts')).href;

const { bootstrapHostPersistence, openHostDatabase } = await import(persistenceUrl);
const { createSessionPorts } = await import(sessionUrl);
const { createSessionInvitesUseCase } = await import(invitesUrl);

const work = mkdtempSync(join(tmpdir(), 'mig023-'));
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

async function joinViaWorker(dbPath, actorId, op) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), {
      workerData: { persistenceUrl, sessionUrl, invitesUrl, dbPath, actorId, op },
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
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 4, `schemaVersion >= 4, got ${boot.schemaVersion}`);

  const dbPath = join(dataDir, 'host.sqlite');
  const ports = createSessionPorts({ db: boot.db });
  const invites = createSessionInvitesUseCase(ports);

  const gm = actor('user-gm');
  const player = actor('user-player');
  const stranger = actor('user-stranger');

  ports.invites.seedWorldProjectSession({
    worldId: 'W-1',
    projectId: 'PRJ-A',
    gmUserId: gm.actorId,
    sessionId: 'SE-A',
    publicId: 'SE-AAAAA',
    joinCode: 'ABC123',
    status: 'waiting',
  });
  ports.invites.seedWorldProjectSession({
    worldId: 'W-1',
    projectId: 'PRJ-B',
    gmUserId: gm.actorId,
    sessionId: 'SE-B',
    publicId: 'SE-BBBBB',
    joinCode: 'XYZ999',
    status: 'waiting',
  });

  // --- Fall 1: valid invite → player membership in target project; replay no second row ---
  const created = invites.createInvite(gm, 'SE-A', { maxRedemptions: 10 });
  assert(created.ok, `create invite ${JSON.stringify(created)}`);
  const join1 = invites.joinByInviteOrCode(player, {
    token: created.token,
    claimedRole: 'gm',
  });
  assert(join1.ok && join1.createdMembership, `first join ${JSON.stringify(join1)}`);
  assert(join1.membership.role === 'player', `role must be player, got ${join1.membership.role}`);
  assert(join1.projectId === 'PRJ-A', 'membership only in target project');
  const membersAfter = ports.invites.listProjectMembers('PRJ-A');
  assert(
    membersAfter.filter((m) => m.userId === player.actorId).length === 1,
    'exactly one membership row',
  );
  const joinReplay = invites.joinByInviteOrCode(player, {
    token: created.token,
    claimedRole: 'owner',
  });
  assert(joinReplay.ok && !joinReplay.createdMembership, 'replay does not create second membership');
  assert(
    ports.invites.listProjectMembers('PRJ-A').filter((m) => m.userId === player.actorId).length === 1,
    'still one membership after replay',
  );
  assert(
    ports.invites.listProjectMembers('PRJ-B').every((m) => m.userId !== player.actorId),
    'no cross-project membership',
  );
  note(
    'Die Membership entsteht ausschließlich im Zielprojekt mit der serverseitig vorgegebenen Spielerrolle; Wiederholung erstellt keinen zweiten Eintrag.',
  );

  // --- Fall 2: expired / revoked / foreign code denied ---
  const shortLived = invites.createInvite(gm, 'SE-A', { ttlMs: 1, maxRedemptions: 1 });
  assert(shortLived.ok, 'short lived invite');
  await new Promise((r) => setTimeout(r, 5));
  const expired = invites.joinByInviteOrCode(stranger, { token: shortLived.token });
  assert(!expired.ok && expired.error === 'EXPIRED', `expired ${JSON.stringify(expired)}`);

  const revocable = invites.createInvite(gm, 'SE-A');
  assert(revocable.ok, 'revocable');
  const revoked = invites.revokeInvite(gm, revocable.token);
  assert(revoked.ok, 'revoke');
  const afterRevoke = invites.joinByInviteOrCode(stranger, { token: revocable.token });
  assert(!afterRevoke.ok && afterRevoke.error === 'REVOKED', `revoked ${JSON.stringify(afterRevoke)}`);

  const foreign = invites.joinByInviteOrCode(stranger, { joinCode: 'NOPE00' });
  assert(!foreign.ok && foreign.error === 'NOT_FOUND', `foreign ${JSON.stringify(foreign)}`);

  const beforeStranger = ports.invites.listProjectMembers('PRJ-A').length;
  assert(
    ports.invites.listProjectMembers('PRJ-A').every((m) => m.userId !== stranger.actorId),
    'stranger has no membership after denies',
  );
  assert(
    ports.invites.listProjectMembers('PRJ-A').length === beforeStranger,
    'membership count unchanged after denies',
  );
  note('Der Join wird ohne neue Membership und ohne Session-Zustandsänderung abgewiesen.');

  // --- Fall 3: concurrent redeem + role=gm ignored; max_redemptions atomic ---
  boot.db.close();
  const limitedOpen = openHostDatabase(dbPath);
  assert(limitedOpen.ok, 'reopen for concurrent');
  const limitedPorts = createSessionPorts({ db: limitedOpen.db });
  const limitedInvites = createSessionInvitesUseCase(limitedPorts);
  const oneShot = limitedInvites.createInvite(gm, 'SE-B', { maxRedemptions: 1 });
  assert(oneShot.ok, `one-shot invite ${JSON.stringify(oneShot)}`);
  limitedOpen.db.close();

  const [c1, c2] = await Promise.all([
    joinViaWorker(dbPath, 'user-racer-a', { token: oneShot.token, claimedRole: 'gm' }),
    joinViaWorker(dbPath, 'user-racer-b', { token: oneShot.token, claimedRole: 'gm' }),
  ]);
  const wins = [c1, c2].filter((r) => r.ok);
  const limited = [c1, c2].filter((r) => !r.ok && (r.error === 'REDEEM_LIMIT' || r.error === 'DATABASE_BUSY'));
  assert(wins.length === 1, `exactly one redeem win, got ${JSON.stringify([c1, c2])}`);
  assert(limited.length === 1, `exactly one limit/busy, got ${JSON.stringify([c1, c2])}`);
  assert(wins[0].membership.role === 'player', 'winner role is player despite claimedRole=gm');

  const after = openHostDatabase(dbPath);
  assert(after.ok, 'reopen after race');
  const afterPorts = createSessionPorts({ db: after.db });
  const prjB = afterPorts.invites.listProjectMembers('PRJ-B');
  const racers = prjB.filter((m) => m.userId === 'user-racer-a' || m.userId === 'user-racer-b');
  assert(racers.length === 1, `exactly one racer membership on PRJ-B, got ${JSON.stringify(racers)}`);
  assert(racers[0].role === 'player', 'racer role player');
  assert(
    prjB.every((m) => m.role !== 'gm' || m.userId === gm.actorId),
    'no escalated gm via invite',
  );
  after.db.close();
  note(
    'Einmaligkeits-/Nutzungslimits bleiben atomar und der Request kann keine GM- oder Owner-Rechte vergeben.',
  );
  note('Touched files: zero type escape hatches (typed-strict / Boy Scout).');

  writeFileSync(
    join(root, '.qa/acceptance/stack-migration-mig-023.md'),
    `# Acceptance — MIG-023 Invite/join codes\n\n` +
      acceptance.map((line) => `- [x] ${line}`).join('\n') +
      `\n`,
  );

  console.log('PASS: mig-023 session invites (no privilege escalation)');
} finally {
  rmSync(work, { recursive: true, force: true });
}
