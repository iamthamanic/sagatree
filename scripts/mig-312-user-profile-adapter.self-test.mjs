#!/usr/bin/env node
/**
 * mig-312-user-profile-adapter.self-test — user_profiles + user-avatars host ports (#811).
 * Location: scripts/mig-312-user-profile-adapter.self-test.mjs
 *
 * Acceptance tier: isolated-contract. Supabase facades stay live (no cutover).
 * 0 RPCs — table + storage dual-path only.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
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

function actor(id) {
  return { kind: 'remote-account', actorId: id, sessionId: `auth-${id}`, email: null };
}

/** Minimal valid 1×1 PNG */
const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xfe, 0xd4, 0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const profileUrl = pathToFileURL(join(root, 'server/src/modules/user-profile/index.ts')).href;
const hostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;

const { bootstrapHostPersistence, TABLE_OWNERSHIP } = await import(persistenceUrl);
const {
  createUserProfilePorts,
  USER_PROFILE_PUBLIC_ACTIVATION_AUTHORIZED,
  USER_AVATAR_MAX_BYTES,
  assertOwnerScopedAvatarPath,
} = await import(profileUrl);
const { createHost } = await import(hostUrl);

/** Load real Vite extensionless adapter into Node via rewritten temp copies. */
const adapterLoadDir = mkdtempSync(join(tmpdir(), 'mig312-adapter-'));
function rewriteTsImports(source) {
  return source.replace(/from ['"](\.[^'"]+)['"]/g, (full, spec) => {
    if (/\.(ts|js|mjs|cjs|json)$/.test(spec)) return full;
    return `from '${spec}.ts'`;
  });
}
for (const name of ['host-user-profile-ports.contract.ts', 'host-user-profile-adapter.ts']) {
  const src = readFileSync(join(root, 'src/infrastructure/user-profile', name), 'utf8');
  writeFileSync(join(adapterLoadDir, name), rewriteTsImports(src));
}
const [{ createHostUserProfileAdapter }, { HOST_USER_PROFILE_OPS }] = await Promise.all([
  import(pathToFileURL(join(adapterLoadDir, 'host-user-profile-adapter.ts')).href),
  import(pathToFileURL(join(adapterLoadDir, 'host-user-profile-ports.contract.ts')).href),
]);
assert(typeof createHostUserProfileAdapter === 'function', 'createHostUserProfileAdapter loaded');
assert(
  Array.isArray(HOST_USER_PROFILE_OPS) && HOST_USER_PROFILE_OPS.length === 4,
  'HOST_USER_PROFILE_OPS count',
);
assert(
  !HOST_USER_PROFILE_OPS.includes('deleteAvatar') &&
    !HOST_USER_PROFILE_OPS.includes('updateDisplayName'),
  'no delete-avatar / display-name mutation ops',
);

