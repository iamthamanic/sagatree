#!/usr/bin/env node
/**
 * mig-416-media-quarantine.self-test — preserve 404; isolate fixtures (#832).
 * Location: scripts/mig-416-media-quarantine.self-test.mjs
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

const modUrl = pathToFileURL(join(root, 'server/src/modules/media/index.ts')).href;
const {
  MEDIA_EDGE_MAP_IS_DURABLE_STORAGE,
  MEDIA_EDGE_PUBLIC_ACTIVATION_AUTHORIZED,
  createMediaEdgeStore,
  deleteMedia,
  getMedia,
  getMimeType,
  listMedia,
  updateMediaTags,
  uploadMedia,
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

assert(MEDIA_EDGE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'activation denied');
assert(isEdgeDispatcherAllowed('media') === false, 'allowlist deny');
assert(!EDGE_DISPATCHER_ALLOWLIST.includes('media'), 'media not in allowlist values');
const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/functions\/v1\/media|edge.?media|\/media\/upload/i.test(createApp), 'create-app has no edge media mount');
const routeRegistry = readFileSync(join(root, 'server/src/http/route-registry.ts'), 'utf8');
assert(!/functions\/v1\/media|\/media\/upload/.test(routeRegistry), 'route-registry has no edge media mount');

await withHandler(stubDeps({ trustedOrigins: [] }), async (base) => {
  for (const path of [
    '/media',
    '/media/health',
    '/media/upload',
    '/media/media',
    '/media/media/x',
    '/media/media/x/tags',
    '/functions/v1/media',
    '/functions/v1/media/health',
    '/functions/v1/media/upload',
    '/functions/v1/media/media',
    '/functions/v1/media/media/x',
    '/functions/v1/media/media/x/tags',
  ]) {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: ['POST', 'PUT'].includes(method)
          ? { 'content-type': 'application/json' }
          : undefined,
        body: ['POST', 'PUT'].includes(method) ? JSON.stringify({}) : undefined,
      });
      assert(res.status === 404, `${method} ${path} → 404, got ${res.status}`);
    }
  }
});

assert(getMimeType('a.png') === 'image/png', 'png mime');
assert(getMimeType('a.unknown') === 'application/octet-stream', 'default mime');

const store = createMediaEdgeStore('http://example.test');
const content = 'YWJj'; // base64-ish length 3 → size floor(9/4)=2
const uploaded = uploadMedia(
  store,
  { filename: 'pic.png', content, uploadedBy: 'u1', projectId: 'p1', tags: ['t'] },
  'm1',
  '2026-01-01T00:00:00.000Z',
);
assert(uploaded.type === 'image/png', 'type from filename');
assert(uploaded.size === Math.floor((content.length * 3) / 4), 'legacy size formula');
assert(uploaded.url.includes('/storage/v1/object/media/m1-pic.png'), 'URL constructed, no bytes stored');
assert(uploaded.uploadedBy === 'u1', 'uploader preserved');
assert(getMedia(store, 'm1')?.id === 'm1', 'get');
assert(listMedia(store, 'p1').length === 1, 'list project');
assert(listMedia(store, undefined, 'image').length === 1, 'list type prefix');
updateMediaTags(store, 'm1', ['a', 'b']);
assert(getMedia(store, 'm1').tags.join(',') === 'a,b', 'tags');
let threw = false;
try {
  updateMediaTags(store, 'missing', []);
} catch (err) {
  threw = /not found/i.test(String(err?.message || err));
}
assert(threw, 'update missing throws');
deleteMedia(store, 'm1');
assert(getMedia(store, 'm1') === null, 'deleted');

// Legacy unsafe inputs preserved (no sanitize/decode/auth rewrite)
const evilName = '../evil/../../x.png';
const evilContent = '!!!not-base64!!!';
const spoofed = 'attacker-spoofed-uploader';
const unsafe = uploadMedia(
  store,
  {
    filename: evilName,
    content: evilContent,
    uploadedBy: spoofed,
    projectId: 'p-evil',
  },
  'm-evil',
  '2026-01-02T00:00:00.000Z',
);
assert(unsafe.filename === evilName, 'unsanitized filename preserved');
assert(unsafe.uploadedBy === spoofed, 'spoofed uploadedBy preserved');
assert(unsafe.size === Math.floor((evilContent.length * 3) / 4), 'size from raw content length');
assert(unsafe.url.includes(`m-evil-${evilName}`), 'path traversal filename embedded in URL');
assert(getMimeType(evilName) === 'image/png', 'mime from last extension only');

assert(MEDIA_EDGE_MAP_IS_DURABLE_STORAGE === false, 'Map ≠ durable storage');
const src = readFileSync(
  join(root, 'server/src/modules/media/internal/media-edge-quarantine.ts'),
  'utf8',
);
assert(
  !/from ['"].*open-database|TABLE_OWNERSHIP|createClient|storage\.from/.test(src),
  'quarantine does not wire durable storage',
);

console.log('PASS mig-416-media-quarantine.self-test');
