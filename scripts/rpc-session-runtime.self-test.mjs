#!/usr/bin/env node
/**
 * rpc-session-runtime.self-test — RPC facades over MIG-022 session ports (#867).
 * Location: scripts/rpc-session-runtime.self-test.mjs
 */
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
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

function actor(id) {
  return {
    kind: 'remote-account',
    actorId: id,
    sessionId: `auth-${id}`,
    email: null,
    linkedSoloActorIds: [],
  };
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const sessionUrl = pathToFileURL(join(root, 'server/src/modules/session/index.ts')).href;
const applyUrl = pathToFileURL(
  join(root, 'server/src/application/commands/apply_session_runtime_command.ts'),
).href;
const snapUrl = pathToFileURL(
  join(root, 'server/src/application/commands/get_session_runtime_snapshot.ts'),
).href;
const presenceUrl = pathToFileURL(
  join(root, 'server/src/application/commands/set_session_player_presence.ts'),
).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createSessionPorts } = await import(sessionUrl);
const { apply_session_runtime_command } = await import(applyUrl);
const { get_session_runtime_snapshot } = await import(snapUrl);
const { set_session_player_presence } = await import(presenceUrl);

const work = mkdtempSync(join(tmpdir(), 'rpc-sess-rt-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  const db = boot.db;
  const session = createSessionPorts({ db });
  const apply = apply_session_runtime_command(session);
  const snapshot = get_session_runtime_snapshot(session);
  const presence = set_session_player_presence(session);

  const GM = actor('gm-1');
  const P = actor('player-1');
  const X = actor('stranger-x');
  const sessionId = 'sess-rpc-867';

  session.store.seedSession({
    sessionId,
    projectId: 'proj-1',
    writers: [GM.actorId],
    readers: [P.actorId],
  });

  // --- Fall 1: all 15 runtime kinds via apply (presence ≠ separate lifecycle RPCs) ---
  const kindPayload = {
    presence: { userId: GM.actorId, isOnline: true, characterId: 'CH-1' },
    status: { status: 'active' },
    roll: { dice: '1d20' },
    damage: { amount: 1 },
    condition: { name: 'prone' },
    scene: { sceneId: 'sc-1' },
    combat: { combatActive: true },
    gameplay: { sceneId: 'sc-2' },
    program: { cue: 'open' },
    reveal: { factId: 'f1' },
    life: { state: 'ok' },
    adventure: { step: 1 },
    cue: { id: 'c1' },
    join: {},
    leave: {},
  };
  const kinds = Object.keys(kindPayload);
  assert(kinds.length === 15, '15 runtime kinds');
  let rev = 0;
  for (const kind of kinds) {
    const r = apply(GM, {
      sessionId,
      expectedRevision: rev,
      idempotencyKey: `k-${kind}-${rev}`,
      op: { kind, payload: kindPayload[kind] },
    });
    assert(r.ok && r.value.committed, `kind ${kind}: ${r.ok ? '' : r.error}`);
    rev = r.value.snapshot.revision;
  }

  // --- Fall 2: stale revision → 40001 ---
  const stale = apply(GM, {
    sessionId,
    expectedRevision: 0,
    idempotencyKey: 'stale-1',
    op: { kind: 'gameplay', payload: { x: 1 } },
  });
  assert(!stale.ok && stale.error === '40001', `stale: ${stale.error}`);

  // --- Fall 3: idempotent replay — same key, no second commit ---
  const key = `idem-${rev}`;
  const first = apply(GM, {
    sessionId,
    expectedRevision: rev,
    idempotencyKey: key,
    op: { kind: 'scene', payload: { id: 's1' } },
  });
  assert(first.ok && first.value.committed, 'first commit');
  const replay = apply(GM, {
    sessionId,
    expectedRevision: rev,
    idempotencyKey: key,
    op: { kind: 'scene', payload: { id: 's1' } },
  });
  assert(replay.ok && replay.value.committed === false, 'replay not committed');
  assert(replay.value.snapshot.revision === first.value.snapshot.revision, 'same revision');

  // --- Fall 4: foreign deny + presence facade ---
  const foreignSnap = snapshot(X, sessionId);
  assert(!foreignSnap.ok && foreignSnap.error === '42501', `foreign snap: ${foreignSnap.error}`);

  const okSnap = snapshot(P, sessionId);
  assert(okSnap.ok, 'player snapshot');
  rev = okSnap.value.snapshot.revision;

  const setP = presence(P, {
    sessionId,
    expectedRevision: rev,
    idempotencyKey: `pres-${rev}`,
    presence: { userId: P.actorId, characterId: 'ch-own', isOnline: true },
  });
  assert(setP.ok && setP.value.committed, `presence: ${setP.ok ? '' : setP.error}`);
  rev = setP.value.snapshot.revision;
  // Reader cannot forge another member's presence (can_write=0 path).
  const forged = presence(P, {
    sessionId,
    expectedRevision: rev,
    idempotencyKey: `pres-forge-${rev}`,
    presence: { userId: GM.actorId, characterId: 'ch-forge', isOnline: true },
  });
  assert(!forged.ok && forged.error === '42501', `forge presence: ${forged.ok ? 'ok' : forged.error}`);

  // No public append_session_event helper on SessionPorts (RPC-SEC-ANON-EVENT-HELPER).
  assert(typeof session.appendSessionEvent !== 'function', 'no public event helper');
  assert(typeof session.commands.apply === 'function', 'apply is the only write path');

  db.close();
  console.log('PASS rpc-session-runtime.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
}
