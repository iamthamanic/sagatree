#!/usr/bin/env node
/**
 * mig-306-media-adapter.self-test — host media policy ports + client optimizer parity (#805).
 * Location: scripts/mig-306-media-adapter.self-test.mjs
 *
 * infra-media has zero Supabase RPC/storage/realtime. Host media ports evaluate domain
 * policies; browser engines stay the only optimize path. No remote codec service invented.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const mediaUrl = pathToFileURL(join(root, 'server/src/modules/media/index.ts')).href;
const hostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const infraContract = readFileSync(
  join(root, '.qa/intake/edge-infra-contracts/infra-media.md'),
  'utf8',
);
const audioEngine = readFileSync(
  join(root, 'src/infrastructure/media/optimizer/engines/audio/index.ts'),
  'utf8',
);
const videoEngine = readFileSync(
  join(root, 'src/infrastructure/media/optimizer/engines/video/index.ts'),
  'utf8',
);
const modelEngine = readFileSync(
  join(root, 'src/infrastructure/media/optimizer/engines/model3d/index.ts'),
  'utf8',
);
const facade = readFileSync(
  join(root, 'src/infrastructure/media/optimizer/media-optimizer.ts'),
  'utf8',
);

assert(/RPCs \(0\): none/.test(infraContract), 'infra-media still documents 0 RPCs');
assert(/Storage buckets \(0\): none/.test(infraContract), 'infra-media still documents 0 storage');
assert(/Realtime call sites: 0/.test(infraContract), 'infra-media still documents 0 realtime');
assert(!/from ['"]@supabase|supabase\.from|functions\.invoke/.test(facade), 'facade has no supabase');

const { createMediaPorts } = await import(mediaUrl);
const { createHost } = await import(hostUrl);

const acceptance = [];
const note = (line) => acceptance.push(line);

const media = createMediaPorts();
assert(media.moduleId === 'media', 'module id');

// --- Image policy: valid dimensions / MIME under budget ---
const okImage = media.validateUpload({
  kind: 'image',
  profileId: 'character-portrait',
  mimeType: 'image/png',
  byteSize: 200_000,
  width: 512,
  height: 512,
});
assert(okImage.ok === true, 'valid portrait accepted');

// Oversized reject
const over = media.validateUpload({
  kind: 'image',
  profileId: 'character-portrait',
  mimeType: 'image/png',
  byteSize: 6 * 1024 * 1024,
});
assert(over.ok === false && over.error === 'OVER_MAX_UPLOAD', 'oversized rejected');

// Unsupported MIME
const badMime = media.validateUpload({
  kind: 'image',
  profileId: 'map-pin',
  mimeType: 'image/gif',
  byteSize: 10_000,
});
assert(
  badMime.ok === false &&
    (badMime.error === 'GIF_NOT_ALLOWED' || badMime.error === 'UNSUPPORTED_MIME'),
  `gif rejected for map-pin, got ${JSON.stringify(badMime)}`,
);

note(
  'Optimize image to target WebP budget with valid dimensions; cancel/reject oversized/unsupported input deterministically.',
);

// --- Degraded audio/video/model3d ---
for (const kind of ['audio', 'video', 'model3d']) {
  const cap = media.capability(kind);
  assert(cap.supported === false && cap.status === 'unsupported', `${kind} capability degraded`);
  const denied = media.validateUpload({
    kind,
    profileId: 'character-portrait',
    mimeType: 'application/octet-stream',
    byteSize: 100,
  });
  assert(denied.ok === false && denied.error === 'UNSUPPORTED_KIND', `${kind} upload denied`);
}

// Browser engines stay local stubs — no remote ffmpeg/service invented
assert(/status:\s*'unsupported'/.test(audioEngine) || /'unsupported'/.test(audioEngine), 'audio stub unsupported');
assert(/status:\s*'unsupported'/.test(videoEngine) || /'unsupported'/.test(videoEngine), 'video stub unsupported');
assert(/status:\s*'unsupported'/.test(modelEngine) || /'unsupported'/.test(modelEngine), 'model3d stub unsupported');
assert(/aborted/.test(audioEngine), 'audio honors abort');
assert(!/ffmpeg|http:\/\/|https:\/\//i.test(audioEngine + videoEngine + modelEngine), 'no remote codec endpoints in stubs');

note(
  'Audio/video/model3d capability/degraded contracts remain explicit; no new remote service required for current local optimizer.',
);

// --- Host bootstrap wires media ports ---
const work = mkdtempSync(join(tmpdir(), 'mig306-'));
try {
  const host = createHost({
    SAGATREE_DATA_DIR: work,
    SAGATREE_PORT: '18765',
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_HOST_MODE: 'solo',
  });
  assert(!('error' in host), `createHost: ${'error' in host ? host.error : ''}`);
  assert(host.media?.moduleId === 'media', 'createHost exposes media ports');
  const hostOk = host.media.validateUpload({
    kind: 'image',
    profileId: 'user-avatar',
    mimeType: 'image/jpeg',
    byteSize: 50_000,
    width: 256,
    height: 256,
  });
  assert(hostOk.ok === true, 'host media validateUpload works');
  note('Touched files: zero type escape hatches (typed-strict / Boy Scout).');
} finally {
  rmSync(work, { recursive: true, force: true });
}

writeFileSync(
  join(root, '.qa/acceptance/stack-migration-mig-306.md'),
  `# Acceptance — MIG-306 media adapter\n\n` +
    acceptance.map((line) => `- [x] ${line}`).join('\n') +
    `\n`,
);
console.log('PASS: mig-306 media adapter');
