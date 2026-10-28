#!/usr/bin/env node
/**
 * mig-405-character-lore.self-test — host isolated-contract (#821).
 * Location: scripts/mig-405-character-lore.self-test.mjs
 */
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

function actor(id) {
  return { kind: 'solo-local', actorId: id };
}

const modUrl = pathToFileURL(
  join(root, 'server/src/modules/character/character-lore.ts'),
).href;
const appUrl = pathToFileURL(
  join(root, 'server/src/application/character-lore/index.ts'),
).href;
const allowUrl = pathToFileURL(
  join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
).href;

const [mod, app, allow] = await Promise.all([
  import(modUrl),
  import(appUrl),
  import(allowUrl),
]);
const {
  CHARACTER_LORE_DEFAULT_RATE_LIMIT,
  CHARACTER_LORE_MAX_REQUEST_BYTES,
  CHARACTER_LORE_MAX_STORY_LENGTH,
  CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED,
  CHARACTER_LORE_RATE_WINDOW_SECONDS,
  canUseWorldLoreReference,
  characterLoreMinimalContext,
  checkCharacterLoreBodySize,
  createCharacterLoreStore,
  describeCharacterLoreAuthDenialLegacyDefect,
  errorPayloadContainsSecrets,
  parseCharacterLoreRequestBody,
  resolveCharacterLoreProviderConfig,
  stripCharacterLoreSecrets,
} = mod;
const { createCharacterLoreUseCases } = app;
const { isEdgeDispatcherAllowed } = allow;

assert(CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no public activation');
assert(isEdgeDispatcherAllowed('character-lore') === true, 'edge stays allowlisted');
assert(CHARACTER_LORE_DEFAULT_RATE_LIMIT === 6, 'quota 6');
assert(CHARACTER_LORE_RATE_WINDOW_SECONDS === 60, 'window 60s');
assert(CHARACTER_LORE_MAX_REQUEST_BYTES === 128_000, '128k body');
assert(CHARACTER_LORE_MAX_STORY_LENGTH === 12_000, 'story max 12k');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/character-lore/i.test(createApp), 'create-app has no character-lore cutover mount');

const OWNER = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const STRANGER = '33333333-3333-4333-8333-333333333333';
const GM = '44444444-4444-4444-8444-444444444444';
const PROJECT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WORLD_OWNED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORLD_PRIVATE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const WORLD_MISMATCH = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const projects = new Map([
  [
    PROJECT_ID,
    {
      id: PROJECT_ID,
      name: 'Border Saga',
      description: 'A frontier campaign',
      worldId: WORLD_OWNED,
      gmUserId: GM,
    },
  ],
]);
const worlds = new Map([
  [
    WORLD_OWNED,
    {
      id: WORLD_OWNED,
      creatorUserId: GM,
      name: 'Frontier',
      lore: 'Ancient border stones watch the pass.',
      settingType: 'fantasy',
      isPublic: false,
    },
  ],
  [
    WORLD_PRIVATE,
    {
      id: WORLD_PRIVATE,
      creatorUserId: STRANGER,
      name: 'Secret Realm',
      lore: 'Classified lore that must not leak.',
      settingType: 'dark',
      isPublic: false,
    },
  ],
  [
    WORLD_MISMATCH,
    {
      id: WORLD_MISMATCH,
      creatorUserId: GM,
      name: 'Other World',
      lore: 'Wrong world for project.',
      settingType: 'fantasy',
      isPublic: true,
    },
  ],
]);
const members = new Set([`${PROJECT_ID}:${MEMBER}`]);

function makeReferences() {
  return {
    getProject: async (id) => projects.get(id) ?? null,
    isActiveMember: async (projectId, userId) => members.has(`${projectId}:${userId}`),
    getWorld: async (id) => worlds.get(id) ?? null,
  };
}

const STORY =
  'In den Grenzlanden wuchs Aria unter dem Schatten alter Steine auf. ' +
  'Ihre Neugier trieb sie über den Pass, und die Freiheit der Wälder wurde ihr Ideal.';

async function fakeGenerate(config, prompt) {
  assert(config.model === 'test-model', 'model passed');
  assert(prompt.version === 'character-background-v1', 'prompt version');
  assert(!prompt.user.includes('sk-secret'), 'prompt has no secret');
  return STORY;
}

function makeUc(storeOpts = {}) {
  const store = createCharacterLoreStore(storeOpts.persistent !== false);
  if (storeOpts.persistent === false) store.persistentStoreAvailable = false;
  return createCharacterLoreUseCases({
    store,
    references: makeReferences(),
    resolveProvider: async (userId) => {
      assert(typeof userId === 'string' && userId.length > 0, 'provider scoped to caller');
      if (storeOpts.noProvider) return null;
      if (storeOpts.perUserModel) {
        return {
          provider: 'ollama',
          baseUrl: 'http://ollama:11434',
          model: `model-for-${userId}`,
        };
      }
      return { provider: 'ollama', baseUrl: 'http://ollama:11434', model: 'test-model' };
    },
    generateStory: storeOpts.generateStory ?? fakeGenerate,
    rateLimitPerMinute: storeOpts.limit,
    nowMs: storeOpts.nowMs,
  });
}

