#!/usr/bin/env node
/**
 * mig-423-spellbook-quarantine.self-test — preserve 404; isolate fixtures (#839).
 * Location: scripts/mig-423-spellbook-quarantine.self-test.mjs
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const modUrl = pathToFileURL(join(root, 'server/src/modules/character/index.ts')).href;
const {
  SPELLBOOK_EDGE_MAP_IS_DURABLE,
  SPELLBOOK_EDGE_PUBLIC_ACTIVATION_AUTHORIZED,
  castQuarantineSpell,
  characterIdPathIsNotAuthority,
  createQuarantineSpell,
  createSpellbookEdgeQuarantineStore,
  describeSpellbookEdgeLegacyDefects,
  getQuarantineSpell,
  getQuarantineSpellbook,
  learnQuarantineSpell,
  listQuarantineSpells,
  prepareQuarantineSpell,
  restoreQuarantineSpellSlots,
  unprepareQuarantineSpell,
} = await import(modUrl);

const allowUrl = pathToFileURL(
  join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
).href;
const { isEdgeDispatcherAllowed, EDGE_DISPATCHER_ALLOWLIST } = await import(allowUrl);
const { createRouteHandler } = await import(
  pathToFileURL(join(root, 'server/src/http/route-registry.ts')).href
);

function stubDeps(extra = {}) {
  return {
    health: { execute: () => ({ ready: true, mode: 'solo', dataDirFingerprint: 't' }) },
    ops: {
      getHealth: () => ({ ready: true, mode: 'solo', dataDirFingerprint: 't' }),
      acceptMutations: () => true,
    },
    permissions: { authorize: () => ({ allow: true, reason: 'test' }) },
    identity: {
      resolveSoloActor: () => ({ kind: 'solo-local', actorId: 'test' }),
      resolveRemoteSession: async () => ({ ok: false, code: 'AUTH_NOT_CONFIGURED' }),
      linkSoloToRemoteAccount: () => ({ ok: false, code: 'INVALID_LINK_REQUEST' }),
    },
    transport: {
      applyCommand: () => ({ ok: false, error: 'INVALID_PAYLOAD' }),
      getSnapshot: () => ({ ok: false, error: 'INVALID_PAYLOAD' }),
    },
    recordPing: () => ({ ok: true }),
    authHandlerRef: { current: null },
    tryAuthorizedProjectTouch: () => ({ ok: false, status: 403, error: 'test' }),
    tryAuthorizedWorldTouch: () => ({ ok: false, status: 403, error: 'test' }),
    ...extra,
  };
}

async function withHandler(deps, fn) {
  const handler = createRouteHandler(deps);
  const server = createServer((req, res) => {
    void Promise.resolve(handler(req, res));
  });
  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve).on('error', reject);
  });
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

assert(SPELLBOOK_EDGE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'activation denied');
assert(SPELLBOOK_EDGE_MAP_IS_DURABLE === false, 'Map not durable');
assert(isEdgeDispatcherAllowed('spellbook') === false, 'allowlist deny');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('spellbook'), 'not in allowlist');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/functions\/v1\/spellbook/i.test(createApp), 'create-app has no Edge functions/v1/spellbook mount');
assert(
  !/app\.(get|post|put|delete|all)\(\s*['"`]\/spellbook/i.test(createApp),
  'create-app has no bare /spellbook Edge mount',
);
assert(
  !/app\.(get|post|put|delete|all)\(\s*['"`]\/spells/i.test(createApp),
  'create-app has no bare /spells Edge mount',
);
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(
  !/functions\/v1\/spellbook|(?:^|[^/])\/spellbook(?:\/|['"`])/m.test(routeRegistry),
  'route-registry has no Edge spellbook mount',
);
assert(!/['"`]\/spells(?:\/|['"`])/m.test(routeRegistry), 'route-registry has no /spells Edge mount');

// Fall 1: all spellbook routes remain dispatcher/host 404
await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/spellbook',
    '/spellbook/char-1',
    '/spellbook/char-1/learn',
    '/spellbook/char-1/prepare',
    '/spellbook/char-1/unprepare',
    '/spellbook/char-1/cast',
    '/spellbook/char-1/restore',
    '/spells',
    '/spells/fireball',
    '/functions/v1/spellbook',
    '/functions/v1/spellbook/health',
    '/functions/v1/spellbook/spells',
    '/functions/v1/spellbook/spellbook/char-1',
  ]) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers:
          method === 'POST' || method === 'PUT' ? { 'content-type': 'application/json' } : undefined,
        body: method === 'POST' || method === 'PUT' ? JSON.stringify({}) : undefined,
      });
      assert(res.status === 404, `${method} ${path} → 404, got ${res.status}`);
    }
  }
});

// Fall 2: isolated Map seed / learn / prepare / cast / restore shapes
{
  const store = createSpellbookEdgeQuarantineStore();
  assert(store.spells.size === 10, 'SRD seed size 10');
  assert(getQuarantineSpell(store, 'fireball')?.level === 3, 'fireball seeded');

  const wiz = listQuarantineSpells(store, { classFilter: 'Wizard' });
  assert(wiz.some((s) => s.id === 'fireball'), 'class filter lowercases');
  const lvl1 = listQuarantineSpells(store, { level: 1 });
  assert(lvl1.every((s) => s.level === 1) && lvl1.length >= 4, 'level filter');
  const abj = listQuarantineSpells(store, { school: 'abjuration' });
  assert(abj.every((s) => s.school === 'abjuration'), 'school filter');

  const other = createSpellbookEdgeQuarantineStore();
  assert(other.spellbooks.size === 0, 'another process/store starts empty spellbooks');
  // seeds exist per store but custom spells do not cross
  createQuarantineSpell(store, { name: 'Custom Bolt', level: 0 }, 'custom-bolt');
  assert(getQuarantineSpell(other, 'custom-bolt') === null, 'cross-store custom lost');

  let threw = false;
  try {
    createQuarantineSpell(store, { name: 'Dup' }, 'custom-bolt');
  } catch (e) {
    threw = e instanceof Error && e.message === 'Spell already exists';
  }
  assert(threw, 'duplicate fixture spell id rejected');

  const auto = createQuarantineSpell(store, { name: 'Auto Id Spell', level: 0 });
  assert(
    typeof auto.id === 'string' && auto.id.length >= 32 && auto.id !== 'custom-bolt',
    'auto id uses randomUUID Edge parity',
  );

  const book = getQuarantineSpellbook(store, 'char-a');
  assert(book.spells.length === 0 && book.characterId === 'char-a', 'GET creates empty book');
  assert(store.spellbooks.has('char-a'), 'side-effecting read stores book');

  learnQuarantineSpell(store, 'char-a', 'fireball');
  learnQuarantineSpell(store, 'char-a', 'fireball'); // idempotent
  assert(store.spellbooks.get('char-a').spells.length === 1, 'learn once');
  prepareQuarantineSpell(store, 'char-a', 'fireball');
  assert(store.spellbooks.get('char-a').spells[0].prepared === true, 'prepare');
  unprepareQuarantineSpell(store, 'char-a', 'fireball');
  assert(store.spellbooks.get('char-a').spells[0].prepared === false, 'unprepare');

  // Edge parity: cast without knowing/preparing still burns slots
  const r1 = castQuarantineSpell(store, 'char-b', 'nonexistent', 1);
  assert(r1.success === true && r1.remaining === 3, 'cast ignores spell existence');
  for (let i = 0; i < 3; i += 1) castQuarantineSpell(store, 'char-b', 'x', 1);
  const rFull = castQuarantineSpell(store, 'char-b', 'x', 1);
  assert(rFull.success === false && rFull.remaining === 0, 'level1 slots exhausted at 4');

  restoreQuarantineSpellSlots(store, 'char-b');
  assert(Object.keys(store.spellbooks.get('char-b').slotsUsed).length === 0, 'restore clears');
  const rAfter = castQuarantineSpell(store, 'char-b', 'x', 1);
  assert(rAfter.success === true && rAfter.remaining === 3, 'slots usable after restore');
}

// Fall 3: path/body fields are not authority; durable character ports must not call this worker
{
  const authority = characterIdPathIsNotAuthority();
  assert(authority.some((d) => /characterId/i.test(d)), 'characterId not auth');
  assert(authority.some((d) => /spellId|level/i.test(d)), 'body fields not auth');

  const membership = readFileSync(
    join(root, 'server/src/modules/character/internal/character-membership-store.ts'),
    'utf8',
  );
  assert(
    !/spellbook-edge-quarantine|SpellbookEdgeQuarantine|createSpellbookEdgeQuarantineStore/.test(
      membership,
    ),
    'membership store does not call Edge spellbook quarantine',
  );
}

// Fall 4: legacy defects documented
{
  const defects = describeSpellbookEdgeLegacyDefects();
  assert(defects.some((d) => /membership|GM|owner|identity/i.test(d)), 'auth defect listed');
  assert(defects.some((d) => /durable|Map/i.test(d)), 'durability defect listed');
  assert(defects.some((d) => /cast|prepared|known/i.test(d)), 'cast defect listed');
}

console.log('PASS mig-423-spellbook-quarantine.self-test');
