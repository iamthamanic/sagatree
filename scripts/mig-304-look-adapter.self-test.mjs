#!/usr/bin/env node
/**
 * mig-304-look-adapter.self-test — LookProfile host ports + dual-path seam (#803).
 * Location: scripts/mig-304-look-adapter.self-test.mjs
 *
 * Acceptance tier: isolated-contract. Supabase facades stay live (no cutover).
 * Ref-analysis quarantine remains MIG-412; runtime style adapters stay local.
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const lookUrl = pathToFileURL(join(root, 'server/src/modules/look/index.ts')).href;
const hostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;
const appUrl = pathToFileURL(
  join(root, 'server/src/application/look-reference-analysis/index.ts'),
).href;

const { bootstrapHostPersistence, TABLE_OWNERSHIP } = await import(persistenceUrl);
const {
  createLookPorts,
  LOOK_PROFILE_PUBLIC_ACTIVATION_AUTHORIZED,
  LOOK_REFERENCE_PUBLIC_ACTIVATION_AUTHORIZED,
  assertOwnerScopedStoragePath,
} = await import(lookUrl);
const { createHost } = await import(hostUrl);
const { parseLookReferences } = await import(appUrl);

/** Load real Vite extensionless adapter into Node via rewritten temp copies. */
const adapterLoadDir = mkdtempSync(join(tmpdir(), 'mig304-adapter-'));
function rewriteTsImports(source) {
  return source.replace(/from ['"](\.[^'"]+)['"]/g, (full, spec) => {
    if (/\.(ts|js|mjs|cjs|json)$/.test(spec)) return full;
    return `from '${spec}.ts'`;
  });
}
for (const name of ['host-look-ports.contract.ts', 'host-look-adapter.ts']) {
  const src = readFileSync(join(root, 'src/infrastructure/look', name), 'utf8');
  writeFileSync(join(adapterLoadDir, name), rewriteTsImports(src));
}
const [{ createHostLookAdapter }, { HOST_LOOK_PROFILE_OPS }] = await Promise.all([
  import(pathToFileURL(join(adapterLoadDir, 'host-look-adapter.ts')).href),
  import(pathToFileURL(join(adapterLoadDir, 'host-look-ports.contract.ts')).href),
]);
assert(typeof createHostLookAdapter === 'function', 'createHostLookAdapter loaded');
assert(
  Array.isArray(HOST_LOOK_PROFILE_OPS) && HOST_LOOK_PROFILE_OPS.length === 7,
  'HOST_LOOK_PROFILE_OPS count',
);