// --- Access helper unit pin ---
assert(
  canUseWorldLoreReference({ creatorUserId: OWNER, isPublic: false }, OWNER) === true,
  'owner direct private world ok',
);
assert(
  canUseWorldLoreReference({ creatorUserId: STRANGER, isPublic: false }, OWNER) === false,
  'stranger private world denied',
);
assert(
  canUseWorldLoreReference({ creatorUserId: GM, isPublic: false }, MEMBER, GM) === true,
  'project GM owns private world for member path',
);
assert(
  canUseWorldLoreReference({ creatorUserId: STRANGER, isPublic: false }, MEMBER, GM) === false,
  'member cannot use unrelated private world via project',
);

// --- Fall 1: owner direct-world + active member project world; deny private/mismatch before provider ---
{
  const uc = makeUc();
  const ownerRes = await uc.generate(actor(OWNER), {
    contentLengthHeader: '200',
    body: characterLoreMinimalContext({ worldId: WORLD_OWNED }),
  });
  // OWNER is not world creator (GM is) and world is private → deny (legacy 500)
  assert(ownerRes.status === 'error' && ownerRes.httpStatus === 500, 'non-owner private world → 500');
  assert(uc.store.providerInvocations === 0, 'denied before provider (owner private)');

  // Owner of world (GM) direct reference
  const gmDirect = await uc.generate(actor(GM), {
    contentLengthHeader: '200',
    body: characterLoreMinimalContext({ worldId: WORLD_OWNED }),
  });
  assert(gmDirect.status === 'ok' && gmDirect.story === STORY, 'GM direct-world generate');
  assert(uc.store.charactersMutations === 0, 'no characters mutation');

  const memberRes = await uc.generate(actor(MEMBER), {
    contentLengthHeader: '200',
    body: characterLoreMinimalContext({ projectId: PROJECT_ID, worldId: WORLD_OWNED }),
  });
  assert(memberRes.status === 'ok', 'active member GM-owned project world generate');

  const beforePriv = uc.store.providerInvocations;
  const privDeny = await uc.generate(actor(MEMBER), {
    contentLengthHeader: '200',
    body: characterLoreMinimalContext({ worldId: WORLD_PRIVATE }),
  });
  assert(privDeny.status === 'error' && privDeny.httpStatus === 500, 'unrelated private → 500');
  assert(uc.store.providerInvocations === beforePriv, 'private deny before provider');

  const beforeMis = uc.store.providerInvocations;
  const mismatch = await uc.generate(actor(MEMBER), {
    contentLengthHeader: '200',
    body: characterLoreMinimalContext({ projectId: PROJECT_ID, worldId: WORLD_MISMATCH }),
  });
  assert(mismatch.status === 'error' && mismatch.httpStatus === 500, 'mismatched world → 500');
  assert(uc.store.providerInvocations === beforeMis, 'mismatch before provider');
}

// --- Fall 2: 128001 body; clamps; ruleset/UUID rejects ---
{
  const tooBig = checkCharacterLoreBodySize(String(CHARACTER_LORE_MAX_REQUEST_BYTES + 1));
  assert(tooBig.ok === false && tooBig.status === 413, '128001 header rejected');
  const decoded = checkCharacterLoreBodySize('100', CHARACTER_LORE_MAX_REQUEST_BYTES + 1);
  assert(decoded.ok === false && decoded.status === 413, '128001 decoded rejected');

  const longName = 'x'.repeat(200);
  const parsed = parseCharacterLoreRequestBody(
    characterLoreMinimalContext({ name: longName, level: 99, attributes: { strength: 99 } }),
  );
  assert(parsed !== null, 'parse ok with clamps');
  assert(parsed.context.name.length === 120, 'name clamped 120');
  assert(parsed.context.level === 20, 'level clamped 20');
  assert(parsed.context.attributes.strength === 30, 'attr clamped 30');

  assert(parseCharacterLoreRequestBody(characterLoreMinimalContext({ ruleset: 'bogus' })) === null, 'bad ruleset');
  assert(
    parseCharacterLoreRequestBody(
      characterLoreMinimalContext({ projectId: 'not-a-uuid' }),
    ) === null,
    'bad UUID rejected',
  );
}

// --- Fall 3: provider absence → not-configured; no mutation ---
{
  const uc = makeUc({ noProvider: true });
  const beforeRef = uc.store.referenceLookups;
  const res = await uc.generate(actor(GM), {
    contentLengthHeader: '200',
    body: characterLoreMinimalContext({ worldId: WORLD_OWNED }),
  });
  assert(res.status === 'not-configured' && res.httpStatus === 200, 'not-configured 200');
  assert(uc.store.referenceLookups === beforeRef, 'no lore lookup when unconfigured');
  assert(uc.store.providerInvocations === 0, 'no provider call');
  assert(uc.store.charactersMutations === 0, 'no characters mutation');
}

