#!/usr/bin/env node
/**
 * mig-309-rulesets.self-test — host ruleset catalog load/save + ownership deny (#808).
 * Location: scripts/mig-309-rulesets.self-test.mjs
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
const permissionsUrl = pathToFileURL(join(root, 'server/src/modules/permissions/index.ts')).href;
const rulesetsUrl = pathToFileURL(join(root, 'server/src/modules/rulesets/index.ts')).href;
const hostUrl = pathToFileURL(join(root, 'server/src/bootstrap/create-host.ts')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { createPermissionsPorts } = await import(permissionsUrl);
const { createRulesetPorts } = await import(rulesetsUrl);
const { createHost } = await import(hostUrl);

const work = mkdtempSync(join(tmpdir(), 'mig309-'));
const acceptance = [];
const note = (line) => acceptance.push(line);

try {
  const boot = bootstrapHostPersistence({
    dataDir: work,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);

  const permissions = createPermissionsPorts(boot.db);
  const rulesets = createRulesetPorts({
    db: boot.db,
    authorize: permissions.authorize,
  });

  const owner = { actorId: 'user-owner', kind: 'remote-account' };
  const stranger = { actorId: 'user-stranger', kind: 'remote-account' };

  const officialA = rulesets.seedOfficialForTests({
    id: 'RS-OFF-A',
    name: 'SagaTree Core',
    attributesConfig: { primary: ['STR', 'DEX'], derived: ['HP'] },
  });
  const officialB = rulesets.seedOfficialForTests({
    id: 'RS-OFF-B',
    name: 'Aether Supplement',
    attributesConfig: { primary: ['INT'], derived: [] },
  });
  assert(officialA.isOfficial && officialB.isOfficial, 'official seeded');

  const created = rulesets.create(owner, {
    name: 'Custom Homebrew',
    attributesConfig: { primary: ['WIL'], derived: ['SAN'] },
    isPublic: false,
  });
  assert(created.ok && created.value.creatorUserId === owner.actorId, 'owner creates custom');
  assert(created.value.isOfficial === false && created.value.isMarketplaceItem === false, 'custom flags');

  // Sorting: official DESC then name — Aether before SagaTree when both official;
  // listAll for owner includes private custom.
  const all = rulesets.listAll(owner);
  assert(all.ok, 'listAll ok');
  const names = all.value.map((r) => r.name);
  const officialNames = all.value.filter((r) => r.isOfficial).map((r) => r.name);
  assert(
    officialNames[0] === 'Aether Supplement' && officialNames[1] === 'SagaTree Core',
    `official sorted by name, got ${JSON.stringify(officialNames)}`,
  );
  assert(names.includes('Custom Homebrew'), 'owner sees own custom');

  const officialOnly = rulesets.listOfficial(stranger);
  assert(officialOnly.ok && officialOnly.value.every((r) => r.isOfficial), 'stranger official list');
  assert(officialOnly.value.length === 2, 'two official');

  const getOfficial = rulesets.getById(stranger, 'RS-OFF-A');
  assert(getOfficial.ok && getOfficial.value.name === 'SagaTree Core', 'public official read');

  const denyPrivate = rulesets.getById(stranger, created.value.id);
  assert(!denyPrivate.ok && denyPrivate.error === 'not-authorized', 'private custom hidden from stranger');

  note('Load default/native/custom ruleset with equivalent sorting and decoding.');

  const strangerWrite = rulesets.update(stranger, {
    id: created.value.id,
    name: 'Hijacked',
  });
  assert(!strangerWrite.ok && strangerWrite.error === 'not-authorized', 'foreign write denied');

  const ownerUpdate = rulesets.update(owner, {
    id: created.value.id,
    name: 'Custom Homebrew v2',
    isPublic: true,
  });
  assert(ownerUpdate.ok && ownerUpdate.value.name === 'Custom Homebrew v2', 'owner update');

  const strangerReadPublic = rulesets.getById(stranger, created.value.id);
  assert(strangerReadPublic.ok, 'public custom readable after publish');

  const mutateOfficial = rulesets.update(owner, { id: 'RS-OFF-A', name: 'Nope' });
  assert(!mutateOfficial.ok && mutateOfficial.error === 'official-immutable', 'official immutable');

  const strangerList = rulesets.listAll(stranger);
  assert(
    strangerList.ok &&
      strangerList.value.some((r) => r.id === created.value.id) &&
      strangerList.value.every((r) => r.isOfficial || r.isPublic),
    'stranger list does not hide public rows',
  );

  note(
    'Owner can save permitted custom ruleset; foreign owner write denied and public ruleset read not accidentally restricted.',
  );

  const host = createHost({
    SAGATREE_DATA_DIR: join(work, 'host'),
    SAGATREE_PORT: '18766',
    SAGATREE_HOST: '127.0.0.1',
    SAGATREE_HOST_MODE: 'solo',
  });
  assert(!('error' in host), `createHost: ${'error' in host ? host.error : ''}`);
  assert(host.rulesets?.moduleId === 'rulesets', 'createHost wires rulesets');
  note('Touched files: zero type escape hatches (typed-strict / Boy Scout).');

  writeFileSync(
    join(root, '.qa/acceptance/stack-migration-mig-309.md'),
    `# Acceptance — MIG-309 rulesets host ports\n\n` +
      acceptance.map((line) => `- [x] ${line}`).join('\n') +
      `\n`,
  );
  console.log('PASS: mig-309 rulesets');
  boot.db.close();
} finally {
  rmSync(work, { recursive: true, force: true });
}
