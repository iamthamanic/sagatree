#!/usr/bin/env node
/**
 * mig-409-item-model3d.self-test — host isolated-contract (#825).
 * Location: scripts/mig-409-item-model3d.self-test.mjs
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
  import(pathToFileURL(join(root, 'server/src/modules/inventory/item-model3d.ts')).href),
  import(pathToFileURL(join(root, 'server/src/application/item-model3d/index.ts')).href),
  import(
    pathToFileURL(join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts')).href,
  ),
]);

const {
  ITEM_MODEL3D_MAX_BYTES,
  ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED,
  ITEM_MODEL3D_RATE_LIMIT,
  ITEM_MODEL3D_SIGNED_URL_TTL_SECONDS,
  checkItemModel3dContentLengthHeader,
  createItemModel3dStore,
  describeItemModel3dLegacyDefects,
  isAllowedItemModel3dMeshyHost,
  seedItemModel3dDefinition,
  sniffItemModel3dGlb,
  stripItemModel3dSecrets,
  validateItemModel3dGlbBytes,
} = mod;
const { createItemModel3dUseCases } = app;
const { isEdgeDispatcherAllowed } = allow;

assert(ITEM_MODEL3D_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no public activation');
assert(isEdgeDispatcherAllowed('item-model3d') === true, 'edge stays allowlisted');
assert(ITEM_MODEL3D_RATE_LIMIT === 2, 'quota 2');
assert(ITEM_MODEL3D_SIGNED_URL_TTL_SECONDS === 604_800, 'signed TTL 7d');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(!/item-model3d/i.test(createApp), 'no create-app cutover mount');

const OWNER = 'owner-a';
const WORLD_OWNER = 'world-owner';
const GM = 'gm-user';
const MEMBER = 'member-user';
const STRANGER = 'stranger-x';
const WORLD_ID = 'world-1';

const glbBytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0, 0, 0, 0]);
const glbB64 = Buffer.from(glbBytes).toString('base64');

function seedStore(store) {
  seedItemModel3dDefinition(store, {
    id: 'def-personal',
    scope: 'personal',
    ownerUserId: OWNER,
    worldProfileId: null,
    status: 'active',
    payload: { assetKey: 'thumbnail2d:thumb-1' },
  });
  seedItemModel3dDefinition(store, {
    id: 'def-archived',
    scope: 'personal',
    ownerUserId: OWNER,
    worldProfileId: null,
    status: 'archived',
    payload: {},
  });
  seedItemModel3dDefinition(store, {
    id: 'def-world',
    scope: 'world',
    ownerUserId: WORLD_OWNER,
    worldProfileId: WORLD_ID,
    status: 'active',
    payload: { assetKey: 'thumbnail2d:thumb-w' },
  });
  store.worldOwners.set(WORLD_ID, WORLD_OWNER);
}

const store = createItemModel3dStore(true);
seedStore(store);
const uc = createItemModel3dUseCases(store);

// --- Fall 1: owners upload; GM/member/foreign/archived 403 ---
const upOwner = uc.upload(actor(OWNER), {
  definitionId: 'def-personal',
  contentBase64: glbB64,
  mime: 'model/gltf-binary',
});
assert(upOwner.status === 'ok' && String(upOwner.model3d).startsWith('model3d:'), 'owner upload');
assert(upOwner.byteSize === glbBytes.byteLength, 'byte size');

const upWorld = uc.upload(actor(WORLD_OWNER), {
  definitionId: 'def-world',
  contentBase64: glbB64,
});
assert(upWorld.status === 'ok', 'world owner upload');

for (const [who, defId] of [
  [GM, 'def-personal'],
  [MEMBER, 'def-personal'],
  [STRANGER, 'def-personal'],
  [OWNER, 'def-archived'],
  [GM, 'def-world'],
]) {
  const denied = uc.upload(actor(who), { definitionId: defId, contentBase64: glbB64 });
  assert(denied.status === 'error' && denied.httpStatus === 403, `${who} ${defId} → 403`);
}
assert(store.providerCreates === 0, 'upload does not charge provider');

// --- Fall 2: generate quota 2/60s; 3rd 429; store down 500; config uncharged ---
const cfgBefore = store.quota.get(OWNER)?.count ?? 0;
uc.config(actor(OWNER));
assert((store.quota.get(OWNER)?.count ?? 0) === cfgBefore, 'config uncharged');

const g1 = uc.generate(actor(OWNER), 'def-personal');
assert(g1.status === 'ok' && g1.jobStatus === 'waiting', 'generate 1');
const g2 = uc.generate(actor(OWNER), 'def-personal');
assert(g2.status === 'ok', 'generate 2');
const g3 = uc.generate(actor(OWNER), 'def-personal');
assert(g3.status === 'error' && g3.httpStatus === 429 && g3.code === 'RATE_LIMIT', '3rd → 429');
assert(store.providerCreates === 2, 'only 2 paid creates');

const down = createItemModel3dStore(true);
seedStore(down);
down.persistentQuotaAvailable = false;
const downUc = createItemModel3dUseCases(down);
const gDown = downUc.generate(actor(OWNER), 'def-personal');
assert(gDown.httpStatus === 500 && down.providerCreates === 0, 'quota store down → 500 before create');

const noMeshy = createItemModel3dStore(false);
seedStore(noMeshy);
const noCfg = createItemModel3dUseCases(noMeshy).generate(actor(OWNER), 'def-personal');
assert(noCfg.status === 'not-configured', 'not-configured');

// --- Fall 3: unions + latest null + signed TTL ---
assert(uc.config(actor(OWNER)).maxBytes === ITEM_MODEL3D_MAX_BYTES, 'config maxBytes');
const latestEmptyStore = createItemModel3dStore(true);
seedStore(latestEmptyStore);
const latestNull = createItemModel3dUseCases(latestEmptyStore).latestJob(
  actor(OWNER),
  'def-personal',
);
assert(latestNull.status === 'ok' && latestNull.job === null, 'latest null');
assert(String(upOwner.signedUrl).includes(String(ITEM_MODEL3D_SIGNED_URL_TTL_SECONDS)), 'ttl');

// --- Fall 4: concurrent status — single materialize claim ---
const claimStore = createItemModel3dStore(true);
seedStore(claimStore);
const claimUc = createItemModel3dUseCases(claimStore);
const started = claimUc.generate(actor(OWNER), 'def-personal');
const a = claimUc.status(actor(OWNER), started.jobId, 'poller-a');
const b = claimUc.status(actor(OWNER), started.jobId, 'poller-b');
assert(a.status === 'ok' && a.jobStatus === 'succeeded', 'claimer succeeds');
assert(b.status === 'ok' && b.jobStatus === 'succeeded', 'second sees same');
assert(claimStore.jobs.get(started.jobId).materializeClaimedBy === 'poller-a', 'single claim');
assert(claimStore.providerCreates === 1, 'no second paid create on status');

// --- Fall 5: foreign job 404; foreign resolve 403; remove other-owner asset intact ---
const foreignJob = claimUc.status(actor(STRANGER), started.jobId);
assert(foreignJob.httpStatus === 404, 'foreign job 404');

const resolveOk = uc.resolve(actor(OWNER), { model3d: upOwner.model3d });
assert(resolveOk.status === 'ok', 'owner resolve');
const resolveDeny = uc.resolve(actor(STRANGER), { model3d: upOwner.model3d });
assert(resolveDeny.httpStatus === 403, 'foreign resolve 403');

const worldClearStore = createItemModel3dStore(true);
seedStore(worldClearStore);
worldClearStore.assets.set('other-asset', {
  id: 'other-asset',
  ownerUserId: OWNER,
  definitionId: 'def-world',
  storagePath: `${OWNER}/x.glb`,
  deletedAt: null,
  byteSize: 10,
});
worldClearStore.definitions.get('def-world').payload.model3d = 'model3d:other-asset';
const worldUc = createItemModel3dUseCases(worldClearStore);
const removed = worldUc.remove(actor(WORLD_OWNER), 'def-world');
assert(removed.status === 'ok' && removed.removed === true, 'world owner remove pointer');
assert(worldClearStore.definitions.get('def-world').payload.model3d === undefined, 'pointer cleared');
assert(worldClearStore.assets.get('other-asset').deletedAt === null, 'other-owner asset kept');

assert(isAllowedItemModel3dMeshyHost('cdn.meshy.ai') === true, 'meshy host ok');
assert(isAllowedItemModel3dMeshyHost('evil.example') === false, 'off-allowlist denied');
assert(sniffItemModel3dGlb(glbBytes) === true, 'glb magic');
let threw = false;
try {
  validateItemModel3dGlbBytes(new Uint8Array([1, 2, 3, 4]));
} catch {
  threw = true;
}
assert(threw, 'bad magic rejected');

// --- Fall 6: secrets stripped; provider error passthrough characterized ---
const stripped = stripItemModel3dSecrets({
  apiKey: 'sk-secret',
  MESHY_API_KEY: 'm',
  message: 'failed',
});
assert(stripped.apiKey === undefined && stripped.MESHY_API_KEY === undefined, 'secrets stripped');
store.jobs.get(g1.jobId).errorMessage = 'provider said boom';
store.jobs.get(g1.jobId).status = 'failed';
const failedStatus = uc.status(actor(OWNER), g1.jobId);
assert(failedStatus.errorMessage === 'provider said boom', 'error_message passthrough');

// --- Fall 7/8 legacy ---
const defects = describeItemModel3dLegacyDefects();
assert(defects.some((d) => d.includes('Header-only')), 'header-only defect');
assert(defects.some((d) => d.includes('Paid provider create')), 'paid-before-insert defect');
assert(store.bodyLimitMode === 'header-only', 'header-only mode');
assert(
  checkItemModel3dContentLengthHeader(String(70 * 1024 * 1024 + 1)).status === 413,
  '70MiB+ header 413',
);

console.log('PASS: mig-409 item-model3d host isolated-contract (no cutover)');