// --- Fall 4: 7th request → 429; missing store → 503 before provider ---
{
  const now = 1_700_000_000_000;
  const uc = makeUc({ nowMs: now, limit: 6 });
  for (let i = 0; i < 6; i += 1) {
    const r = await uc.generate(actor(GM), {
      contentLengthHeader: '50',
      body: characterLoreMinimalContext(),
    });
    assert(r.status === 'ok', `request ${i + 1} ok`);
  }
  const seventh = await uc.generate(actor(GM), {
    contentLengthHeader: '50',
    body: characterLoreMinimalContext(),
  });
  assert(seventh.status === 'error' && seventh.httpStatus === 429, '7th → 429');

  const down = makeUc({ persistent: false });
  const unavailable = await down.generate(actor(GM), {
    contentLengthHeader: '50',
    body: characterLoreMinimalContext(),
  });
  assert(unavailable.status === 'error' && unavailable.httpStatus === 503, 'missing store → 503');
  assert(down.store.providerInvocations === 0, '503 before provider');
}

// --- Fall 5: story bounds + no secrets in errors ---
{
  const uc = makeUc({
    generateStory: async () => 'a'.repeat(CHARACTER_LORE_MAX_STORY_LENGTH + 1),
  });
  const over = await uc.generate(actor(GM), {
    contentLengthHeader: '50',
    body: characterLoreMinimalContext(),
  });
  assert(over.status === 'error' && over.httpStatus === 500, 'overlong story → 500');
  assert(!errorPayloadContainsSecrets(over.message), 'error has no secrets');

  const wsUc = makeUc({ generateStory: async () => '   \n\t  ' });
  const blank = await wsUc.generate(actor(GM), {
    contentLengthHeader: '50',
    body: characterLoreMinimalContext(),
  });
  assert(blank.status === 'error' && blank.httpStatus === 500, 'whitespace-only story rejected');

  const okUc = makeUc({ perUserModel: true, generateStory: async (cfg) => {
    assert(cfg.model === `model-for-${GM}`, 'caller-scoped provider model');
    return STORY;
  } });
  const ok = await okUc.generate(actor(GM), {
    contentLengthHeader: '50',
    body: characterLoreMinimalContext(),
  });
  assert(ok.status === 'ok' && ok.story.length >= 1 && ok.story.length <= 12_000, 'story bounds');
  assert(ok.model === `model-for-${GM}`, 'ok response uses caller model');

  // Decoded-size 413 still charges quota (Edge: rate-limit before decoded body check)
  const chargeUc = makeUc({ nowMs: 9_000_000_000_000 });
  const charged = await chargeUc.generate(actor(GM), {
    contentLengthHeader: '50',
    rawBodyUtf8Bytes: CHARACTER_LORE_MAX_REQUEST_BYTES + 1,
    body: characterLoreMinimalContext(),
  });
  assert(charged.httpStatus === 413, 'decoded oversized → 413 after quota');
  assert(chargeUc.store.quota.get(GM)?.count === 1, 'quota charged before decoded 413');

  const stripped = stripCharacterLoreSecrets({
    apiKey: 'sk-secret-should-go',
    story: 'ok',
    serviceRoleKey: 'srk',
  });
  assert(stripped.apiKey === undefined && stripped.serviceRoleKey === undefined, 'secrets stripped');
  assert(stripped.story === 'ok', 'story kept');
}

// --- Fall 6: legacy auth denial is 500 not 403 ---
{
  assert(
    describeCharacterLoreAuthDenialLegacyDefect().includes('generic 500'),
    'legacy defect documented',
  );
  const uc = makeUc();
  const denied = await uc.generate(actor(STRANGER), {
    contentLengthHeader: '50',
    body: characterLoreMinimalContext({ projectId: PROJECT_ID }),
  });
  assert(denied.httpStatus === 500, 'auth denial → 500 (legacy)');
  assert(denied.httpStatus !== 403, 'not 403');
}

// --- Env provider resolve ---
{
  const cfg = resolveCharacterLoreProviderConfig((k) => {
    if (k === 'CHARACTER_AI_PROVIDER') return 'ollama';
    if (k === 'CHARACTER_AI_MODEL') return 'llama';
    if (k === 'OLLAMA_HOST') return 'http://localhost:11434';
    return undefined;
  });
  assert(cfg && cfg.provider === 'ollama' && cfg.model === 'llama', 'env provider resolve');
  assert(
    resolveCharacterLoreProviderConfig(() => undefined) === null,
    'missing model → null',
  );
}

// --- Unauthenticated ---
{
  const uc = makeUc();
  const res = await uc.generate({ kind: 'solo-local', actorId: '' }, {
    contentLengthHeader: '10',
    body: characterLoreMinimalContext(),
  });
  assert(res.httpStatus === 401, 'empty actor → 401');
}

console.log('PASS: mig-405 character-lore host isolated-contract (no cutover)');
