#!/usr/bin/env node
/**
 * mig-417-npcs-quarantine.self-test — preserve 404; isolate fixtures (#833).
 * Location: scripts/mig-417-npcs-quarantine.self-test.mjs
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const modUrl = pathToFileURL(join(root, 'server/src/modules/npc-creature/index.ts')).href;
const {
  NPCS_MAP_IS_NPC_CREATURE_POLICY,
  NPCS_PUBLIC_ACTIVATION_AUTHORIZED,
  NPC_CLASSES,
  NPC_DISPOSITIONS,
  NPC_LOCATIONS,
  applyNpcCreateDefaults,
  applyNpcImportDefaults,
  buildDialogueLine,
  createSeededRng,
  describeNpcsLegacyDefects,
  generateNpc,
  generateStats,
  parseNpcStats,
  setRelationship,
  sliceMemories,
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

// --- Fall 1: dispatcher + host keep npcs unmounted ---
assert(NPCS_PUBLIC_ACTIVATION_AUTHORIZED === false, 'public activation denied');
assert(isEdgeDispatcherAllowed('npcs') === false, 'isEdgeDispatcherAllowed(npcs) false');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('npcs'), 'npcs absent from allowlist');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/\/npcs|functions\/v1\/npcs/i.test(createApp), 'create-app has no npcs route');
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(!/\/npcs|functions\/v1\/npcs/.test(routeRegistry), 'route-registry has no npcs route');

await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/npcs',
    '/npcs/generate',
    '/npcs/import',
    '/npcs/x',
    '/npcs/x/memory',
    '/npcs/x/memories',
    '/npcs/x/relationship',
    '/npcs/x/relationships',
    '/npcs/x/dialogue',
    '/npcs/x/dialogues',
    '/npcs/x/export',
    '/functions/v1/npcs',
    '/functions/v1/npcs/generate',
    '/functions/v1/npcs/import',
    '/functions/v1/npcs/x/memory',
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

// --- Fall 2: defaults, ranges, memory slice, relationships, dialogue ---
const now = '2026-01-01T00:00:00.000Z';
const rng = createSeededRng(42);
const defaults = applyNpcCreateDefaults({}, 'npc-1', now, rng);
assert(defaults.name === 'Unknown' && defaults.type === 'npc', 'defaults identity');
assert(defaults.race === 'human' && defaults.class === 'commoner' && defaults.level === 1, 'defaults race/class/level');
assert(defaults.hp === 10 && defaults.maxHp === 10 && defaults.ac === 10 && defaults.speed === 30, 'defaults combat');
assert(defaults.disposition === 'neutral' && defaults.location === 'Unknown', 'defaults disposition/location');
assert(Array.isArray(defaults.memories) && defaults.memories.length === 0, 'empty memories');
assert(JSON.stringify(defaults.relationships) === '{}', 'empty relationships');
assert(defaults.description.length > 0, 'create fills empty description');
assert(
  defaults.stats.strength >= 3 &&
    defaults.stats.strength <= 17 &&
    defaults.stats.charisma >= 3 &&
    defaults.stats.charisma <= 17,
  'stats range 3..17',
);

const imported = applyNpcImportDefaults({}, 'npc-imp', now, createSeededRng(7));
assert(imported.description === '', 'import keeps empty description');

const genRng = createSeededRng(99);
const gen = generateNpc({ prompt: 'CALL_EXTERNAL_PROVIDER_PLEASE' }, 'gen-1', now, genRng);
assert(gen.level >= 1 && gen.level <= 10, `level range got ${gen.level}`);
assert(gen.ac >= 12 && gen.ac <= 17, `ac range got ${gen.ac}`);
assert(NPC_CLASSES.includes(gen.class) || gen.class === 'commoner', 'generated class from catalog or fallback');
assert(NPC_DISPOSITIONS.includes(gen.disposition), 'generated disposition');
assert(NPC_LOCATIONS.includes(gen.location) || gen.location === 'Unknown', 'generated location');
assert(typeof gen.description === 'string' && gen.description.length > 0, 'generated description');

const mem = ['a', 'b', 'c', 'd', 'e'];
assert(JSON.stringify(sliceMemories(mem, 10)) === JSON.stringify(mem), 'limit ≥ length returns all');
assert(JSON.stringify(sliceMemories(mem, 2)) === JSON.stringify(['d', 'e']), 'slice from end');
assert(JSON.stringify(sliceMemories(mem, undefined)) === JSON.stringify(mem), 'undefined limit = all');

const rel1 = setRelationship({}, 't1', 'ally');
const rel2 = setRelationship(rel1, 't1', 'rival');
assert(rel2.t1 === 'rival' && Object.keys(rel2).length === 1, 'relationship replacement');

const dialogue = buildDialogueLine('npc-1', 'dlg-gen', {
  trigger: 'greet',
  text: 'Hello',
  tags: ['intro'],
  responses: [{ text: 'Hi' }],
});
assert(dialogue.id === 'dlg-gen' && dialogue.npcId === 'npc-1', 'dialogue identity');
assert(dialogue.trigger === 'greet' && dialogue.text === 'Hello', 'dialogue body');
assert(Array.isArray(dialogue.tags) && dialogue.tags[0] === 'intro', 'dialogue tags');
assert(Array.isArray(dialogue.responses) && dialogue.responses[0].text === 'Hi', 'dialogue responses');

// --- Fall 3: prompt unused; Map ≠ npc_creature policy ---
assert(NPCS_MAP_IS_NPC_CREATURE_POLICY === false, 'Map is not npc_creature policy');
const quarantineSrc = readFileSync(
  join(root, 'server/src/modules/npc-creature/internal/npcs-quarantine.ts'),
  'utf8',
);
assert(
  !/from ['"].*npc-instance-store|FROM npc_creature_|TABLE_OWNERSHIP|openDatabase|fetch\(|['"]ollama|['"]openai/i.test(
    quarantineSrc,
  ),
  'quarantine does not wire durable npc_creature or external providers',
);
assert(
  /NPCS_MAP_IS_NPC_CREATURE_POLICY = false/.test(quarantineSrc),
  'explicit Map≠npc_creature policy flag',
);
assert(
  !existsSync(join(root, 'server/src/modules/npc-creature/internal/npcs-http-mount.ts')),
  'no accidental HTTP mount file',
);
const genSrcMarker = quarantineSrc.includes('void options.prompt') || quarantineSrc.includes('options.prompt');
assert(genSrcMarker, 'prompt accepted in signature');
// Same seed with/without prompt must match (prompt unused)
const a = generateNpc({ prompt: 'A' }, 'p1', now, createSeededRng(123));
const b = generateNpc({ prompt: 'B' }, 'p1', now, createSeededRng(123));
const c = generateNpc({}, 'p1', now, createSeededRng(123));
assert(a.name === b.name && b.name === c.name, 'prompt does not affect generation');
assert(a.level === c.level && a.ac === c.ac, 'prompt unused for combat rolls');

// --- Fall 4: legacy defects ---
const overridden = buildDialogueLine('npc-real', 'dlg-generated', {
  id: 'attacker-id',
  npcId: 'attacker-npc',
  trigger: 'x',
  text: 'y',
  tags: [],
});
assert(overridden.id === 'attacker-id' && overridden.npcId === 'attacker-npc', 'spread overrides id/npcId');
const defects = describeNpcsLegacyDefects();
assert(defects.length >= 3, 'legacy defects documented');
assert(defects.some((d) => /prompt/i.test(d)), 'prompt defect listed');
assert(defects.some((d) => /auth|ownership/i.test(d)), 'auth defect listed');
assert(defects.some((d) => /spread|override/i.test(d)), 'spread defect listed');

const statsSample = generateStats(createSeededRng(1));
for (const v of Object.values(statsSample)) {
  assert(v >= 3 && v <= 17, `stat ${v} in 3..17`);
}

const badStats = parseNpcStats({ strength: 'hoch' }, createSeededRng(2));
assert(typeof badStats.strength === 'number' && Number.isFinite(badStats.strength), 'bad stats regenerate');
const goodStats = parseNpcStats(
  { strength: 10, dexterity: 11, constitution: 12, intelligence: 13, wisdom: 14, charisma: 15 },
  createSeededRng(3),
);
assert(goodStats.charisma === 15, 'valid stats accepted');

const protoRace = generateNpc({ race: 'constructor' }, 'proto', now, createSeededRng(5));
assert(typeof protoRace.name === 'string' && protoRace.name.length > 0, 'constructor race falls back');
const protoRace2 = generateNpc({ race: '__proto__' }, 'proto2', now, createSeededRng(6));
assert(typeof protoRace2.name === 'string' && protoRace2.name.length > 0, '__proto__ race falls back');

console.log('PASS mig-417-npcs-quarantine.self-test');
