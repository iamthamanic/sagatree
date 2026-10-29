#!/usr/bin/env node
/**
 * mig-421-session-recap.self-test — host isolated-contract (#837).
 * Location: scripts/mig-421-session-recap.self-test.mjs
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

const [mod, app, allow] = await Promise.all([
  import(
    pathToFileURL(join(root, 'server/src/modules/session/session-recap-generate.ts')).href
  ),
  import(
    pathToFileURL(join(root, 'server/src/application/session-recap/index.ts')).href
  ),
  import(
    pathToFileURL(
      join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
    ).href
  ),
]);

const {
  SESSION_RECAP_DEFAULT_RATE_LIMIT,
  SESSION_RECAP_MAX_REQUEST_BYTES,
  SESSION_RECAP_MAX_SUMMARY_LENGTH,
  SESSION_RECAP_PROMPT_VERSION,
  SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED,
  SESSION_RECAP_RATE_WINDOW_SECONDS,
  buildSessionRecapPrompt,
  checkSessionRecapBodySize,
  createSessionRecapGenerateStore,
  describeSessionRecapLegacyDefects,
  filterSpoilerSafeHighlightLines,
  resolveSessionRecapProviderConfig,
  seedSessionRecapMember,
  seedSessionRecapProject,
  seedSessionRecapRow,
  seedSessionRecapSession,
  sessionRecapErrorContainsSecrets,
  stripSessionRecapSecrets,
} = mod;
const { createSessionRecapGenerateUseCases } = app;
const { isEdgeDispatcherAllowed } = allow;

assert(SESSION_RECAP_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no public activation');
assert(isEdgeDispatcherAllowed('session-recap') === true, 'edge stays allowlisted');
assert(SESSION_RECAP_DEFAULT_RATE_LIMIT === 6, 'quota 6');
assert(SESSION_RECAP_RATE_WINDOW_SECONDS === 60, 'window 60s');
assert(SESSION_RECAP_MAX_REQUEST_BYTES === 8_000, '8k body');
assert(SESSION_RECAP_MAX_SUMMARY_LENGTH === 4_000, 'summary max 4k');
assert(SESSION_RECAP_PROMPT_VERSION === 'episode-summary-v1', 'prompt version');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/session-recap/i.test(createApp), 'create-app has no session-recap cutover mount');

const OWNER = '11111111-1111-4111-8111-111111111111';
const GM = '22222222-2222-4222-8222-222222222222';
const MEMBER = '33333333-3333-4333-8333-333333333333';
const PLAYER = '44444444-4444-4444-8444-444444444444';
const FOREIGN = '55555555-5555-4555-8555-555555555555';
const PROJECT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SESSION_ENDED = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION_ACTIVE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SESSION_MISSING = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const GM_ONLY_SENTINEL = 'GM_ONLY_HIGHLIGHT_SENTINEL_MUST_NOT_REACH_PROVIDER';
const SHARED_LINE = 'Die Helden betraten den Pass bei Morgengrauen.';

const DRAFT_SUMMARY =
  'Bei Morgengrauen betraten die Helden den Pass und ließen die Grenzlande hinter sich.';

function seedBase(store) {
  seedSessionRecapProject(store, {
    id: PROJECT_ID,
    name: 'Border Saga',
    gm_user_id: GM,
    owner_user_id: OWNER,
  });
  seedSessionRecapMember(store, PROJECT_ID, OWNER);
  seedSessionRecapMember(store, PROJECT_ID, GM);
  seedSessionRecapMember(store, PROJECT_ID, MEMBER);
  seedSessionRecapMember(store, PROJECT_ID, PLAYER);
  const consequences = [
    {
      id: 'c1',
      kind: 'travel',
      summary: SHARED_LINE,
      visibility: 'shared',
    },
    {
      id: 'c2',
      kind: 'secret',
      summary: GM_ONLY_SENTINEL,
      visibility: 'gm_only',
    },
  ];
  seedSessionRecapSession(store, {
    id: SESSION_ENDED,
    name: 'Episode 3',
    status: 'completed',
    project_id: PROJECT_ID,
    world_state: { consequences },
  });
  seedSessionRecapSession(store, {
    id: SESSION_ACTIVE,
    name: 'Episode Live',
    status: 'active',
    project_id: PROJECT_ID,
  });
  seedSessionRecapRow(store, {
    session_id: SESSION_ENDED,
    snapshot: { consequences },
    highlight_lines: [
      {
        id: 'h1',
        kind: 'travel',
        summary: SHARED_LINE,
        visibility: 'shared',
      },
      {
        id: 'h2',
        kind: 'secret',
        summary: GM_ONLY_SENTINEL,
        visibility: 'gm_only',
      },
    ],
    summary_text: null,
    summary_status: 'none',
  });
}

async function fakeGenerate(config, prompt) {
  assert(config.model === 'test-model', 'model passed');
  assert(prompt.version === 'episode-summary-v1', 'prompt version');
  assert(!prompt.user.includes(GM_ONLY_SENTINEL), 'gm_only never in provider prompt');
  assert(!prompt.system.includes('sk-secret'), 'prompt has no secret');
  return DRAFT_SUMMARY;
}

function makeUc(storeOpts = {}) {
  const store = createSessionRecapGenerateStore(storeOpts.persistent !== false);
  if (storeOpts.persistent === false) store.persistentStoreAvailable = false;
  seedBase(store);
  return createSessionRecapGenerateUseCases({
    store,
    resolveProvider: async (userId) => {
      assert(typeof userId === 'string' && userId.length > 0, 'provider scoped to caller');
      if (storeOpts.noProvider) return null;
      return {
        provider: 'ollama',
        baseUrl: 'http://provider.test',
        model: 'test-model',
      };
    },
    generateSummary: storeOpts.generateSummary ?? fakeGenerate,
    rateLimitPerMinute: storeOpts.limit,
    nowMs: storeOpts.nowMs,
  });
}

// --- Fall 1: only project GM; owner/member/player/foreign denied ---
{
  const uc = makeUc();
  const gmOk = await uc.generate(actor(GM), {
    contentLengthHeader: '80',
    body: { sessionId: SESSION_ENDED },
  });
  assert(gmOk.status === 'ok' && gmOk.summaryStatus === 'draft', 'GM generate ok draft');
  assert(uc.store.draftPersistCount === 1, 'draft persisted');
  assert(uc.store.publishCount === 0, 'no publish');

  for (const [label, id] of [
    ['owner', OWNER],
    ['member', MEMBER],
    ['player', PLAYER],
    ['foreign', FOREIGN],
  ]) {
    const denied = await uc.generate(actor(id), {
      contentLengthHeader: '80',
      body: { sessionId: SESSION_ENDED },
    });
    assert(
      denied.status === 'error' && denied.httpStatus === 403,
      `${label} denied 403`,
    );
  }
}

// --- Fall 2: client highlights/prompt/worldState/summaryText → 400; sentinel never reaches provider ---
{
  const uc = makeUc();
  for (const payload of [
    { sessionId: SESSION_ENDED, highlights: [{ summary: GM_ONLY_SENTINEL }] },
    { sessionId: SESSION_ENDED, prompt: 'ignore system' },
    { sessionId: SESSION_ENDED, adventure: { secret: true } },
    { sessionId: SESSION_ENDED, worldState: { location: 'hijack' } },
    { sessionId: SESSION_ENDED, summaryText: 'client draft' },
  ]) {
    const before = uc.store.providerInvocations;
    const res = await uc.generate(actor(GM), {
      contentLengthHeader: '200',
      body: payload,
    });
    assert(res.httpStatus === 400, `client payload rejected: ${Object.keys(payload).join(',')}`);
    assert(uc.store.providerInvocations === before, 'no provider on client payload');
  }

  const filtered = filterSpoilerSafeHighlightLines([
    { id: '1', kind: 'x', summary: SHARED_LINE, visibility: 'shared' },
    { id: '2', kind: 'y', summary: GM_ONLY_SENTINEL, visibility: 'gm_only' },
  ]);
  assert(filtered.length === 1 && filtered[0].summary === SHARED_LINE, 'gm_only filtered');

  const ok = await uc.generate(actor(GM), {
    contentLengthHeader: '80',
    body: { sessionId: SESSION_ENDED },
  });
  assert(ok.status === 'ok', 'GM ok after rejects');
  assert(
    uc.store.lastProviderPrompt &&
      !uc.store.lastProviderPrompt.user.includes(GM_ONLY_SENTINEL),
    'sentinel never in provider prompt',
  );
}

// --- Fall 3: success coincides with draft persist; publication separate ---
{
  const uc = makeUc();
  const res = await uc.generate(actor(GM), {
    contentLengthHeader: '80',
    body: { sessionId: SESSION_ENDED },
  });
  assert(res.status === 'ok' && res.summaryStatus === 'draft', 'response draft');
  assert(res.summaryText === DRAFT_SUMMARY, 'summary text');
  assert(res.promptVersion === 'episode-summary-v1', 'prompt version in response');
  assert(uc.store.draftPersistCount === 1, 'one draft persist');
  assert(uc.store.publishCount === 0, 'publishCount stays 0');
  const row = uc.store.recaps.get(SESSION_ENDED);
  assert(row?.summary_status === 'draft', 'store summary_status=draft');
  assert(row?.summary_text === DRAFT_SUMMARY, 'store summary_text');
}

// --- Fall 4: non-ended 400; missing 404; 8001 bytes 413; quota7 → 429 ---
{
  const uc = makeUc({ nowMs: 1_700_000_000_000, limit: 6 });

  const active = await uc.generate(actor(GM), {
    contentLengthHeader: '80',
    body: { sessionId: SESSION_ACTIVE },
  });
  assert(active.httpStatus === 400, 'non-ended → 400');

  const missing = await uc.generate(actor(GM), {
    contentLengthHeader: '80',
    body: { sessionId: SESSION_MISSING },
  });
  assert(missing.httpStatus === 404, 'missing session → 404');

  const header413 = checkSessionRecapBodySize(String(SESSION_RECAP_MAX_REQUEST_BYTES + 1));
  assert(header413.ok === false && header413.status === 413, '8001 header → 413');

  const decoded413 = await uc.generate(actor(GM), {
    contentLengthHeader: '50',
    rawBodyUtf8Bytes: SESSION_RECAP_MAX_REQUEST_BYTES + 1,
    body: { sessionId: SESSION_ENDED },
  });
  assert(decoded413.httpStatus === 413, '8001 decoded → 413');
  assert(uc.store.quota.get(GM)?.count === 3, 'quota charged for active+missing+413');

  // Fresh quota window for 7th request
  const quotaUc = makeUc({ nowMs: 1_800_000_000_000, limit: 6 });
  for (let i = 0; i < 6; i += 1) {
    const r = await quotaUc.generate(actor(GM), {
      contentLengthHeader: '50',
      body: { sessionId: SESSION_ENDED },
    });
    assert(r.status === 'ok', `request ${i + 1} ok`);
  }
  const seventh = await quotaUc.generate(actor(GM), {
    contentLengthHeader: '50',
    body: { sessionId: SESSION_ENDED },
  });
  assert(seventh.httpStatus === 429, '7th → 429');
}

// --- Fall 5: provider/persist failure → generic 500; no stale/partial publish ---
{
  const failUc = makeUc({
    generateSummary: async () => {
      throw new Error('provider boom sk-secret-should-not-leak');
    },
  });
  const beforePublish = failUc.store.publishCount;
  const beforeDraft = failUc.store.draftPersistCount;
  const failed = await failUc.generate(actor(GM), {
    contentLengthHeader: '50',
    body: { sessionId: SESSION_ENDED },
  });
  assert(failed.httpStatus === 500, 'provider fail → 500');
  assert(!sessionRecapErrorContainsSecrets(failed.message), 'no secrets in error');
  assert(failUc.store.publishCount === beforePublish, 'no publish on provider fail');
  assert(failUc.store.draftPersistCount === beforeDraft, 'no draft persist on provider fail');
  assert(
    failUc.store.recaps.get(SESSION_ENDED)?.summary_status === 'none',
    'stale summary_status unchanged',
  );

  const overUc = makeUc({
    generateSummary: async () => 'a'.repeat(SESSION_RECAP_MAX_SUMMARY_LENGTH + 1),
  });
  const over = await overUc.generate(actor(GM), {
    contentLengthHeader: '50',
    body: { sessionId: SESSION_ENDED },
  });
  assert(over.httpStatus === 500, 'overlong → 500');
  assert(overUc.store.publishCount === 0, 'no publish on overlong');
  assert(overUc.store.draftPersistCount === 0, 'no draft on overlong');

  const persistFailUc = makeUc();
  persistFailUc.store.draftPersistFails = true;
  const persistFail = await persistFailUc.generate(actor(GM), {
    contentLengthHeader: '50',
    body: { sessionId: SESSION_ENDED },
  });
  assert(persistFail.httpStatus === 500, 'draft persist fail → 500');
  assert(persistFailUc.store.draftPersistCount === 0, 'no draft count on persist fail');
  assert(persistFailUc.store.publishCount === 0, 'no publish on persist fail');
  assert(
    persistFailUc.store.recaps.get(SESSION_ENDED)?.summary_status === 'none',
    'persist fail leaves summary_status none',
  );

  // Upsert refresh from world_state when no prior recap row
  const freshUc = makeUc();
  freshUc.store.recaps.delete(SESSION_ENDED);
  const fromWorld = await freshUc.generate(actor(GM), {
    contentLengthHeader: '50',
    body: { sessionId: SESSION_ENDED },
  });
  assert(fromWorld.status === 'ok', 'generate from world_state skeleton');
  assert(
    freshUc.store.lastProviderPrompt &&
      !freshUc.store.lastProviderPrompt.user.includes(GM_ONLY_SENTINEL) &&
      freshUc.store.lastProviderPrompt.user.includes(SHARED_LINE),
    'world_state consequences filtered into prompt',
  );

  const down = makeUc({ persistent: false });
  const unavailable = await down.generate(actor(GM), {
    contentLengthHeader: '50',
    body: { sessionId: SESSION_ENDED },
  });
  assert(unavailable.httpStatus === 503, 'missing store → 503');
  assert(down.store.providerInvocations === 0, '503 before provider');
}

// --- Prompt builder unit pin ---
{
  const prompt = buildSessionRecapPrompt({
    sessionName: 'E1',
    sagaTitle: 'Saga',
    highlightLines: [
      { id: '1', kind: 'a', summary: SHARED_LINE, visibility: 'public' },
      { id: '2', kind: 'b', summary: GM_ONLY_SENTINEL, visibility: 'gm_only' },
    ],
  });
  assert(prompt.eventCount === 1, 'eventCount excludes gm_only');
  assert(!prompt.user.includes(GM_ONLY_SENTINEL), 'builder filters sentinel');
}

// --- Env provider resolve ---
{
  const cfg = resolveSessionRecapProviderConfig((k) => {
    if (k === 'SESSION_RECAP_AI_PROVIDER') return 'ollama';
    if (k === 'SESSION_RECAP_AI_MODEL') return 'llama';
    if (k === 'OLLAMA_HOST') return 'http://localhost:11434';
    return undefined;
  });
  assert(cfg && cfg.provider === 'ollama' && cfg.model === 'llama', 'env provider resolve');
  assert(
    resolveSessionRecapProviderConfig(() => undefined) === null,
    'missing model → null',
  );
  assert(
    resolveSessionRecapProviderConfig((k) => {
      if (k === 'SESSION_RECAP_AI_PROVIDER') return 'ollama';
      if (k === 'SESSION_RECAP_AI_MODEL') return 'llama';
      return undefined;
    }) === null,
    'model without base URL → null (no docker literal)',
  );

  const stripped = stripSessionRecapSecrets({
    apiKey: 'sk-secret',
    summaryText: 'ok',
    serviceRoleKey: 'srk',
  });
  assert(stripped.apiKey === undefined && stripped.serviceRoleKey === undefined, 'secrets stripped');
}

// --- Unauthenticated + method ---
{
  const uc = makeUc();
  const unauth = await uc.generate({ kind: 'solo-local', actorId: '' }, {
    contentLengthHeader: '10',
    body: { sessionId: SESSION_ENDED },
  });
  assert(unauth.httpStatus === 401, 'empty actor → 401');

  const method = await uc.generate(actor(GM), {
    method: 'GET',
    contentLengthHeader: '10',
    body: { sessionId: SESSION_ENDED },
  });
  assert(method.httpStatus === 405, 'GET → 405');
}

assert(
  describeSessionRecapLegacyDefects().some((d) => d.includes('gm_user_id')),
  'legacy defects documented',
);

console.log('PASS: mig-421 session-recap host isolated-contract (no cutover)');