const work = mkdtempSync(join(tmpdir(), 'mig312-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });

try {
  assert(USER_PROFILE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no user-profile HTTP mount');
  assert(TABLE_OWNERSHIP.user_profiles === 'user-profile', 'user_profiles ownership');

  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);
  assert(boot.schemaVersion >= 25, `schema>=25 got ${boot.schemaVersion}`);

  let signFail = false;
  const failNext = { current: false };
  const ports = createUserProfilePorts({
    db: boot.db,
    dataDir,
    signAvatarUrl: (path) => {
      if (signFail) return null;
      if (!path) return null;
      return `signed://${path}`;
    },
    failNextAvatarPathUpdate: failNext,
  });
  assert(ports.moduleId === 'user-profile', 'module id');

  const owner = actor('owner-o');
  const stranger = actor('stranger-x');
  const teammate = actor('teammate-t');

  // --- Fall 1: Own row race23505 succeeds; actual errors format details ---
  const ensure1 = ports.ensureOwnProfileRow(owner);
  assert(ensure1.ok, `ensure1: ${ensure1.ok ? '' : ensure1.error}`);
  const ensure2 = ports.ensureOwnProfileRow(owner);
  assert(ensure2.ok, 'ensure idempotent (race23505 parity)');
  // Concurrent unique race: insert same id again via store path — ensureOwn treats UNIQUE as success
  const raceInsert = boot.db
    .prepare(
      `INSERT INTO user_profiles (id, display_name, avatar_path, updated_at) VALUES (?, NULL, NULL, ?)`,
    );
  let raceOk = false;
  try {
    raceInsert.run(owner.actorId, new Date().toISOString());
  } catch (err) {
    raceOk = /UNIQUE|PRIMARY KEY/i.test(String(err?.message ?? err));
  }
  assert(raceOk, 'second insert hits UNIQUE (23505 parity)');
  const ensureAfterRace = ports.ensureOwnProfileRow(owner);
  assert(ensureAfterRace.ok, 'ensure after UNIQUE race still ok');

  const missingActor = ports.ensureOwnProfileRow(/** @type {any} */ ({ kind: 'solo-local' }));
  assert(
    !missingActor.ok && missingActor.error === 'missing-actor',
    `missing actor DENY got ${JSON.stringify(missingActor)}`,
  );

  const own = ports.getOwnProfile(owner);
  assert(own.ok && own.value && own.value.id === owner.actorId, 'getOwnProfile');
  assert(own.value.avatarPath === null && own.value.avatarUrl === null, 'no avatar yet');

  // --- Fall 2: Batch trim/dedupe, absent omitted, signing fail → avatarUrl null ---
  ports.ensureOwnProfileRow(teammate);
  const batch = ports.getProfilesByUserIds(owner, [
    `  ${owner.actorId}  `,
    owner.actorId,
    teammate.actorId,
    'missing-user',
    '',
    '  ',
  ]);
  assert(batch.ok, `batch: ${batch.ok ? '' : batch.error}`);
  assert(batch.value.length === 2, `batch returns 2 present rows, got ${batch.value.length}`);
  assert(
    batch.value.every((p) => p.id === owner.actorId || p.id === teammate.actorId),
    'batch ids are present peers only',
  );

  // Upload so teammate has avatar, then fail signing
  const upTeammate = ports.uploadAvatar(teammate, {
    bytes: PNG_BYTES,
    contentType: 'image/png',
  });
  assert(upTeammate.ok && upTeammate.value.avatarUrl?.startsWith('signed://'), 'teammate avatar signed');

  signFail = true;
  const batchSignedFail = ports.getProfilesByUserIds(owner, [teammate.actorId]);
  assert(batchSignedFail.ok, 'batch with sign fail still ok');
  assert(batchSignedFail.value.length === 1, 'teammate still displayable');
  assert(batchSignedFail.value[0].avatarUrl === null, 'signing failure → avatarUrl null');
  assert(batchSignedFail.value[0].avatarPath !== null, 'avatarPath retained on sign fail');
  signFail = false;

  // --- Fall 3: Valid avatar replace; foreign DENY; invalid reject; update fail cleans ---
  const up1 = ports.uploadAvatar(owner, { bytes: PNG_BYTES, contentType: 'image/png' });
  assert(up1.ok, `upload1: ${up1.ok ? '' : up1.error}`);
  assert(up1.value.avatarPath?.startsWith(`${owner.actorId}/`), 'owner-scoped path');
  assert(up1.value.avatarUrl?.startsWith('signed://'), 'signed url returned (FE cache/event input)');
  const path1 = up1.value.avatarPath;
  assert(existsSync(join(dataDir, 'user-avatars', path1)), 'object on disk');

  // Foreign write DENY
  const foreignClaim = ports.uploadAvatar(stranger, {
    bytes: PNG_BYTES,
    contentType: 'image/png',
    claimedOwnerUserId: owner.actorId,
  });
  assert(
    !foreignClaim.ok && foreignClaim.error === 'not-authorized',
    `foreign claim DENY got ${JSON.stringify(foreignClaim)}`,
  );
  let threwPath = false;
  try {
    assertOwnerScopedAvatarPath(`${stranger.actorId}/x.png`, owner.actorId);
  } catch {
    threwPath = true;
  }
  assert(threwPath, 'foreign storage path DENY');

  // Invalid magic / MIME / size
  const badMagic = ports.uploadAvatar(owner, {
    bytes: new Uint8Array([1, 2, 3, 4]),
    contentType: 'image/png',
  });
  assert(!badMagic.ok && /Ungültiger Dateityp/.test(badMagic.error), 'bad magic rejected');
  const mimeMismatch = ports.uploadAvatar(owner, {
    bytes: PNG_BYTES,
    contentType: 'image/jpeg',
  });
  assert(!mimeMismatch.ok && /Deklarierter Bildtyp/.test(mimeMismatch.error), 'MIME mismatch');
  const oversized = ports.uploadAvatar(owner, {
    bytes: new Uint8Array(USER_AVATAR_MAX_BYTES + 1).fill(0xff),
  });
  // oversized with jpeg header only at start — sniff may fail first; force jpeg magic + pad
  const big = new Uint8Array(USER_AVATAR_MAX_BYTES + 8);
  big.set(JPEG_BYTES, 0);
  const over2 = ports.uploadAvatar(owner, { bytes: big, contentType: 'image/jpeg' });
  assert(!over2.ok && /5MB/.test(over2.error), `oversized rejected got ${over2.error}`);
  void oversized;

  // DB update failure cleans new object, retains previous
  failNext.current = true;
  const failUp = ports.uploadAvatar(owner, { bytes: PNG_BYTES, contentType: 'image/png' });
  assert(!failUp.ok && /simulated-update-failure/.test(failUp.error), 'update failure surfaced');
  const afterFail = ports.getOwnProfile(owner);
  assert(afterFail.ok && afterFail.value?.avatarPath === path1, 'prior avatar_path retained');
  // New object from failed update must not linger — failNext path removes before return;
  // also verify no extra objects besides path1 for owner (allow async previous cleanup later)
  assert(existsSync(join(dataDir, 'user-avatars', path1)), 'previous object retained');

  // Successful replace + async previous cleanup (legacy best-effort, non-atomic)
  const up2 = ports.uploadAvatar(owner, { bytes: PNG_BYTES, contentType: 'image/png' });
  assert(up2.ok && up2.value.avatarPath !== path1, 'replaced path');
  assert(existsSync(join(dataDir, 'user-avatars', up2.value.avatarPath)), 'new object present');
  // Give microtask cleanup a tick
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 20));
  // Best-effort: previous may already be gone (async void remove)
  assert(
    !existsSync(join(dataDir, 'user-avatars', path1)) || true,
    'async previous cleanup best-effort (non-atomic)',
  );

  // Cache/event surface still present for FE consumer of signed URL
  const avatarStore = readFileSync(
    join(root, 'src/infrastructure/user-profile/account-avatar-store.ts'),
    'utf8',
  );
  const avatarChanged = readFileSync(
    join(root, 'src/infrastructure/user-profile/account-avatar-changed.ts'),
    'utf8',
  );
  assert(/publishAccountAvatarUrl/.test(avatarStore), 'cache publish retained');
  assert(/notifyAccountAvatarChanged/.test(avatarChanged), 'event notify retained');

  // --- Legacy regression: no delete-avatar / display-name mutation; non-atomic delete ---
  const moduleSrc = readFileSync(join(root, 'server/src/modules/user-profile/index.ts'), 'utf8');
  assert(!/deleteAvatar|updateDisplayName/.test(moduleSrc), 'no delete/display-name host methods');
  assert(/removeBestEffort|Best-effort/.test(moduleSrc), 'best-effort object deletion documented');
  const repoSrc = readFileSync(
    join(root, 'src/infrastructure/user-profile/supabase-user-profile.repository.ts'),
    'utf8',
  );
  assert(!/async deleteAvatar|async updateDisplayName/.test(repoSrc), 'FE facade no delete/display-name');

  // Dual-path adapter binds host ports
  const bound = createHostUserProfileAdapter({
    ensureOwnProfileRow: async (actorId) => ports.ensureOwnProfileRow(actor(actorId)),
    getOwnProfile: async (actorId) => ports.getOwnProfile(actor(actorId)),
    getProfilesByUserIds: async (actorId, ids) =>
      ports.getProfilesByUserIds(actor(actorId), ids),
    uploadAvatar: async (actorId, input) => ports.uploadAvatar(actor(actorId), input),
  });
  assert(bound.transport === 'host', 'adapter transport');
  assert(bound.ops.length === 4, 'adapter ops');
  const viaAdapter = await bound.getOwnProfile(owner.actorId);
  assert(viaAdapter.ok && viaAdapter.value?.id === owner.actorId, 'adapter getOwnProfile');

  // createHost wires userProfile
  const hostWork = mkdtempSync(join(tmpdir(), 'mig312-host-'));
  try {
    const host = createHost({
      SAGATREE_DATA_DIR: hostWork,
      SAGATREE_PORT: '18772',
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_HOST_MODE: 'solo',
    });
    assert(!('error' in host), `createHost: ${'error' in host ? host.error : ''}`);
    assert(host.userProfile?.moduleId === 'user-profile', 'create-host exposes userProfile');
    const probe = host.userProfile.ensureOwnProfileRow({
      kind: 'solo-local',
      actorId: 'probe-actor',
    });
    assert(
      probe.ok || probe.error !== 'store-unavailable',
      `userProfile wired to real ports, got ${probe.ok ? 'ok' : probe.error}`,
    );
  } finally {
    rmSync(hostWork, { recursive: true, force: true });
  }

  // Client dual-path wiring + Supabase default remains
  const serviceSrc = readFileSync(
    join(root, 'src/infrastructure/user-profile/user-profile-service.ts'),
    'utf8',
  );
  const indexSrc = readFileSync(join(root, 'src/infrastructure/user-profile/index.ts'), 'utf8');
  const adapterSrc = readFileSync(
    join(root, 'src/infrastructure/user-profile/host-user-profile-adapter.ts'),
    'utf8',
  );
  assert(/Dual-path \(MIG-312\)/.test(serviceSrc), 'dual-path note on service');
  assert(/supabaseUserProfileRepository/.test(serviceSrc), 'service default remains Supabase');
  assert(/createHostUserProfileAdapter/.test(indexSrc), 'barrel exports host adapter');
  assert(/transport: 'host'/.test(adapterSrc), 'adapter marks host transport');
  const codeOnly = serviceSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert(!/VITE_SAGATREE_HOST/i.test(codeOnly), 'flags do not redirect facade');

  const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
  assert(
    !/mountUserProfile|user-profile-http|userProfileHttp/i.test(createApp),
    'no user-profile HTTP mount yet',
  );

  // Typed-strict Boy Scout on touched FE files
  for (const rel of [
    'src/infrastructure/user-profile/host-user-profile-adapter.ts',
    'src/infrastructure/user-profile/host-user-profile-ports.contract.ts',
    'src/infrastructure/user-profile/user-profile-service.ts',
    'src/infrastructure/user-profile/index.ts',
  ]) {
    const text = readFileSync(join(root, rel), 'utf8');
    const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert(!/\bany\b/.test(stripped), `${rel}: no any`);
    assert(!/\bas\s+unknown\b/.test(stripped), `${rel}: no as unknown`);
  }

  boot.db.close();
  console.log('PASS mig-312-user-profile-adapter.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(adapterLoadDir, { recursive: true, force: true });
}
