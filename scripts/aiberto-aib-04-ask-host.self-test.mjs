#!/usr/bin/env node
/**
 * AIB-04 self-test — text inference port, evidence/citations, authz, quota scrub (T-003/004/012).
 * Location: scripts/aiberto-aib-04-ask-host.self-test.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outdir = join(root, 'node_modules', '.cache', 'aiberto-aib-04-ask-host');
mkdirSync(outdir, { recursive: true });

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function check(condition, message) {
  if (!condition) fail(message);
}

const esbuild =
  [
    join(root, 'node_modules', '.bin', 'esbuild'),
    join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
  ].find((p) => existsSync(p)) ?? null;
check(esbuild, 'esbuild available');

console.log('AIB-04: ensure host-runtime.mjs…');
execFileSync(process.execPath, [join(root, 'scripts/build-rulebook-index.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
check(
  existsSync(join(root, 'src/domains/rulebook/generated/host-runtime.mjs')),
  'host-runtime.mjs committed/generated',
);

const runtime = await import(
  pathToFileURL(join(root, 'src/domains/rulebook/generated/host-runtime.mjs')).href
);
const index = runtime.getSagaTreeCoreRulebookIndex();
check(typeof index.manifest.revisionHash === 'string', 'index revision');

// --- T-003: evidence gate + citation validation gold ---
console.log('AIB-04: T-003 evidence/citation gold…');
const emptyGate = runtime.evidenceGate([]);
check(emptyGate.ok === false && emptyGate.reason === 'no-evidence', 'T-003 empty → unanswered');

const hits = runtime.searchRulebook(index, 'anwendbarer Erfahrungsbonus', { limit: 5 });
check(hits.length > 0, 'T-003 retrieval returns hits');
const gate = runtime.evidenceGate(hits);
check(gate.ok === true, 'T-003 evidence proceeds');

const retrievedIds = hits.map((h) => h.sectionId);
const fake = runtime.validateCitations({
  retrievedSectionIds: retrievedIds,
  claimedSectionIds: ['stc-fake-999', retrievedIds[0]],
  pinnedIndexRevision: index.manifest.revisionHash,
  responseIndexRevision: index.manifest.revisionHash,
});
check(fake.dropped.includes('stc-fake-999'), 'T-003 fake citation dropped');
check(
  fake.accepted.some((c) => c.sectionId === retrievedIds[0].toLowerCase()),
  'T-003 real citation kept',
);

const mismatch = runtime.validateCitations({
  retrievedSectionIds: retrievedIds,
  claimedSectionIds: retrievedIds,
  pinnedIndexRevision: index.manifest.revisionHash,
  responseIndexRevision: 'deadbeef',
});
check(mismatch.accepted.length === 0 && mismatch.indexRevisionMatch === false, 'T-003 revision mismatch drops all');

const claimed = runtime.extractClaimedCitationIds(
  `Antwort mit [cite:${retrievedIds[0]}] und CITATIONS: stc-fake-x`,
);
check(claimed.includes(retrievedIds[0].toLowerCase()), 'T-003 extract cite marker');

// --- Media modality catalog unchanged ---
const registrySrc = readFileSync(
  join(root, 'server/src/modules/ai/internal/registry.ts'),
  'utf8',
);
check(
  /export type AiModality = 'image' \| '3d' \| 'video' \| 'audio';/.test(registrySrc),
  'AiModality media catalog unchanged',
);
check(!/AiModality = .*text/.test(registrySrc), 'no text modality in media catalog');

const aiIndex = readFileSync(join(root, 'server/src/modules/ai/index.ts'), 'utf8');
check(aiIndex.includes('inferText'), 'text inference port exported from modules/ai');
check(aiIndex.includes('streamTextInference'), 'stream text port exported');

// --- Host use-case isolated contract (T-004 / T-012) ---
console.log('AIB-04: bundle aiberto-ask + text-inference for Node…');
const bundleOut = join(outdir, 'aiberto-ask.mjs');
execFileSync(
  esbuild,
  [
    join(root, 'server/src/application/aiberto-ask/index.ts'),
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--packages=external',
    `--outfile=${bundleOut}`,
  ],
  { stdio: 'inherit' },
);

const askMod = await import(pathToFileURL(bundleOut).href);
const {
  createAibertoAskUseCases,
  isAibertoChatEnabled,
  stripTextInferenceSecrets,
  textInferenceErrorContainsSecrets,
  createAibertoRateLimitStore,
} = askMod;

check(isAibertoChatEnabled(() => undefined) === false, 'flag default off');
check(isAibertoChatEnabled((k) => (k === 'AIBERTO_CHAT_ENABLED' ? '1' : undefined)) === true, 'flag on');

const actor = { kind: 'solo-local', actorId: '11111111-1111-4111-8111-111111111111' };
const stranger = { kind: 'solo-local', actorId: '' };

const stubApi = {
  getSagaTreeCoreRulebookIndex: () => index,
  searchRulebook: (_idx, query, opts) => runtime.searchRulebook(index, query, opts),
  evidenceGate: runtime.evidenceGate,
  extractClaimedCitationIds: runtime.extractClaimedCitationIds,
  validateCitations: runtime.validateCitations,
  formatEvidenceForPrompt: runtime.formatEvidenceForPrompt,
};

function makeUc(overrides = {}) {
  return createAibertoAskUseCases({
    envGet: (k) => (k === 'AIBERTO_CHAT_ENABLED' ? '1' : undefined),
    authorize: (a) =>
      a?.actorId
        ? { allow: true, reason: 'ok' }
        : { allow: false, reason: 'missing-actor' },
    resolveProvider: async () => ({
      provider: 'ollama',
      baseUrl: 'http://127.0.0.1:11434',
      model: 'test-model',
    }),
    rulebookApi: stubApi,
    rateLimitStore: createAibertoRateLimitStore(),
    rateLimitPerMinute: 3,
    inferTextFn: async () => ({
      ok: true,
      text: `EB gilt nur wenn anwendbar. [cite:${hits[0].sectionId}]`,
      provider: 'ollama',
      model: 'test-model',
    }),
    ...overrides,
  });
}

console.log('AIB-04: T-004 auth / unanswered / flag…');
{
  const uc = makeUc({ envGet: () => undefined });
  const disabled = await uc.ask(actor, { body: { question: 'Drive' } });
  check(disabled.status === 'disabled', 'T-004 flag off → disabled');
}

{
  const uc = makeUc();
  const denied = await uc.ask(stranger, { body: { question: 'Drive' } });
  check(denied.status === 'error' && denied.code === 'AUTH_DENIED', 'T-004 empty actor DENY');
}

{
  const uc = makeUc({
    authorize: () => ({ allow: false, reason: 'nope' }),
  });
  const denied = await uc.ask(actor, { body: { question: 'Drive' } });
  check(denied.status === 'error' && denied.httpStatus === 403, 'T-004 policy DENY 403');
}

{
  const uc = makeUc({
    rulebookApi: {
      ...stubApi,
      searchRulebook: () => [],
    },
  });
  const unanswered = await uc.ask(actor, { body: { question: 'zzzznotaword' } });
  check(
    unanswered.status === 'unanswered' && unanswered.reason === 'no-evidence',
    'T-004 no evidence → unanswered (no invent)',
  );
}

{
  const uc = makeUc({
    resolveProvider: async () => null,
  });
  const nc = await uc.ask(actor, { body: { question: 'Drive' } });
  check(nc.status === 'not-configured' && nc.code === 'NOT_CONFIGURED', 'T-004 NOT_CONFIGURED');
}

{
  const uc = makeUc({
    inferTextFn: async () => ({
      ok: true,
      text: 'Ich erfinde [cite:stc-fake-nope] und stc-also-fake',
      provider: 'ollama',
      model: 'test-model',
    }),
  });
  const bad = await uc.ask(actor, {
    body: { question: 'anwendbarer Erfahrungsbonus' },
  });
  check(
    bad.status === 'unanswered' && bad.reason === 'no-valid-citations',
    'T-004 only-fake citations → unanswered',
  );
}

{
  const uc = makeUc();
  const ok = await uc.ask(actor, {
    body: { question: 'anwendbarer Erfahrungsbonus' },
  });
  check(ok.status === 'ok', 'T-003 happy path ok');
  check(ok.citations.length >= 1, 'T-003 citations present');
  check(
    ok.citations.every((c) => retrievedIds.map((id) => id.toLowerCase()).includes(c.sectionId)),
    'T-003 citations ⊆ retrieved',
  );
}

// Streaming emits meta + final
{
  const uc = makeUc({
    streamTextFn: async function* () {
      yield { type: 'token', text: `Hallo [cite:${hits[0].sectionId}]` };
      yield { type: 'done', text: `Hallo [cite:${hits[0].sectionId}]` };
    },
  });
  const events = [];
  for await (const evt of uc.askStream(actor, {
    body: { question: 'anwendbarer Erfahrungsbonus' },
  })) {
    events.push(evt.event);
  }
  check(events.includes('meta') && events.includes('final'), 'SSE events meta+final');
}

console.log('AIB-04: T-012 quota/logs scrub secrets…');
{
  const uc = makeUc({ rateLimitPerMinute: 1 });
  const first = await uc.ask(actor, { body: { question: 'Drive' } });
  check(first.status === 'ok' || first.status === 'unanswered', 'T-012 first ask allowed');
  const second = await uc.ask(actor, { body: { question: 'Drive' } });
  check(second.status === 'error' && second.code === 'RATE_LIMITED', 'T-012 second ask 429');
}

const scrubbed = stripTextInferenceSecrets({
  apiKey: 'sk-secret',
  AIBERTO_AI_API_KEY: 'x',
  status: 'ok',
  userId: actor.actorId,
});
check(scrubbed.apiKey === undefined, 'T-012 apiKey scrubbed');
check(scrubbed.AIBERTO_AI_API_KEY === undefined, 'T-012 env key scrubbed');
check(textInferenceErrorContainsSecrets('Bearer sk-abcdefghijklmnop') === true, 'T-012 detect secrets');
check(textInferenceErrorContainsSecrets('Provider down') === false, 'T-012 clean message');

// Route mounts present
const aiRoutes = readFileSync(join(root, 'server/src/api/ai-routes.ts'), 'utf8');
check(aiRoutes.includes('/api/v1/ai/aiberto-ask'), 'ai-routes mounts aiberto-ask');
check(aiRoutes.includes('/api/v1/ai/aiberto-ask/stream'), 'ai-routes mounts stream');
const createHost = readFileSync(join(root, 'server/src/bootstrap/create-host.ts'), 'utf8');
check(createHost.includes('createAibertoAskUseCases'), 'create-host wires aiberto-ask');
check(createHost.includes('aibertoAsk'), 'create-host passes aibertoAsk');

// No UI surface in this ticket
check(!existsSync(join(root, 'src/app/ai-assistant')), 'no FE chat slice in AIB-04');

writeFileSync(join(outdir, 'ok'), 'ok\n');
console.log('AIB-04 aiberto-ask host self-test passed.');
