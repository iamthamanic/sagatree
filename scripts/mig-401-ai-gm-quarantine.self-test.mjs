#!/usr/bin/env node
/**
 * mig-401-ai-gm-quarantine.self-test — preserve 404; isolate fixtures (#817).
 * Location: scripts/mig-401-ai-gm-quarantine.self-test.mjs
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

const modUrl = pathToFileURL(join(root, 'server/src/modules/ai/index.ts')).href;
const {
  AI_GM_ACTION_MAX_LENGTH,
  AI_GM_DEFAULT_RATE_LIMIT,
  AI_GM_NON_STREAM_CONTENT_TYPE,
  AI_GM_PUBLIC_ACTIVATION_AUTHORIZED,
  AI_GM_RATE_LIMIT_WINDOW_SECONDS,
  AI_GM_STREAM_CONTENT_TYPE,
  aiGmAttemptDurableStateWrite,
  aiGmPipelineStageAfterMembership,
  consumeAiGmQuota,
  createAiGmQuotaBucket,
  formatAiGmNdjsonChunk,
  formatAiGmNdjsonStream,
  formatAiGmNonStreamResponse,
  parseAiGmNdjsonLineBuffer,
  validateAiGmRequest,
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

assert(AI_GM_PUBLIC_ACTIVATION_AUTHORIZED === false, 'activation denied');
assert(AI_GM_DEFAULT_RATE_LIMIT === 12, 'default quota 12');
assert(AI_GM_ACTION_MAX_LENGTH === 5000, 'action max 5000');
assert(AI_GM_STREAM_CONTENT_TYPE === 'text/event-stream', 'stream content-type');
assert(isEdgeDispatcherAllowed('ai-gm') === false, 'allowlist deny');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('ai-gm'), 'ai-gm not in allowlist values');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/functions\/v1\/ai-gm|\/ai-gm\b/i.test(createApp), 'create-app has no ai-gm mount');
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(!/functions\/v1\/ai-gm|\/ai-gm\b/.test(routeRegistry), 'route-registry has no ai-gm mount');

await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/ai-gm',
    '/ai-gm/health',
    '/functions/v1/ai-gm',
    '/functions/v1/ai-gm/health',
  ]) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const headers = {};
      if (method === 'POST' || method === 'PUT') headers['content-type'] = 'application/json';
      // Probe with and without Authorization to cover valid/invalid/no JWT shapes.
      for (const auth of [undefined, 'Bearer invalid', 'Bearer eyJhbGciOiJub25lIn0.e30.']) {
        if (auth) headers.authorization = auth;
        else delete headers.authorization;
        const res = await fetch(`${base}${path}`, {
          method,
          headers: Object.keys(headers).length ? headers : undefined,
          body: ['POST', 'PUT'].includes(method) ? JSON.stringify({}) : undefined,
        });
        assert(res.status === 404, `${method} ${path} auth=${auth ?? 'none'} → 404, got ${res.status}`);
      }
    }
  }
});

assert(validateAiGmRequest(null).valid === false, 'null body');
assert(validateAiGmRequest({ sessionId: 's', action: 'ok' }).valid === true, 'valid body');
assert(
  validateAiGmRequest({ sessionId: 's', action: 'x'.repeat(5001) }).valid === false,
  'action over 5000',
);
assert(aiGmPipelineStageAfterMembership({ membershipAllowed: false }) === 'denied', 'deny before quota');
assert(aiGmPipelineStageAfterMembership({ membershipAllowed: true }) === 'rate-limit', 'quota after membership');

assert(AI_GM_RATE_LIMIT_WINDOW_SECONDS === 60, 'quota window 60s');
const t0 = 1_700_000_000_000;
const bucket = createAiGmQuotaBucket();
for (let i = 0; i < 12; i += 1) {
  assert(consumeAiGmQuota(bucket, 'user-1', t0) === true, `quota allow ${i + 1}`);
}
assert(consumeAiGmQuota(bucket, 'user-1', t0) === false, '13th → deny (429)');
assert(consumeAiGmQuota(bucket, 'user-2', t0) === true, 'other user still allowed');
assert(
  consumeAiGmQuota(bucket, 'user-1', t0 + AI_GM_RATE_LIMIT_WINDOW_SECONDS * 1000) === true,
  'after 60s window → allow again',
);
const pruneBucket = createAiGmQuotaBucket(2, 60);
assert(consumeAiGmQuota(pruneBucket, 'stale-a', t0) === true, 'prune seed a');
assert(consumeAiGmQuota(pruneBucket, 'stale-b', t0) === true, 'prune seed b');
assert(pruneBucket.entries.size === 2, 'two live entries');
assert(
  consumeAiGmQuota(pruneBucket, 'fresh', t0 + AI_GM_RATE_LIMIT_WINDOW_SECONDS * 1000) === true,
  'consume after expiry prunes stale keys',
);
assert(pruneBucket.entries.has('stale-a') === false, 'stale-a pruned');
assert(pruneBucket.entries.has('stale-b') === false, 'stale-b pruned');
assert(pruneBucket.entries.has('fresh') === true, 'fresh retained');

const narrative = formatAiGmNdjsonChunk({ type: 'narrative', content: 'Hi' });
assert(narrative === '{"type":"narrative","content":"Hi"}\n', 'ndjson narrative');
assert(!narrative.startsWith('data:'), 'not SSE data: framing');
const completeChunk = {
  type: 'complete',
  narrative: 'done',
  worldStateUpdate: null,
  combatInitiated: false,
};
const complete = formatAiGmNdjsonChunk(completeChunk);
assert(complete.includes('"type":"complete"'), 'ndjson complete');
const errChunk = formatAiGmNdjsonChunk({ type: 'error', error: 'boom' });
assert(errChunk.includes('"type":"error"'), 'ndjson error');

const streamBody = formatAiGmNdjsonStream([
  { type: 'narrative', content: 'Hel' },
  { type: 'narrative', content: 'lo' },
  completeChunk,
  { type: 'error', error: 'provider-down' },
]);
assert(streamBody.split('\n').filter(Boolean).length === 4, 'multi-chunk NDJSON lines');
assert(!streamBody.includes('data:'), 'stream not SSE data: framing');

const split = '{"type":"narrative","content":"ab"}\n{"type":"err';
const mid = 'or","error":"x"}\n';
const first = parseAiGmNdjsonLineBuffer('', split.slice(0, 10));
assert(first.lines.length === 0, 'incomplete first provider chunk stays buffered');
const second = parseAiGmNdjsonLineBuffer(first.rest, split.slice(10) + mid);
assert(second.lines.length === 2, 'chunk-boundary yields two NDJSON lines');
assert(second.rest === '', 'no trailing partial after complete lines');

assert(AI_GM_NON_STREAM_CONTENT_TYPE === 'application/json', 'non-stream content-type');
const nonStream = formatAiGmNonStreamResponse({
  narrative: 'done',
  worldStateUpdate: { scene: 'camp' },
  diceRollsRequired: [{ type: 'd20', dc: 12 }],
  combatInitiated: false,
});
const nonStreamParsed = JSON.parse(nonStream);
assert(nonStreamParsed.narrative === 'done', 'non-stream narrative');
assert(nonStreamParsed.worldStateUpdate?.scene === 'camp', 'non-stream worldStateUpdate');
assert(Array.isArray(nonStreamParsed.diceRollsRequired), 'non-stream diceRollsRequired');
assert(nonStreamParsed.combatInitiated === false, 'non-stream combatInitiated');

const deniedWrite = aiGmAttemptDurableStateWrite({ scene: 'camp' });
assert(deniedWrite.ok === false && deniedWrite.reason === 'activation-denied', 'failed state write');

console.log('PASS: mig-401 ai-gm quarantine (404 preserved, fixtures pinned, no cutover)');
