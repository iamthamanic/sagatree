#!/usr/bin/env node
/**
 * mig-412-look-reference-analysis.self-test — isolated-contract (#828).
 * Location: scripts/mig-412-look-reference-analysis.self-test.mjs
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const lookUrl = pathToFileURL(join(root, 'server/src/modules/look/index.ts')).href;
const {
  LOOK_REFERENCE_PUBLIC_ACTIVATION_AUTHORIZED,
  LOOK_REF_ANALYSIS_MAX_BYTES,
  assertOwnerScopedStoragePath,
  createLookReferenceRateLimitStore,
  decodeLookRefBase64Image,
  validateLookRefImageBytes,
} = await import(lookUrl);

const appUrl = pathToFileURL(
  join(root, 'server/src/application/look-reference-analysis/index.ts'),
).href;
const {
  LOOK_REF_MAX_REQUEST_BYTES,
  checkContentLengthEnvelope,
  createLookReferenceAnalysisUseCase,
  parseLookReferences,
  stripTopLevelSecrets,
} = await import(appUrl);

const allowUrl = pathToFileURL(
  join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
).href;
const { isEdgeDispatcherAllowed } = await import(allowUrl);

assert(LOOK_REFERENCE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no public host activation this slice');
assert(isEdgeDispatcherAllowed('look-reference-analysis') === true, 'Edge remains allowlisted');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/look-reference-analysis/i.test(createApp), 'no host HTTP mount yet (MIG-600)');

// Minimal PNG (8-byte signature + padding to pass sniff)
const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
]);
const pngB64 = Buffer.from(pngBytes).toString('base64');

function ref(id, extra = {}) {
  return {
    id,
    kind: 'style',
    mime: 'image/png',
    uri: `data:image/png;base64,${pngB64}`,
    contentBase64: pngB64,
    ...extra,
  };
}

// --- Test 1: 1 and 10 accepted; 0/11, duplicate, bad mime, bad weight, absent bytes ---
assert(parseLookReferences([ref('a')]).length === 1, '1 image ok');
assert(
  parseLookReferences(Array.from({ length: 10 }, (_, i) => ref(`i${i}`))).length === 10,
  '10 images ok',
);
let threw = false;
try {
  parseLookReferences([]);
} catch {
  threw = true;
}
assert(threw, '0 images rejected');
threw = false;
try {
  parseLookReferences(Array.from({ length: 11 }, (_, i) => ref(`i${i}`)));
} catch {
  threw = true;
}
assert(threw, '11 images rejected');
threw = false;
try {
  parseLookReferences([ref('dup'), ref('dup')]);
} catch {
  threw = true;
}
assert(threw, 'duplicate ids rejected');
threw = false;
try {
  parseLookReferences([ref('m', { mime: 'image/gif' })]);
} catch {
  threw = true;
}
assert(threw, 'unsupported mime rejected');
threw = false;
try {
  parseLookReferences([ref('w', { weight: 2 })]);
} catch {
  threw = true;
}
assert(threw, 'invalid weight rejected');
threw = false;
try {
  parseLookReferences([
    {
      id: 'nob',
      kind: 'style',
      mime: 'image/png',
      uri: 'x',
    },
  ]);
} catch {
  threw = true;
}
assert(threw, 'absent bytes/storage rejected');

validateLookRefImageBytes(pngBytes, 'image/png');
assert(LOOK_REF_ANALYSIS_MAX_BYTES === 8 * 1024 * 1024, '8MiB image cap');

// --- Test 2: foreign path / traversal / backslash; inline overrides storage ---
threw = false;
try {
  assertOwnerScopedStoragePath('other-user/a.png', 'user-a');
} catch {
  threw = true;
}
assert(threw, 'foreign-user path denied');
threw = false;
try {
  assertOwnerScopedStoragePath('user-a/../x', 'user-a');
} catch {
  threw = true;
}
assert(threw, 'traversal denied');
threw = false;
try {
  assertOwnerScopedStoragePath('user-a\\evil', 'user-a');
} catch {
  threw = true;
}
assert(threw, 'backslash denied');
assert(
  assertOwnerScopedStoragePath('user-a/ok.png', 'user-a') === 'user-a/ok.png',
  'owner path ok',
);

let storageFetched = false;
const rate = createLookReferenceRateLimitStore();
const uc = createLookReferenceAnalysisUseCase({
  rateLimit: rate,
  providerConfigured: true,
  fetchStorageBytes: async () => {
    storageFetched = true;
    return pngBytes;
  },
  analyzeVision: async () => ({ mood: 'warm', apiKey: 'SECRET', nested: { apiKey: 'NESTED' } }),
  nowIso: () => '2026-01-01T00:00:00.000Z',
});

const both = await uc.analyze({
  actorId: 'user-a',
  contentLengthHeader: '100',
  body: {
    action: 'analyze',
    references: [
      ref('r1', {
        contentBase64: pngB64,
        storagePath: 'user-a/should-not-fetch.png',
      }),
    ],
  },
});
assert(both.status === 'ok' && storageFetched === false, 'inline bytes override storagePath');

// --- Test 3: 5th request in default window → 429; memory-only ---
assert(rate.kind === 'process-memory', 'restart resets Map (memory-only)');
const rate2 = createLookReferenceRateLimitStore();
const ucRate = createLookReferenceAnalysisUseCase({
  rateLimit: rate2,
  rateLimitPerMinute: 4,
  providerConfigured: true,
  analyzeVision: async () => ({}),
});
for (let i = 0; i < 4; i += 1) {
  const r = await ucRate.analyze({
    actorId: 'u1',
    contentLengthHeader: null,
    body: { action: 'analyze', references: [ref(`r${i}`)] },
  });
  assert(r.status === 'ok', `request ${i + 1} ok`);
}
const fifth = await ucRate.analyze({
  actorId: 'u1',
  contentLengthHeader: null,
  body: { action: 'analyze', references: [ref('r4')] },
});
assert(fifth.status === 'error' && fifth.httpStatus === 429, '5th → 429');

// --- Test 4: provider absent → not-configured; strip top-level secrets; no LookProfile persist ---
const ucNoProv = createLookReferenceAnalysisUseCase({
  rateLimit: createLookReferenceRateLimitStore(),
  providerConfigured: false,
});
const nc = await ucNoProv.analyze({
  actorId: 'u',
  contentLengthHeader: null,
  body: { action: 'analyze', references: [ref('r')] },
});
assert(nc.status === 'not-configured', 'provider absence → not-configured');

const stripped = stripTopLevelSecrets({
  apiKey: 'x',
  authorization: 'y',
  providerSecret: 'z',
  keep: 1,
  nested: { apiKey: 'still-here' },
});
assert(
  stripped.apiKey === undefined &&
    stripped.authorization === undefined &&
    stripped.providerSecret === undefined &&
    stripped.keep === 1 &&
    stripped.nested?.apiKey === 'still-here',
  'top-level strip only; nested retained (legacy)',
);
assert(both.status === 'ok' && both.payload.apiKey === undefined, 'ok payload stripped');
assert(both.status === 'ok' && both.payload.nested?.apiKey === 'NESTED', 'nested secret retained');

// --- Test 5 / 6: Content-Length envelope 12MiB; image 8MiB; legacy defects documented ---
assert(LOOK_REF_MAX_REQUEST_BYTES === 12 * 1024 * 1024, '12MiB envelope');
const big = checkContentLengthEnvelope(String(LOOK_REF_MAX_REQUEST_BYTES + 1));
assert(big.ok === false && big.status === 413, 'Content-Length trust → 413');
const okEnv = checkContentLengthEnvelope(null);
assert(okEnv.ok === true, 'missing Content-Length allowed (legacy)');

console.log('PASS mig-412-look-reference-analysis.self-test');
