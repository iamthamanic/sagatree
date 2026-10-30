#!/usr/bin/env node
/**
 * mig-302-character-adapter.self-test — Character sheet host ports + dual-path (#801).
 * Location: scripts/mig-302-character-adapter.self-test.mjs
 *
 * Acceptance tier: isolated-contract. Supabase facades stay live (no cutover).
 * Creator/VRM rendering utilities remain client-side under src/infrastructure/character.
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const characterUrl = pathToFileURL(join(root, 'server/src/modules/character/index.ts')).href;
const hostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;

const { bootstrapHostPersistence, TABLE_OWNERSHIP } = await import(persistenceUrl);
const {
  createCharacterPorts,
  CHARACTER_INFRA_PUBLIC_ACTIVATION_AUTHORIZED,
  CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED,
  CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED,
  assertCharacterOwnerStoragePath,
} = await import(characterUrl);
const { createHost } = await import(hostUrl);

const adapterLoadDir = mkdtempSync(join(tmpdir(), 'mig302-adapter-'));
function rewriteTsImports(source) {
  return source.replace(/from ['"](\.[^'"]+)['"]/g, (full, spec) => {
    if (/\.(ts|js|mjs|cjs|json)$/.test(spec)) return full;
    return `from '${spec}.ts'`;
  });
}
for (const name of ['host-character-ports.contract.ts', 'host-character-adapter.ts']) {
  const src = readFileSync(join(root, 'src/infrastructure/character', name), 'utf8');
  writeFileSync(join(adapterLoadDir, name), rewriteTsImports(src));
}
const [{ createHostCharacterAdapter }, { HOST_CHARACTER_OPS }] = await Promise.all([
  import(pathToFileURL(join(adapterLoadDir, 'host-character-adapter.ts')).href),
  import(pathToFileURL(join(adapterLoadDir, 'host-character-ports.contract.ts')).href),
]);
assert(typeof createHostCharacterAdapter === 'function', 'createHostCharacterAdapter loaded');
assert(
  Array.isArray(HOST_CHARACTER_OPS) && HOST_CHARACTER_OPS.length === 7,
  'HOST_CHARACTER_OPS count',
);

const work = mkdtempSync(join(tmpdir(), 'mig302-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir, { recursive: true });

try {
  assert(CHARACTER_INFRA_PUBLIC_ACTIVATION_AUTHORIZED === false, 'no character sheet HTTP mount');
  assert(TABLE_OWNERSHIP.characters === 'character', 'characters ownership');
  assert(TABLE_OWNERSHIP.character_presets === 'character', 'character_presets ownership');
  assert(
    TABLE_OWNERSHIP.character_avatar_artifacts === 'character',
    'character_avatar_artifacts ownership',
  );

  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);

  const character = createCharacterPorts(boot.db);
  assert(character.moduleId === 'character', 'module id');

  const owner = 'owner-o';
  const stranger = 'stranger-x';

  // --- Fall 1: create / read / edit / delete + reload; foreign DENY ---
  const draft = character.createOwnedCharacter(owner, {
    name: 'Lyra',
    description: 'Scout',
    level: 2,
    sheetStatus: 'draft',
    sheet: { attributes: { dex: 14 }, notes: 'draft sheet' },
  });
  assert(draft.ok, `create draft: ${draft.ok ? '' : draft.error}`);
  assert(/^CH-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(draft.value.publicId), 'CH public id');
  assert(draft.value.sheetStatus === 'draft', 'draft status');
  assert(draft.value.sheet.attributes?.dex === 14, 'sheet payload');
  const characterId = draft.value.id;
  const publicId = draft.value.publicId;

  const incompleteElevate = character.updateOwnedCharacter(owner, characterId, {
    sheetStatus: 'complete',
    name: 'Lyra Dawn',
    sheet: { attributes: { dex: 16 }, notes: 'incomplete elevate' },
  });
  assert(
    incompleteElevate.ok === false && incompleteElevate.error === 'incomplete-sheet',
    'empty complete elevation DENY',
  );

  const completeSheet = {
    class: 'Scout',
    race: 'Elf',
    profile: { origin: 'Nordlicht' },
    attributes: { dex: 16 },
    skills: { stealth: 2 },
    notes: 'complete',
  };
  const complete = character.updateOwnedCharacter(owner, characterId, {
    sheetStatus: 'complete',
    name: 'Lyra Dawn',
    level: 2,
    sheet: completeSheet,
  });
  assert(complete.ok, `update complete: ${complete.ok ? '' : complete.error}`);
  assert(complete.value.sheetStatus === 'complete', 'complete status');
  assert(complete.value.name === 'Lyra Dawn', 'renamed');
  assert(complete.value.publicId === publicId, 'public id immutable');

  const reloaded = character.getOwnedCharacter(owner, characterId);
  assert(reloaded.ok && reloaded.value?.publicId === publicId, 'reload same public id');
  assert(reloaded.value?.sheet.attributes?.dex === 16, 'reload sheet');

  const listed = character.listOwnedCharacters(owner);
  assert(listed.ok && listed.value.some((c) => c.id === characterId), 'list includes own');

  const foreignList = character.listOwnedCharacters(stranger);
  assert(foreignList.ok && foreignList.value.length === 0, 'foreign list empty');
  const foreignGet = character.getOwnedCharacter(stranger, characterId);
  assert(foreignGet.ok === false && foreignGet.error === 'not-authorized', 'foreign get DENY');
  const foreignUpdate = character.updateOwnedCharacter(stranger, characterId, { name: 'Hijack' });
  assert(
    foreignUpdate.ok === false && foreignUpdate.error === 'not-authorized',
    'foreign update DENY',
  );
  const foreignDelete = character.deleteOwnedCharacter(stranger, characterId);
  assert(
    foreignDelete.ok === false && foreignDelete.error === 'not-authorized',
    'foreign delete DENY',
  );

  const foreignPortrait = character.createOwnedCharacter(owner, {
    name: 'Bad Path',
    portraitStoragePath: `${stranger}/portraits/x.webp`,
  });
  assert(
    foreignPortrait.ok === false && foreignPortrait.error === 'foreign-storage-path',
    'cross-owner portrait path DENY on create',
  );

  const deleted = character.deleteOwnedCharacter(owner, characterId);
  assert(deleted.ok && deleted.value.id === characterId, 'soft delete');
  const afterDelete = character.getOwnedCharacter(owner, characterId);
  assert(afterDelete.ok && afterDelete.value === null, 'deleted hidden');

  // --- Fall 2: meshy/lore shapes retained; rendering stays client-side ---
  assert(
    CHARACTER_AVATAR_MESHY_PUBLIC_ACTIVATION_AUTHORIZED === false,
    'meshy edge stays unmounted (shape retained in module)',
  );
  assert(
    CHARACTER_LORE_PUBLIC_ACTIVATION_AUTHORIZED === false,
    'lore edge stays unmounted (shape retained in module)',
  );
  const clientRenderPaths = [
    'src/infrastructure/character/avatar/character-studio-runtime.ts',
    'src/infrastructure/character/avatar/avatar-facial-runtime.ts',
    'src/infrastructure/character/liveact/vrm-liveact-avatar-output.ts',
    'src/infrastructure/character/character-service.ts',
    'src/infrastructure/character/character-lore-service.ts',
    'src/infrastructure/character/character-preset-service.ts',
  ];
  for (const rel of clientRenderPaths) {
    assert(existsSync(join(root, rel)), `client shape retained: ${rel}`);
  }
  const hostSheetSrc = readFileSync(
    join(root, 'server/src/modules/character/internal/character-sheet-store.ts'),
    'utf8',
  );
  assert(!/THREE|@pixiv\/three-vrm|WebGLRenderer/.test(hostSheetSrc), 'no VRM/Three in host sheet store');

  // --- Fall 3: presets catalog + foreign artifact path DENY ---
  character.seedPublicPresetForTests({
    slug: 'starter-scout',
    displayName: 'Starter Scout',
    sheet: { archetype: 'scout' },
  });
  character.seedPublicPresetForTests({
    slug: 'starter-mage',
    displayName: 'Starter Mage',
    sheet: { archetype: 'mage' },
  });
  const presets = character.listReadablePresets(owner);
  assert(presets.ok && presets.value.length >= 2, 'public presets readable');
  assert(
    presets.value.every((p) => p.visibility === 'public'),
    'catalog visibility public',
  );

  const alive = character.createOwnedCharacter(owner, {
    name: 'Artifact PC',
    sheetStatus: 'complete',
    level: 1,
    sheet: {
      class: 'Fighter',
      race: 'Human',
      profile: {},
      attributes: { str: 12 },
      skills: { athletics: 1 },
    },
    portraitStoragePath: `${owner}/portraits/a.webp`,
  });
  assert(alive.ok, `alive create: ${alive.ok ? '' : alive.error}`);
  const seededArt = character.seedArtifactForTests({
    ownerUserId: owner,
    characterId: alive.value.id,
    storagePath: `${owner}/avatars/model.glb`,
  });
  assert(seededArt.ok, `seed artifact: ${seededArt.ok ? '' : seededArt.error}`);
  const crossOwnerArt = character.seedArtifactForTests({
    ownerUserId: owner,
    characterId: alive.value.id,
    storagePath: `${owner}/avatars/hijack.glb`,
  });
  // Path owner matches; now attempt stranger character id under owner path fails ownership.
  const strangerPc = character.createOwnedCharacter(stranger, {
    name: 'Stranger PC',
    sheetStatus: 'draft',
  });
  assert(strangerPc.ok, 'stranger draft create');
  const fkDeny = character.seedArtifactForTests({
    ownerUserId: owner,
    characterId: strangerPc.value.id,
    storagePath: `${owner}/avatars/cross.glb`,
  });
  assert(
    fkDeny.ok === false && fkDeny.error === 'foreign-character-owner',
    'cross-owner artifact FK DENY',
  );
  assert(crossOwnerArt.ok, 'same-owner second artifact ok');

  const ownResolve = character.resolveOwnedArtifact(owner, `${owner}/avatars/model.glb`);
  assert(ownResolve.ok && ownResolve.value.characterId === alive.value.id, 'own artifact resolve');

  const foreignPath = assertCharacterOwnerStoragePath(owner, `${stranger}/avatars/model.glb`);
  assert(foreignPath.ok === false && foreignPath.error === 'foreign-storage-path', 'path helper DENY');
  const foreignResolve = character.resolveOwnedArtifact(stranger, `${owner}/avatars/model.glb`);
  assert(
    foreignResolve.ok === false && foreignResolve.error === 'foreign-storage-path',
    'foreign actor cannot resolve owner path',
  );
  const strangerOwnMissing = character.resolveOwnedArtifact(stranger, `${stranger}/avatars/x.glb`);
  assert(
    strangerOwnMissing.ok === false && strangerOwnMissing.error === 'not-found',
    'missing artifact not-found',
  );

  // Soft-deleted PC: resolve hides artifacts (parity with seedArtifact deleted_at guard).
  const softDel = character.deleteOwnedCharacter(owner, alive.value.id);
  assert(softDel.ok, 'soft-delete artifact PC');
  const softResolve = character.resolveOwnedArtifact(owner, `${owner}/avatars/model.glb`);
  assert(
    softResolve.ok === false && softResolve.error === 'not-found',
    'soft-deleted PC artifact resolve DENY',
  );
  const softReseed = character.seedArtifactForTests({
    ownerUserId: owner,
    characterId: alive.value.id,
    storagePath: `${owner}/avatars/after-delete.glb`,
  });
  assert(
    softReseed.ok === false && softReseed.error === 'foreign-character-owner',
    'soft-deleted PC seedArtifact DENY',
  );

  // NPC parent: sheet ports are PC-only — artifact seed/resolve must not bind npc rows.
  const npcId = 'npc-artifact-parent';
  boot.db
    .prepare(
      `INSERT INTO characters (
         id, owner_user_id, character_type, sheet_status, name, created_at, public_id,
         updated_at, description, level, sheet_json, portrait_storage_path, deleted_at
       ) VALUES (?, ?, 'npc', 'complete', 'NPC Prop', ?, 'CH-NPCART1', ?, '', 1, '{}', NULL, NULL)`,
    )
    .run(npcId, owner, new Date().toISOString(), new Date().toISOString());
  const npcSeed = character.seedArtifactForTests({
    ownerUserId: owner,
    characterId: npcId,
    storagePath: `${owner}/avatars/npc.glb`,
  });
  assert(
    npcSeed.ok === false && npcSeed.error === 'foreign-character-owner',
    'npc parent seedArtifact DENY',
  );
  // Bypass port to plant a legacy artifact row, then confirm resolve still hides npc parents.
  boot.db
    .prepare(
      `INSERT INTO character_avatar_artifacts
         (id, character_id, owner_user_id, storage_path, kind, created_at)
       VALUES ('art-npc-1', ?, ?, ?, 'artifact', ?)`,
    )
    .run(npcId, owner, `${owner}/avatars/npc-legacy.glb`, new Date().toISOString());
  const npcResolve = character.resolveOwnedArtifact(owner, `${owner}/avatars/npc-legacy.glb`);
  assert(
    npcResolve.ok === false && npcResolve.error === 'not-found',
    'npc parent artifact resolve DENY',
  );

  // Dual-path adapter seam
  const bound = createHostCharacterAdapter({
    listOwnedCharacters: async (actorId) => character.listOwnedCharacters(actorId),
    getOwnedCharacter: async (actorId, id) => character.getOwnedCharacter(actorId, id),
    createOwnedCharacter: async (actorId, d) => character.createOwnedCharacter(actorId, d),
    updateOwnedCharacter: async (actorId, id, d) => character.updateOwnedCharacter(actorId, id, d),
    deleteOwnedCharacter: async (actorId, id) => character.deleteOwnedCharacter(actorId, id),
    listReadablePresets: async (actorId) => character.listReadablePresets(actorId),
    resolveOwnedArtifact: async (actorId, path) => character.resolveOwnedArtifact(actorId, path),
  });
  assert(bound.transport === 'host', 'adapter transport');
  const viaAdapter = await bound.createOwnedCharacter(owner, {
    name: 'Adapter PC',
    sheetStatus: 'draft',
    sheet: { via: 'adapter' },
  });
  assert(viaAdapter.ok && viaAdapter.value.publicId.startsWith('CH-'), 'adapter create');

  // create-host wires character sheet ports
  const hostWork = mkdtempSync(join(tmpdir(), 'mig302-host-'));
  try {
    const host = createHost({
      SAGATREE_DATA_DIR: hostWork,
      SAGATREE_PORT: '18768',
      SAGATREE_HOST: '127.0.0.1',
      SAGATREE_HOST_MODE: 'solo',
    });
    assert(!('error' in host), `createHost: ${'error' in host ? host.error : ''}`);
    assert(host.character?.moduleId === 'character', 'create-host exposes character ports');
    const hostCreate = host.character.createOwnedCharacter('host-owner', {
      name: 'Host PC',
      sheetStatus: 'complete',
      level: 1,
      sheet: {
        class: 'Mage',
        race: 'Human',
        profile: {},
        attributes: { int: 14 },
        skills: { arcana: 1 },
      },
    });
    assert(hostCreate.ok, `host create: ${hostCreate.ok ? '' : hostCreate.error}`);
    const deletedBind = host.character.deleteOwnedCharacter(
      'host-owner',
      hostCreate.value.id,
    );
    assert(deletedBind.ok, 'host soft-delete');
    const membership = host.character.assertOwnedCompletePc(
      'host-owner',
      hostCreate.value.id,
    );
    assert(membership.ok === false, 'soft-deleted PC fails membership complete check');
  } finally {
    rmSync(hostWork, { recursive: true, force: true });
  }

  console.log('PASS: mig-302-character-adapter.self-test');
} finally {
  rmSync(work, { recursive: true, force: true });
  rmSync(adapterLoadDir, { recursive: true, force: true });
}
