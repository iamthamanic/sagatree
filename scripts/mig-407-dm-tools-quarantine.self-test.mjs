#!/usr/bin/env node
/**
 * mig-407-dm-tools-quarantine.self-test — preserve 404; isolate fixtures (#823).
 * Location: scripts/mig-407-dm-tools-quarantine.self-test.mjs
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

const modUrl = pathToFileURL(join(root, 'server/src/modules/session/index.ts')).href;
const {
  DM_TOOLS_PUBLIC_ACTIVATION_AUTHORIZED,
  DM_TOOLS_REDIS_PROVIDES_PERSISTENCE,
  acceptUnauthenticatedCombatAuthority,
  applyDamage,
  createSeededRng,
  endCombat,
  initCombat,
  nextTurn,
  parseDiceNotation,
  rollDice,
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

// --- Fall 1: dispatcher + host 404 including dice/health ---
assert(DM_TOOLS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'activation denied');
assert(isEdgeDispatcherAllowed('dm-tools') === false, 'allowlist deny');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('dm-tools'), 'not in allowlist values');

await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of ['/dm-tools', '/dm-tools/dice', '/dm-tools/health', '/functions/v1/dm-tools']) {
    for (const method of ['GET', 'POST', 'OPTIONS']) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: method === 'POST' ? { 'content-type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify({ notation: 'd20' }) : undefined,
      });
      assert(res.status === 404, `${method} ${path} → 404, got ${res.status}`);
    }
  }
});

// --- Fall 2: seeded dice + combat fixtures ---
const parsed = parseDiceNotation('2d6+3');
assert(parsed.count === 2 && parsed.sides === 6 && parsed.modifier === 3, 'notation parse');

const rngAdv = createSeededRng(42);
const adv = rollDice('d20', 0, 'adv', rngAdv);
assert(adv.rolls.length === 1 && adv.advantage === 'adv', 'd20 advantage keeps one');

const rngMod = createSeededRng(7);
const withMod = rollDice('d20', 5, null, rngMod);
assert(withMod.modifier === 5 && withMod.total === withMod.rolls[0] + 5, 'call-site modifier');
assert(withMod.details.includes('+'), 'details include modifier');

const rngCombat = createSeededRng(99);
const combat = initCombat(
  'sess-1',
  [
    { id: 'p1', name: 'A', hp: 10, maxHp: 10, initiativeBonus: 5, conditions: [] },
    { id: 'p2', name: 'B', hp: 8, maxHp: 8, initiativeBonus: 0, conditions: [] },
  ],
  rngCombat,
  '2026-01-01T00:00:00.000Z',
  'combat-1',
);
assert(combat.log[0]?.type === 'combat_start', 'combat_start log');
assert(
  combat.participants[0].initiative >= combat.participants[1].initiative,
  'initiative descending',
);

const afterNext = nextTurn(combat, '2026-01-01T00:00:01.000Z');
assert(afterNext.log.some((e) => e.type === 'turn_start'), 'turn_start log');
const afterRound = nextTurn(afterNext, '2026-01-01T00:00:02.000Z');
assert(afterRound.round === 2 && afterRound.log.some((e) => e.type === 'round_start'), 'next-round log');

const ended = endCombat(afterRound, '2026-01-01T00:00:03.000Z');
assert(ended.status === 'ended' && ended.log.some((e) => e.type === 'combat_end'), 'end-combat log');

// --- Fall 3: invalid notation / missing target → isolated 500-shaped errors ---
let invalidThrown = false;
try {
  parseDiceNotation('not-dice');
} catch (e) {
  invalidThrown = e instanceof Error && /Invalid dice notation/.test(e.message);
}
assert(invalidThrown, 'invalid notation throws');

let missingTarget = false;
try {
  applyDamage(combat, 'missing', 5, '2026-01-01T00:00:00.000Z');
} catch (e) {
  missingTarget = e instanceof Error && /Target not found/.test(e.message);
}
assert(missingTarget, 'missing target throws');
assert(DM_TOOLS_REDIS_PROVIDES_PERSISTENCE === false, 'no durable Redis claim');

// --- Fall 4: unauthenticated authority + unbounded dice count ---
const auth = acceptUnauthenticatedCombatAuthority({ sessionId: 's', characterId: 'c' });
assert(auth.authenticated === false, 'no auth');

const huge = parseDiceNotation('9999d6');
assert(huge.count === 9999, 'unbounded dice-count accepted by parser');

const legacySrc = readFileSync(join(root, 'supabase/functions/dm-tools/index.ts'), 'utf8');
assert(/REDIS_URL/.test(legacySrc) && !/createClient|ioredis|new Redis/.test(legacySrc), 'REDIS_URL unused');
assert(DM_TOOLS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'unsuitable for activation');

console.log('PASS mig-407-dm-tools-quarantine.self-test');
