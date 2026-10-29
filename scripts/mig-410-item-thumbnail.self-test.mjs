#!/usr/bin/env node
/**
 * mig-410-item-thumbnail.self-test — host isolated-contract (#826).
 * Location: scripts/mig-410-item-thumbnail.self-test.mjs
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
  import(pathToFileURL(join(root, 'server/src/modules/inventory/item-thumbnail.ts')).href),
  import(pathToFileURL(join(root, 'server/src/application/item-thumbnail/index.ts')).href),
  import(
    pathToFileURL(join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts')).href,
  ),
]);

const {
  ITEM_THUMBNAIL_MAX_BYTES,
  ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED,
  ITEM_THUMBNAIL_RATE_LIMIT,
  ITEM_THUMBNAIL_SIGNED_URL_TTL_SECONDS,
  checkItemThumbnailContentLengthHeader,
  createItemThumbnailStore,
  describeItemThumbnailLegacyDefects,
  isAllowedItemThumbnailMeshyHost,
  seedItemThumbnailDefinition,
  sniffItemThumbnailMime,
  stripItemThumbnailSecrets,
  validateItemThumbnailBytes,
} = mod;
const { createItemThumbnailUseCases } = app;
const { isEdgeDispatcherAllowed } = allow;

assert(ITEM_THUMBNAIL_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no public activation');
assert(isEdgeDispatcherAllowed('item-thumbnail') === true, 'edge stays allowlisted');
assert(ITEM_THUMBNAIL_RATE_LIMIT === 4, 'quota 4');
assert(ITEM_THUMBNAIL_SIGNED_URL_TTL_SECONDS === 604_800, 'signed TTL 7d');
assert(ITEM_THUMBNAIL_MAX_BYTES === 10 * 1024 * 1024, '10MiB');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/item-thumbnail/i.test(createApp), 'no create-app cutover mount');

const OWNER = 'owner-a';
const WORLD_OWNER = 'world-owner';
const GM = 'gm-user';
const MEMBER = 'member-user';
const STRANGER = 'stranger-x';
const WORLD_ID = 'world-1';

const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pngB64 = Buffer.from(pngBytes).toString('base64');
assert(sniffItemThumbnailMime(pngBytes) === 'image/png', 'png sniff');
assert(validateItemThumbnailBytes(pngBytes, 'image/png').mime === 'image/png', 'png validate');

function seedStore(store) {
  seedItemThumbnailDefinition(store, {
    id: 'def-personal',
    scope: 'personal',
    ownerUserId: OWNER,
    worldProfileId: null,
    status: 'active',
    payload: { name: 'Sword' },
  });
  seedItemThumbnailDefinition(store, {
    id: 'def-archived',
    scope: 'personal',
    ownerUserId: OWNER,
    worldProfileId: null,
    status: 'archived',
    payload: {},
  });
  seedItemThumbnailDefinition(store, {
    id: 'def-world',
    scope: 'world',
    ownerUserId: WORLD_OWNER,
    worldProfileId: WORLD_ID,
    status: 'active',
    payload: { name: 'Relic' },
  });
  store.worldOwners.set(WORLD_ID, WORLD_OWNER);
}

const store = createItemThumbnailStore(true);
seedStore(store);
const uc = createItemThumbnailUseCases(store);

// Fall 1: owners upload; GM/member/foreign/archived 403
const upOwner = uc.upload(actor(OWNER), {
  definitionId: 'def-personal',
  contentBase64: pngB64,
  mime: 'image/png',
});
assert(upOwner.status === 'ok' && String(upOwner.assetKey).startsWith('thumbnail2d:'), 'owner upload');
assert(uc.upload(actor(GM), { definitionId: 'def-personal', contentBase64: pngB64 }).httpStatus === 403, 'gm 403');
assert(uc.upload(actor(MEMBER), { definitionId: 'def-personal', contentBase64: pngB64 }).httpStatus === 403, 'member 403');
assert(uc.upload(actor(STRANGER), { definitionId: 'def-personal', contentBase64: pngB64 }).httpStatus === 403, 'stranger 403');
assert(uc.upload(actor(OWNER), { definitionId: 'def-archived', contentBase64: pngB64 }).httpStatus === 403, 'archived 403');
const upWorld = uc.upload(actor(WORLD_OWNER), {
  definitionId: 'def-world',
  contentBase64: pngB64,
  mime: 'image/png',
});
assert(upWorld.status === 'ok', 'world owner upload');

// Fall 2: quota 4/60s
const g1 = uc.generate(actor(OWNER), 'def-personal');
const g2 = uc.generate(actor(OWNER), 'def-personal');
const g3 = uc.generate(actor(OWNER), 'def-personal');
const g4 = uc.generate(actor(OWNER), 'def-personal');
assert(g1.status === 'ok' && g2.status === 'ok' && g3.status === 'ok' && g4.status === 'ok', '4 generates');
const g5 = uc.generate(actor(OWNER), 'def-personal');
assert(g5.httpStatus === 429 && g5.code === 'RATE_LIMIT', '5th 429');
assert(uc.config(actor(OWNER)).status === 'ok', 'config uncharged');
assert(store.providerCreates === 4, 'quota blocks before paid create');

const down = createItemThumbnailStore(true);
seedStore(down);
down.persistentQuotaAvailable = false;
const gDown = createItemThumbnailUseCases(down).generate(actor(OWNER), 'def-personal');
assert(gDown.httpStatus === 500 && down.providerCreates === 0, 'quota store down');

const noMeshy = createItemThumbnailStore(false);
seedStore(noMeshy);
const noCfg = createItemThumbnailUseCases(noMeshy).generate(actor(OWNER), 'def-personal');
assert(noCfg.status === 'not-configured' && noCfg.httpStatus === 503, 'not-configured 503');

assert(uc.generate(actor(OWNER), 'def-personal', 12).httpStatus === 400, 'non-string userExtra');

// Fall 3: unions + latest null + signed TTL
assert(uc.config(actor(OWNER)).maxBytes === ITEM_THUMBNAIL_MAX_BYTES, 'config maxBytes');
assert(String(upOwner.signedUrl).includes('ttl=604800'), 'signed ttl');
const fresh = createItemThumbnailStore(true);
seedStore(fresh);
const freshUc = createItemThumbnailUseCases(fresh);
assert(freshUc.latestJob(actor(OWNER), 'def-personal').job === null, 'latest null');

// Fall 4/5: status materialize, foreign, allowlist, concurrent claim
const st = createItemThumbnailStore(true);
seedStore(st);
const stUc = createItemThumbnailUseCases(st);
const job = stUc.generate(actor(OWNER), 'def-personal');
const s1 = stUc.status(actor(OWNER), job.jobId, 'claimer-a');
assert(s1.jobStatus === 'succeeded' && s1.assetKey, 'materialize');
const s2 = stUc.status(actor(OWNER), job.jobId, 'claimer-b');
assert(s2.jobStatus === 'succeeded' && st.providerCreates === 1, 'no second paid create');
assert(stUc.status(actor(STRANGER), job.jobId).httpStatus === 404, 'foreign job 404');
assert(stUc.resolve(actor(STRANGER), { assetKey: s1.assetKey }).httpStatus === 403, 'foreign resolve 403');

st.jobs.get(job.jobId); // keep
const pollStore = createItemThumbnailStore(true);
seedStore(pollStore);
const pollUc = createItemThumbnailUseCases(pollStore);
const pj = pollUc.generate(actor(OWNER), 'def-personal');
pollStore.jobs.get(pj.jobId).providerPollStatus = 'succeeded';
pollStore.jobs.get(pj.jobId).providerImageUrl = 'https://evil.example/x.png';
assert(pollUc.status(actor(OWNER), pj.jobId).jobStatus === 'failed', 'off-allowlist fail');

// remove pointer without deleting foreign asset
const rem = createItemThumbnailStore(true);
seedStore(rem);
const remUc = createItemThumbnailUseCases(rem);
const wu = remUc.upload(actor(WORLD_OWNER), { definitionId: 'def-world', contentBase64: pngB64 });
rem.assets.get(wu.assetId).ownerUserId = OWNER; // other-owner physical asset referenced
rem.definitions.get('def-world').payload.assetKey = wu.assetKey;
assert(remUc.remove(actor(WORLD_OWNER), 'def-world').removed === true, 'remove ok');
assert(rem.assets.get(wu.assetId).deletedAt === null, 'other-owner asset kept');
assert(rem.definitions.get('def-world').payload.assetKey === undefined, 'pointer cleared');

assert(checkItemThumbnailContentLengthHeader(String(15 * 1024 * 1024)).status === 413, 'header 413');
assert(isAllowedItemThumbnailMeshyHost('cdn.meshy.ai'), 'allowlist');
assert(!isAllowedItemThumbnailMeshyHost('evil.example'), 'deny host');
assert(describeItemThumbnailLegacyDefects().length >= 4, 'legacy listed');
assert(!('MESHY_API_KEY' in stripItemThumbnailSecrets({ MESHY_API_KEY: 'x', ok: 1 })), 'strip secrets');
assert(uc.status(actor(OWNER), '').httpStatus === 400, 'empty jobId');

console.log('PASS: mig-410 item-thumbnail host isolated-contract (no cutover)');