const work = mkdtempSync(join(tmpdir(), 'mig304-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });

try {
  assert(LOOK_PROFILE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no LookProfile HTTP mount');
  assert(LOOK_REFERENCE_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no ref-analysis HTTP mount');
  assert(TABLE_OWNERSHIP.look_profiles === 'look', 'look_profiles ownership');
  assert(TABLE_OWNERSHIP.look_profile_versions === 'look', 'look_profile_versions ownership');

  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);

  const look = createLookPorts({ db: boot.db });
  assert(look.moduleId === 'look', 'module id');

  const owner = actor('owner-o');
  const stranger = actor('stranger-x');

  const draft = {
    displayName: 'Nordlicht',
    source: 'manual',
    references: [
      { id: 'r1', kind: 'style', uri: 'asset://look/ref-1', weight: 0.8 },
      { id: 'r2', kind: 'content', uri: 'asset://look/ref-2' },
    ],
    capabilities: ['character', 'lighting'],
    executionModes: ['realtime'],
    ownerScope: 'player-character',
  };

  // --- Fall 1: create / append / duplicate / archive / reload public IDs ---
  const created = look.createProfile(owner, draft);
  assert(created.ok, `create: ${created.ok ? '' : created.error}`);
  assert(/^LK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(created.value.profile.publicId), 'LK public id');
  assert(created.value.profile.currentVersion === 1, 'version 1');
  assert(created.value.current.displayName === 'Nordlicht', 'display name');
  assert(created.value.current.references.length === 2, 'refs preserved');
  assert(created.value.status === 'active', 'active');
  const publicId = created.value.profile.publicId;
  const profileId = created.value.profile.id;

  const appended = look.appendVersion(owner, profileId, {
    ...draft,
    displayName: 'Nordlicht v2',
    capabilities: ['character', 'lighting', 'postFx'],
  });
  assert(appended.ok, `append: ${appended.ok ? '' : appended.error}`);
  assert(appended.value.profile.currentVersion === 2, 'version 2');
  assert(appended.value.profile.publicId === publicId, 'public id immutable on append');
  assert(appended.value.current.displayName === 'Nordlicht v2', 'append payload');

  const versions = look.listVersions(owner, profileId);
  assert(versions.ok && versions.value.length === 2, 'two immutable versions');
  assert(versions.value[0].displayName === 'Nordlicht', 'v1 immutable');

  const dup = look.duplicateProfile(owner, profileId);
  assert(dup.ok, `duplicate: ${dup.ok ? '' : dup.error}`);
  assert(dup.value.profile.id !== profileId, 'new id on duplicate');
  assert(dup.value.profile.publicId !== publicId, 'new public id on duplicate');
  assert(dup.value.profile.currentVersion === 1, 'dup starts at v1');
  assert(/\(Kopie\)/.test(dup.value.current.displayName), 'copy name');

  const archived = look.archiveProfile(owner, profileId);
  assert(archived.ok && archived.value.status === 'archived', 'archived');
  assert(archived.value.profile.publicId === publicId, 'public id after archive');

  const listedActive = look.listProfiles(owner);
  assert(listedActive.ok, 'list ok');
  assert(
    listedActive.value.every((r) => r.profile.id !== profileId),
    'archived hidden by default',
  );
  const listedAll = look.listProfiles(owner, { includeArchived: true });
  assert(
    listedAll.ok && listedAll.value.some((r) => r.profile.id === profileId),
    'includeArchived shows archived',
  );

  const reloaded = look.getProfileById(owner, profileId);
  assert(reloaded.ok && reloaded.value?.profile.publicId === publicId, 'reload same public id');

  // Foreign DENY
  const foreignList = look.listProfiles(stranger);
  assert(foreignList.ok && foreignList.value.length === 0, 'foreign list empty');
  const foreignGet = look.getProfileById(stranger, profileId);
  assert(foreignGet.ok === false && foreignGet.error === 'not-authorized', 'foreign get DENY');
  const foreignAppend = look.appendVersion(stranger, profileId, draft);
  assert(foreignAppend.ok === false && foreignAppend.error === 'not-authorized', 'foreign append DENY');
  const foreignArchive = look.archiveProfile(stranger, profileId);
  assert(foreignArchive.ok === false && foreignArchive.error === 'not-authorized', 'foreign archive DENY');
  const foreignDup = look.duplicateProfile(stranger, profileId);
  assert(foreignDup.ok === false && foreignDup.error === 'not-authorized', 'foreign dup DENY');

  const missingActor = look.createProfile(null, draft);
  assert(missingActor.ok === false && missingActor.error === 'missing-actor', 'missing actor DENY');

  const badDraft = look.createProfile(owner, {
    displayName: 'x',
    source: 'manual',
    executionModes: ['realtime'],
    toonLab: { secret: true },
  });
  assert(badDraft.ok === false, 'provider blob rejected');

  // Dual-path adapter seam: bind host ports through FE contract
  const bound = createHostLookAdapter({
    listProfiles: async (actorId, options) =>
      look.listProfiles(actor(actorId), options),
    getProfileById: async (actorId, id) => look.getProfileById(actor(actorId), id),
    createProfile: async (actorId, d) => look.createProfile(actor(actorId), d),
    appendVersion: async (actorId, id, d) => look.appendVersion(actor(actorId), id, d),
    archiveProfile: async (actorId, id) => look.archiveProfile(actor(actorId), id),
    duplicateProfile: async (actorId, id, name) =>
      look.duplicateProfile(actor(actorId), id, name),
    listVersions: async (actorId, id) => look.listVersions(actor(actorId), id),
  });
  assert(bound.transport === 'host', 'adapter transport');
  const viaAdapter = await bound.createProfile(owner.actorId, {
    displayName: 'Adapter Look',
    source: 'preset',
    references: [],
    capabilities: ['character'],
    executionModes: ['realtime', 'rendered'],
  });
  assert(viaAdapter.ok && viaAdapter.value.profile.publicId.startsWith('LK-'), 'adapter create');

  // create-host wires look ports
  const hostWork = mkdtempSync(join(tmpdir(), 'mig304-host-'));
  try {
    const host = createHost({
      SAGATREE_DATA_DIR: hostWork,
      SAGATREE_PORT: '18767',
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_HOST_MODE: 'solo',
    });
    assert(!('error' in host), `createHost: ${'error' in host ? host.error : ''}`);
    assert(host.look?.moduleId === 'look', 'create-host exposes look ports');
  } finally {
    rmSync(hostWork, { recursive: true, force: true });
  }

  // --- Fall 2: reference analysis 1..10 + foreign storage DENY (MIG-412 ports) ---
  const pngBytes = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
  ]);
  const pngB64 = Buffer.from(pngBytes).toString('base64');
  function ref(id) {
    return {
      id,
      kind: 'style',
      mime: 'image/png',
      uri: `data:image/png;base64,${pngB64}`,
      contentBase64: pngB64,
    };
  }
  assert(parseLookReferences([ref('a')]).length === 1, '1 ref ok');
  assert(
    parseLookReferences(Array.from({ length: 10 }, (_, i) => ref(`i${i}`))).length === 10,
    '10 refs ok',
  );
  let threw = false;
  try {
    parseLookReferences(Array.from({ length: 11 }, (_, i) => ref(`i${i}`)));
  } catch {
    threw = true;
  }
  assert(threw, '11 refs rejected');
  threw = false;
  try {
    assertOwnerScopedStoragePath('foreign-user/path.png', 'owner-o');
  } catch {
    threw = true;
  }
  assert(threw, 'foreign storage path DENY');
  assert(
    assertOwnerScopedStoragePath('owner-o/looks/a.png', 'owner-o') === 'owner-o/looks/a.png',
    'owner storage path ok',
  );

  // --- Fall 3: local runtime adapters unchanged (no persistence transport) ---
  const runtimeSrc = readFileSync(join(root, 'src/infrastructure/look/look-runtime.ts'), 'utf8');
  const hostMtoon = readFileSync(
    join(root, 'src/infrastructure/look/adapters/host-mtoon-look-adapter.ts'),
    'utf8',
  );
  const toonlab = readFileSync(
    join(root, 'src/infrastructure/look/adapters/toonlab-look-adapter.ts'),
    'utf8',
  );
  assert(!/supabase|look_profiles|createLookPorts/.test(runtimeSrc), 'runtime no persistence');
  assert(!/supabase|look_profiles/.test(hostMtoon), 'host-mtoon no persistence');
  assert(!/supabase|look_profiles/.test(toonlab), 'toonlab no persistence');

  // Client dual-path wiring + Supabase default remains
  const serviceSrc = readFileSync(join(root, 'src/infrastructure/look/look-service.ts'), 'utf8');
  const indexSrc = readFileSync(join(root, 'src/infrastructure/look/index.ts'), 'utf8');
  const adapterSrc = readFileSync(
    join(root, 'src/infrastructure/look/host-look-adapter.ts'),
    'utf8',
  );
  assert(/supabaseLookProfileRepository/.test(serviceSrc), 'service default remains Supabase');
  assert(/createHostLookAdapter/.test(indexSrc), 'barrel exports host adapter');
  assert(/transport: 'host'/.test(adapterSrc), 'adapter marks host transport');
  assert(!/VITE_SAGATREE_HOST_LOOK/.test(serviceSrc), 'no accidental env cutover in service');

  const createApp = readFileSync(join(root, 'server/src/api/create-app.ts'), 'utf8');
  assert(!/look-profiles|lookProfiles|mountLook/i.test(createApp), 'no LookProfile HTTP mount yet');

  const allow = readFileSync(
    join(root, 'supabase/functions/_shared/edge-dispatcher-allowlist.ts'),
    'utf8',
  );
  assert(/look-reference-analysis/.test(allow), 'Edge look-reference-analysis still allowlisted');

  console.log('PASS mig-304-look-adapter.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(adapterLoadDir, { recursive: true, force: true });
}
