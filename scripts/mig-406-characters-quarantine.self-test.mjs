#!/usr/bin/env node
/**
 * mig-406-characters-quarantine.self-test — preserve 404; isolate fixtures (#822).
 * Location: scripts/mig-406-characters-quarantine.self-test.mjs
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
  CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED,
  addExperienceLegacyUnsafe,
  applyCharacterUpdate,
  createCharacterRecord,
  describeNonAdvancingXpLoopDefect,
  getXpThreshold,
  mergeNestedPartial,
  resolveLevelUpTargetId,
} = await import(modUrl);

const allowUrl = pathToFileURL(
  join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
).href;
const { isEdgeDispatcherAllowed, EDGE_DISPATCHER_ALLOWLIST } = await import(allowUrl);

const routeUrl = pathToFileURL(join(root, 'server/src/http/route-registry.ts')).href;
const { createRouteHandler } = await import(routeUrl);

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

// --- Fall 1: dispatcher + host keep characters unmounted ---
assert(CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'public activation denied');
assert(isEdgeDispatcherAllowed('characters') === false, 'isEdgeDispatcherAllowed(characters) false');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('characters'), 'characters absent from allowlist values');

const characterPaths = [
  '/characters',
  '/characters/c1',
  '/characters/c1/experience',
  '/characters/import',
  '/functions/v1/characters',
];

await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of characterPaths) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: method === 'POST' || method === 'PUT' ? { 'content-type': 'application/json' } : undefined,
        body: method === 'POST' || method === 'PUT' ? JSON.stringify({ ownerId: 'x' }) : undefined,
      });
      assert(res.status === 404, `${method} ${path} must be 404 without trustedOrigins, got ${res.status}`);
    }
  }
});

// Global CORS preflight (trustedOrigins nonempty) returns 204 for ANY path — not a characters mount.
await withHandler(stubDeps({ trustedOrigins: ['http://localhost:5173'] }), async (base) => {
  const preflight = await fetch(`${base}/characters`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST' },
  });
  assert(preflight.status === 204, `global OPTIONS preflight is 204, got ${preflight.status}`);
  const getRes = await fetch(`${base}/characters`, {
    headers: { Origin: 'http://localhost:5173' },
  });
  assert(getRes.status === 404, `GET /characters still 404 with CORS, got ${getRes.status}`);
  const importRes = await fetch(`${base}/characters/import`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ ownerId: 'cross-owner', name: 'Imported' }),
  });
  assert(importRes.status === 404, `cross-owner import POST remains 404, got ${importRes.status}`);
});

// --- Fall 2: PUT ownerId overwrite + level-up body.characterId ---
const base = createCharacterRecord({
  id: 'c1',
  ownerId: 'owner-a',
  name: 'Hero',
  nowIso: '2026-01-01T00:00:00.000Z',
});
const overwritten = applyCharacterUpdate(
  base,
  { ownerId: 'attacker', name: 'Stolen' },
  'c1',
  '2026-01-02T00:00:00.000Z',
);
assert(overwritten.ownerId === 'attacker', 'PUT shallow spread overwrites ownerId');
assert(overwritten.id === 'c1', 'path id forced');
assert(overwritten.name === 'Stolen', 'other fields updated');

const pathId = 'path-char';
const bodyTarget = resolveLevelUpTargetId(pathId, { characterId: 'body-char' });
assert(bodyTarget === 'body-char', 'level-up uses body.characterId not path');
assert(bodyTarget !== pathId, 'path id ignored for level-up target');

// Neither becomes a successor authorization rule
assert(CHARACTERS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no successor auth from these fixtures');

// --- Fall 3 / 4: non-advancing loop identified; XP-at-threshold only with hard guard ---
const defect = describeNonAdvancingXpLoopDefect();
assert(defect.nextLevelAdvances === false && defect.nextThresholdAdvances === false, 'const never advance');
assert(defect.canLoopIndefinitelyAtThreshold === true, 'indefinite loop at threshold');

const legacySrc = readFileSync(join(root, 'supabase/functions/characters/index.ts'), 'utf8');
const addExpFn = legacySrc.slice(
  legacySrc.indexOf('async function addExperience'),
  legacySrc.indexOf('async function levelUp'),
);
assert(
  /const nextLevel = character\.level \+ 1/.test(addExpFn) &&
    /const nextThreshold = getXPThreshold\(nextLevel\)/.test(addExpFn) &&
    /while \(character\.experience >= nextThreshold && nextLevel <= 20\)/.test(addExpFn),
  'source check: non-advancing addExperience loop present in legacy worker',
);
const whileBody = addExpFn.slice(addExpFn.indexOf('while ('), addExpFn.indexOf('character.updatedAt'));
assert(
  !/nextLevel\s*\+\+|nextLevel\s*=|nextThreshold\s*=/.test(whileBody.replace(/^while[^{]*\{/, '')),
  'source check: loop body does not advance nextLevel/nextThreshold',
);

const atThreshold = createCharacterRecord({
  id: 'c2',
  ownerId: 'owner-a',
  name: 'Stuck',
  nowIso: '2026-01-01T00:00:00.000Z',
});
atThreshold.level = 1;
atThreshold.experience = 0;
const hangProbe = addExperienceLegacyUnsafe(atThreshold, getXpThreshold(2), { maxIterations: 50 });
assert(hangProbe.stoppedByGuard === true, 'XP-at-threshold stops only via hard iteration guard');
assert(hangProbe.leveledUp === true, 'entered level-up branch before guard');

// Below threshold must terminate without guard
const below = createCharacterRecord({
  id: 'c3',
  ownerId: 'owner-a',
  name: 'Safe',
  nowIso: '2026-01-01T00:00:00.000Z',
});
const safe = addExperienceLegacyUnsafe(below, 10, { maxIterations: 50 });
assert(safe.stoppedByGuard === false && safe.character.experience === 10, 'sub-threshold terminates');
assert(safe.character.level === 1 && safe.leveledUp === false, 'no level change below threshold');

// --- Fall 5: no auth; client ownerId; nested fields unvalidated (characterization) ---
const forged = createCharacterRecord({
  id: 'c4',
  ownerId: 'client-supplied-owner',
  name: 'Forged',
  nowIso: '2026-01-01T00:00:00.000Z',
  attributes: { strength: 'not-a-number', nested: { oops: true } },
  equipment: 'not-an-array',
  proficiencies: { languages: 123 },
});
assert(forged.ownerId === 'client-supplied-owner', 'client supplies ownerId without auth');
assert(forged.attributes?.strength === 'not-a-number', 'malformed nested attributes accepted');
assert(forged.equipment === 'not-an-array', 'malformed equipment accepted without schema');
assert(forged.proficiencies?.languages === 123, 'malformed proficiencies accepted');

const merged = mergeNestedPartial(
  { attributes: { strength: 10 }, equipment: [] },
  { attributes: null, equipment: { bad: true } },
);
assert(merged.attributes === null, 'nested partial overwrites without validating attributes');
assert(merged.equipment?.bad === true, 'nested partial overwrites without validating equipment');

console.log('PASS mig-406-characters-quarantine.self-test');
