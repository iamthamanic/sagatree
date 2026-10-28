#!/usr/bin/env node
/**
 * mig-404-character-avatar-meshy.self-test — host isolated-contract (#820).
 * Location: scripts/mig-404-character-avatar-meshy.self-test.mjs
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

const modUrl = pathToFileURL(join(root, 'server/src/modules/character/index.ts')).href;
const appUrl = pathToFileURL(
  join(root, 'server/src/application/character-avatar-meshy/index.ts'),
).href;
const allowUrl = pathToFileURL(
  join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
).href;

const {
  CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED,
  MESHY_AVATAR_RATE_LIMIT,
  MESHY_AVATAR_RATE_WINDOW_SECONDS,
  buildAvatarMeshyIdempotencyKey,
  createCharacterAvatarMeshyStore,
  describeAvatarMeshyConfigLegacyDefect,
  describeAvatarMeshyIdempotencyLegacyDefect,
  describeAvatarMeshyStartOrderingLegacyDefect,
  isAllowedAvatarMeshyGlbUrl,
  markAvatarMeshyGenerationComplete,
} = await import(modUrl);
const { createCharacterAvatarMeshyUseCases } = await import(appUrl);
const { isEdgeDispatcherAllowed } = await import(allowUrl);

assert(CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no public activation');
assert(isEdgeDispatcherAllowed('character-avatar-meshy') === true, 'edge stays allowlisted');
assert(MESHY_AVATAR_RATE_LIMIT === 2, 'quota 2');
assert(MESHY_AVATAR_RATE_WINDOW_SECONDS === 60, 'window 60s');

const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
assert(
  !/character-avatar-meshy/i.test(createApp),
  'create-app has no avatar-meshy cutover mount',
);

const owner = actor('owner-a');
const stranger = actor('stranger-x');
const uc = createCharacterAvatarMeshyUseCases(createCharacterAvatarMeshyStore(true));

const cfg = uc.config();
assert(cfg.status === 'ok' && cfg.meshyConfigured === true, 'config ok');
assert(cfg.promptMinChars === 8 && cfg.promptMaxChars === 500, 'prompt bounds');
assert(cfg.imageMaxBytes === 4 * 1024 * 1024, 'image max');

// Fall 1: owner start/poll; stranger 404; storage path deny
const started = uc.start(owner, {
  clientNonce: 'nonce-1',
  prompt: 'a brave ranger stands ready',
});
assert(started.ok === true && started.value && 'id' in started.value && started.value.id, 'owner start');
const jobId = started.value.id;
const ownGet = uc.get(owner, jobId);
assert(ownGet.ok === true, 'owner get');
const strangerGet = uc.get(stranger, jobId);
assert(strangerGet.ok === false && strangerGet.status === 404, 'stranger 404');
const denySign = uc.signStoragePath(stranger, `owner-a/avatars/${jobId}.glb`);
assert(denySign.ok === false && denySign.status === 403, 'stranger cannot sign owner path');
const allowSign = uc.signStoragePath(owner, `owner-a/avatars/${jobId}.glb`);
assert(allowSign.ok === true, 'owner can sign own path');

// Fall 2: validation
assert(uc.start(owner, { clientNonce: '', prompt: 'abcdefgh' }).ok === false, 'empty nonce');
assert(uc.start(owner, { clientNonce: 'n', prompt: 'short' }).ok === false, 'prompt short');
assert(
  uc.start(owner, { clientNonce: 'n2', prompt: 'x'.repeat(501) }).ok === false,
  'prompt long',
);
assert(
  uc.start(owner, { clientNonce: 'n3', providerId: 'openai', prompt: 'abcdefghij' }).ok === false,
  'unsupported provider',
);
assert(
  uc.start(owner, {
    clientNonce: 'n4',
    generationMode: 'image',
    imageDataUri: 'data:image/png;base64,AAAA',
    settings: { model: 'nope', geometry: 'high', texture: '4k', pose: 'a-pose', topology: 'triangle' },
  }).ok === false,
  'bad settings',
);
const canonicalSettings = uc.start(owner, {
  clientNonce: 'canon-settings',
  prompt: 'abcdefghijkl',
  settings: {
    modelId: 'latest',
    geometryQuality: 'high',
    textureQuality: '4k',
    poseMode: 'a-pose',
    topologyMode: 'triangle',
    outputFormat: 'glb',
  },
});
assert(canonicalSettings.ok === true, 'canonical Avatar3dGenerationSettings field names');

// Fall 3: replay + 3rd start in window → 429 even if replay
const store2 = createCharacterAvatarMeshyStore(true);
const uc2 = createCharacterAvatarMeshyUseCases(store2);
const t0 = 2_000_000_000_000;
const s1 = uc2.start(owner, { clientNonce: 'same', prompt: 'abcdefghijkl', nowMs: t0 });
assert(s1.ok === true, 'start1');
const s2 = uc2.start(owner, { clientNonce: 'same', prompt: 'abcdefghijkl', nowMs: t0 });
assert(s2.ok === true && s2.replayed === true, 'replay start2');
const s3 = uc2.start(owner, { clientNonce: 'same', prompt: 'abcdefghijkl', nowMs: t0 });
assert(s3.ok === false && s3.status === 429, 'third start 429 even if would replay');

// Fall 4: remesh only after generation complete; concurrent claim — only one wins
const premature = uc.poll(owner, jobId, 'poller-early');
assert(premature.ok && premature.value.claimed === false, 'no remesh while still generating');
const marked = markAvatarMeshyGenerationComplete(uc.store, 'owner-a', jobId);
assert(marked.ok === true && marked.value.generationComplete === true, 'generation complete');
const pollA = uc.poll(owner, jobId, 'poller-a');
const pollB = uc.poll(owner, jobId, 'poller-b');
assert(pollA.ok && pollA.value.claimed === true, 'first poll claims remesh');
assert(pollB.ok && pollB.value.claimed === false, 'second poll does not double-start remesh');
const failed = uc.get(owner, jobId);
assert(failed.ok, 'job still readable');
failed.value.status = 'failed';
const resumed = uc.retry(owner, jobId);
assert(resumed.ok && resumed.value.resumedWithoutPaidCreate === true, 'retry resumes provider task');

// Fall 5: provider_unavailable + GLB allowlist + not-configured
const ucProv = createCharacterAvatarMeshyUseCases(createCharacterAvatarMeshyStore(true));
const unavailable = ucProv.start(owner, {
  clientNonce: 'prov-fail',
  prompt: 'abcdefghijkl',
  createProviderTask: () => null,
});
assert(
  unavailable.ok === true &&
    unavailable.value &&
    typeof unavailable.value.id === 'string' &&
    unavailable.value.status === 'provider_unavailable',
  'provider_unavailable persisted job',
);
const retryUnavail = ucProv.retry(owner, unavailable.value.id);
assert(retryUnavail.ok === false, 'retry without provider task stays invalid');
assert(isAllowedAvatarMeshyGlbUrl('http://localhost/foo.glb') === false, 'glb deny localhost http');
const ucNone = createCharacterAvatarMeshyUseCases(createCharacterAvatarMeshyStore(false));
assert(ucNone.config().status === 'not-configured', 'config not-configured');
assert(
  ucNone.start(owner, { clientNonce: 'x', prompt: 'abcdefghijkl' }).code === 'not_configured',
  'start not-configured',
);
assert(isAllowedAvatarMeshyGlbUrl('https://assets.meshy.ai/foo.glb') === true, 'glb allow');
assert(isAllowedAvatarMeshyGlbUrl('https://evil.example/foo.glb') === false, 'glb deny host');
assert(isAllowedAvatarMeshyGlbUrl('https://assets.meshy.ai/foo.exe') === false, 'glb deny ext');

// Fall 6/7: legacy defects pinned (successor cutover still required)
assert(
  describeAvatarMeshyIdempotencyLegacyDefect().includes('prompt length'),
  'idempotency legacy defect',
);
assert(
  describeAvatarMeshyStartOrderingLegacyDefect().includes('provider task before DB'),
  'start ordering legacy defect',
);
assert(
  describeAvatarMeshyConfigLegacyDefect().includes('without proving successful decryption'),
  'config legacy defect',
);
const keyA = buildAvatarMeshyIdempotencyKey({
  ownerUserId: 'u',
  clientNonce: 'n',
  generationMode: 'text',
  prompt: 'aaaaaaaa',
});
const keyB = buildAvatarMeshyIdempotencyKey({
  ownerUserId: 'u',
  clientNonce: 'n',
  generationMode: 'text',
  prompt: 'bbbbbbbb',
});
assert(keyA === keyB, 'equal-length prompts collide (legacy length key)');

console.log('PASS: mig-404 character-avatar-meshy host isolated-contract (no cutover)');
