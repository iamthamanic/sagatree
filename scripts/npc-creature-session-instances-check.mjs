#!/usr/bin/env node
/**
 * npc-creature-session-instances-check — domain + wiring contract for #201.
 * Location: scripts/npc-creature-session-instances-check.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const require = createRequire(import.meta.url);
let failures = 0;
let group = '';

function section(name) {
  group = name;
}

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message}`);
  }
}

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

function mustExist(relPath) {
  check(existsSync(join(root, relPath)), `missing ${relPath}`);
}

section('1 · files exist');
[
  'src/domains/npc-creature/instance.ts',
  'src/infrastructure/npc-creature/npc-creature-instance.persistence.ts',
  'src/app/library/npc-creatures/NpcCreatureSpawnInstanceDialog.tsx',
  'src/app/session/AdventureNpcCreatureInstancesPanel.tsx',
  'archive/supabase-legacy/supabase/migrations/023_npc_creature_instances.sql',
  '.qa/acceptance/npc-creature-session-instances.md',
  '.qa/runs/composition-gate-npc-creature-session-instances.md',
  'e2e/npc-creature-session-instances.spec.ts',
].forEach(mustExist);

section('2 · static wiring / German UI / migration security');
{
  const browser = read('src/app/library/npc-creatures/NpcCreatureLibraryBrowser.tsx');
  check(/Zum Abenteuer hinzufügen/.test(browser), 'library spawn CTA string');
  check(/id: 'spawn'/.test(browser) && /Zum Abenteuer hinzufügen/.test(browser), 'library spawn menu action');
  check(/NpcCreatureSpawnInstanceDialog/.test(browser), 'wires spawn dialog');

  const spawnDialog = read(
    'src/app/library/npc-creatures/NpcCreatureSpawnInstanceDialog.tsx',
  );
  check(/data-npc-spawn-instance-dialog/.test(spawnDialog), 'spawn dialog hook');
  check(/data-npc-spawn-submit/.test(spawnDialog), 'spawn submit hook');
  check(/Einzigartig persistent/.test(spawnDialog), 'persistent kind label');

  const panel = read('src/app/session/AdventureNpcCreatureInstancesPanel.tsx');
  check(/data-npc-adventure-instances/.test(panel), 'adventure panel hook');
  check(/data-npc-adventure-instances-empty/.test(panel), 'empty state hook');
  check(/data-npc-adventure-instances-loading/.test(panel), 'loading hook');
  check(/data-npc-adventure-instances-error/.test(panel), 'error hook');
  check(/data-npc-instance-hp/.test(panel), 'hp input hook');
  check(/data-npc-instance-temp-controller/.test(panel), 'temp controller hook');
  check(/Noch keine Figuren in diesem Abenteuer/.test(panel), 'empty copy DE');

  const gm = read('src/app/session/GamemasterPanel.tsx');
  check(/AdventureNpcCreatureInstancesPanel/.test(gm), 'GM panel wires instances');
  check(/data-gm-tab-npcs/.test(gm), 'GM NPCs tab hook');

  const service = read('src/infrastructure/npc-creature/npc-creature-service.ts');
  check(/spawnNpcCreatureInstance/.test(service), 'service spawn');
  check(/listNpcCreatureInstances/.test(service), 'service list');
  check(/updateNpcCreatureInstanceRuntime/.test(service), 'service update runtime');
  check(/removeNpcCreatureInstance/.test(service), 'service remove');
  check(
    /clearNpcCreatureInstanceTempControllersForSession/.test(service),
    'service clear session temp controllers',
  );
  check(/planNpcCreatureInstanceSpawn/.test(service), 'domain plan before host spawn');
  check(/spawnHostNpcInstance/.test(service), 'host spawn (CUT-20)');
  check(/isHostLibraryEnabled/.test(service), 'host library gate');
  check(
    !/spawn_npc_creature_instance|update_npc_creature_instance_runtime|remove_npc_creature_instance|\.rpc\s*\(/.test(
      service,
    ),
    'no legacy NPC instance RPC (CUT-20)',
  );

  const index = read('src/domains/npc-creature/index.ts');
  check(/planNpcCreatureInstanceSpawn/.test(index), 'barrel exports spawn');
  check(/resolveInstanceAfterDefinitionChange/.test(index), 'barrel exports isolation');
  check(/clearTemporaryControllersForSession/.test(index), 'barrel exports session clear');

  const migration = read('archive/supabase-legacy/supabase/migrations/023_npc_creature_instances.sql');
  check(/npc_creature_instances/.test(migration), 'instances table');
  check(/spawn_npc_creature_instance/.test(migration), 'spawn RPC');
  check(/update_npc_creature_instance_runtime/.test(migration), 'update runtime RPC');
  check(/remove_npc_creature_instance/.test(migration), 'remove RPC');
  check(
    /clear_npc_creature_instance_temp_controllers_for_session/.test(migration),
    'session clear RPC',
  );
  check(/SECURITY DEFINER/.test(migration), 'SECURITY DEFINER RPCs');
  check(
    /GRANT SELECT ON TABLE public\.npc_creature_instances TO authenticated/.test(migration),
    'SELECT only for authenticated',
  );
  check(/Deliberately no INSERT/.test(migration), 'no direct INSERT policy');
  check(/Snapshot column intentionally untouched/.test(migration), 'runtime update preserves snapshot');
  check(/definition not readable/.test(migration), 'definition readability check');

  const apply = read('scripts/apply-migrations.sh');
  check(/022_npc_creature_controller_assignments\.sql/.test(apply), 'apply-migrations registers 022');
  check(/023_npc_creature_instances\.sql/.test(apply), 'apply-migrations registers 023');

  const libIndex = read('src/app/library/npc-creatures/index.ts');
  check(/NpcCreatureSpawnInstanceDialog/.test(libIndex), 'spawn dialog exported');
}

section('3 · domain offline tests');
{
  const esbuild = require('esbuild');
  const outdir = join(root, 'node_modules/.cache/npc-creature-session-instances-check');
  mkdirSync(outdir, { recursive: true });
  const outfile = join(outdir, 'npc.mjs');
  esbuild.buildSync({
    entryPoints: [join(root, 'src/domains/npc-creature/index.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const npc = await import(pathToFileURL(outfile).href);

  const wolf = npc.getBuiltinNpcCreatureDefinition('builtin.creature.animal.wolf');
  check(Boolean(wolf), 'builtin wolf exists');
  check(wolf?.name === 'Wolf', 'wolf name');

  const actor = 'gm-user-1';
  const members = [actor, 'player-2'];
  const ctxBase = {
    actorUserId: actor,
    actorRole: 'gm',
    activeMemberUserIds: members,
    existingInstances: [],
    definitionReadable: true,
    nowIso: '2026-09-14T12:00:00.000Z',
  };

  const spawn1 = npc.planNpcCreatureInstanceSpawn(
    wolf,
    {
      projectId: 'proj-1',
      definitionId: wolf.id,
      instanceKind: 'generic',
    },
    ctxBase,
  );
  check(spawn1.ok === true, 'spawn #1 ok');
  check(spawn1.snapshotIsolated === true, 'snapshotIsolated');
  check(spawn1.instance?.displayName === 'Wolf #1', 'displayName Wolf #1');
  check(spawn1.instance?.sequenceNumber === 1, 'sequence 1');
  check(
    spawn1.instance?.runtime?.currentHp === spawn1.instance?.snapshot?.maxHealth,
    'HP starts at max',
  );
  check(
    spawn1.instance?.runtime?.temporaryControllerUserId === null,
    'temp controller null at spawn',
  );

  const instance1 = {
    id: 'inst-1',
    ...spawn1.instance,
  };

  const spawn2 = npc.planNpcCreatureInstanceSpawn(
    wolf,
    {
      projectId: 'proj-1',
      definitionId: wolf.id,
      instanceKind: 'generic',
    },
    { ...ctxBase, existingInstances: [instance1] },
  );
  check(spawn2.ok === true, 'spawn #2 ok');
  check(spawn2.instance?.displayName === 'Wolf #2', 'displayName Wolf #2');
  check(spawn2.instance?.sequenceNumber === 2, 'sequence 2');

  const instance2 = { id: 'inst-2', ...spawn2.instance };

  // Independent runtime: damage wolf #1 only
  const dmg1 = npc.planNpcCreatureInstanceRuntimeUpdate(
    instance1,
    { currentHp: 1, conditions: ['Verwundet'] },
    ctxBase,
  );
  check(dmg1.ok === true, 'runtime update ok');
  check(dmg1.instance?.runtime?.currentHp === 1, 'wolf1 HP=1');
  check(instance2.runtime.currentHp === instance2.snapshot.maxHealth, 'wolf2 HP untouched');

  // Definition change must not rewrite snapshot
  const mutatedWolf = { ...wolf, name: 'Alpha-Wolf', level: 10 };
  const afterDefChange = npc.resolveInstanceAfterDefinitionChange(dmg1.instance, mutatedWolf);
  check(afterDefChange.snapshot.name === 'Wolf', 'snapshot name unchanged after def edit');
  check(
    afterDefChange.snapshot.maxHealth === dmg1.instance.snapshot.maxHealth,
    'snapshot maxHealth unchanged',
  );
  check(afterDefChange.runtime.currentHp === 1, 'runtime HP preserved after def edit');

  const playView = npc.resolveInstancePlayView(afterDefChange, mutatedWolf);
  check(playView.definitionDiverged === true, 'definitionDiverged when live differs');
  check(playView.definitionMissing === false, 'definition not missing');

  const missingView = npc.resolveInstancePlayView(afterDefChange, null);
  check(missingView.definitionMissing === true, 'definitionMissing when archived/gone');
  check(missingView.snapshot.name === 'Wolf', 'play still uses snapshot when missing');

  // Persistent unique
  const unique = npc.planNpcCreatureInstanceSpawn(
    wolf,
    {
      projectId: 'proj-1',
      sessionId: 'sess-should-ignore',
      definitionId: wolf.id,
      instanceKind: 'persistent',
      displayName: 'Schattenzahn',
    },
    { ...ctxBase, existingInstances: [instance1, instance2] },
  );
  check(unique.ok === true, 'persistent spawn ok');
  check(unique.instance?.sessionId === null, 'persistent forces sessionId null');
  check(unique.instance?.displayName === 'Schattenzahn', 'persistent custom name');
  check(unique.instance?.instanceKind === 'persistent', 'persistent kind');

  // Session end clears only temp controllers for that session
  const withTemp = {
    id: 'inst-sess',
    ...spawn1.instance,
    sessionId: 'sess-a',
    runtime: {
      ...spawn1.instance.runtime,
      temporaryControllerUserId: 'player-2',
    },
  };
  const otherSess = {
    id: 'inst-other',
    ...spawn2.instance,
    sessionId: 'sess-b',
    runtime: {
      ...spawn2.instance.runtime,
      temporaryControllerUserId: 'player-2',
    },
  };
  const cleared = npc.clearTemporaryControllersForSession(
    [withTemp, otherSess, { id: 'u', ...unique.instance }],
    'sess-a',
  );
  check(
    cleared.find((row) => row.id === 'inst-sess')?.runtime.temporaryControllerUserId
      === null,
    'session-a temp controller cleared',
  );
  check(
    cleared.find((row) => row.id === 'inst-other')?.runtime.temporaryControllerUserId
      === 'player-2',
    'session-b temp controller preserved',
  );

  // Authz fail-closed
  const notGm = npc.planNpcCreatureInstanceSpawn(
    wolf,
    { projectId: 'proj-1', definitionId: wolf.id, instanceKind: 'generic' },
    { ...ctxBase, actorRole: 'player' },
  );
  check(notGm.ok === false && notGm.code === 'not_gm', 'non-GM spawn fails');

  const unreadable = npc.planNpcCreatureInstanceSpawn(
    wolf,
    { projectId: 'proj-1', definitionId: wolf.id, instanceKind: 'generic' },
    { ...ctxBase, definitionReadable: false },
  );
  check(
    unreadable.ok === false && unreadable.code === 'definition_not_readable',
    'unreadable definition fails',
  );

  const badController = npc.planNpcCreatureInstanceRuntimeUpdate(
    instance1,
    { temporaryControllerUserId: 'outsider' },
    ctxBase,
  );
  check(
    badController.ok === false && badController.code === 'invalid_controller',
    'outsider temp controller fails',
  );

  // N-actors: two independent spawns keep separate runtime after parallel updates
  const a = { id: 'a', ...spawn1.instance };
  const b = { id: 'b', ...spawn2.instance };
  const aUp = npc.planNpcCreatureInstanceRuntimeUpdate(a, { currentHp: 3 }, ctxBase);
  const bUp = npc.planNpcCreatureInstanceRuntimeUpdate(
    b,
    { currentHp: 7, temporaryControllerUserId: 'player-2' },
    ctxBase,
  );
  check(aUp.ok && bUp.ok, 'parallel runtime updates ok');
  check(aUp.instance.runtime.currentHp === 3, 'actor A HP');
  check(bUp.instance.runtime.currentHp === 7, 'actor B HP');
  check(
    aUp.instance.runtime.temporaryControllerUserId === null,
    'actor A controller independent',
  );
  check(
    bUp.instance.runtime.temporaryControllerUserId === 'player-2',
    'actor B controller independent',
  );
}

section('4 · acceptance + composition CLEAR + test-gate wiring');
{
  const acceptance = read('.qa/acceptance/npc-creature-session-instances.md');
  check(/npc-creature-session-instances/.test(acceptance), 'acceptance slug');
  check(/Security Coverage/.test(acceptance), 'acceptance Security Coverage');
  mustExist('.qa/runs/composition-gate-npc-creature-session-instances.md');
  const gateProof = read('.qa/runs/composition-gate-npc-creature-session-instances.md');
  check(/HEAD_SHA:/.test(gateProof), 'composition has HEAD_SHA');
  check(/BASE_SHA:\s*0cd62e0b395aa18b203486ef03b692cdd4fc0353/.test(gateProof), 'composition BASE_SHA');
  check(/Verdict:\s*CLEAR/.test(gateProof), 'composition Verdict CLEAR');
  check(/## Event/.test(gateProof), 'composition ## Event');
  check(/## Hop chain/.test(gateProof), 'composition ## Hop chain');
  check(/## Simulations/.test(gateProof), 'composition ## Simulations');
  check(/## Flags/.test(gateProof), 'composition ## Flags');
  check(/N-actors/.test(gateProof), 'composition N-actors');
  check(/Invalid\/missing/.test(gateProof), 'composition Invalid/missing');
  check(/Two consumers \/ crash/.test(gateProof), 'composition Two consumers / crash');
  const gate = read('scripts/test-gate.mjs');
  check(
    /npc-creature-session-instances-check\.mjs/.test(gate),
    'test-gate invokes npc-creature-session-instances-check',
  );
  check(
    /checkNpcCreatureSessionInstances/.test(gate),
    'test-gate has checkNpcCreatureSessionInstances',
  );
}

if (failures > 0) {
  console.error(`\nnpc-creature-session-instances-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('npc-creature-session-instances-check: OK (#201)');
