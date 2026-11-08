#!/usr/bin/env node
/**
 * npc-creature-promotion-check — domain + wiring contract for #200.
 * Location: scripts/npc-creature-promotion-check.mjs
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
  'src/domains/npc-creature/promotion.ts',
  'src/domains/npc-creature/controller-assignment.ts',
  'src/infrastructure/npc-creature/npc-creature-controller.persistence.ts',
  'src/app/library/npc-creatures/NpcCreatureAssignControllerDialog.tsx',
  'archive/supabase-legacy/supabase/migrations/022_npc_creature_controller_assignments.sql',
  '.qa/acceptance/npc-creature-promotion-controller.md',
  '.qa/runs/composition-gate-npc-creature-promotion-controller.md',
  'e2e/npc-creature-promotion-controller.spec.ts',
].forEach(mustExist);

section('2 · static wiring / German UI strings');
{
  const browser = read('src/app/library/npc-creatures/NpcCreatureLibraryBrowser.tsx');
  check(/Charakter daraus erstellen/.test(browser), 'template CTA string');
  check(/Als vollständigen Charakter ausbauen/.test(browser), 'compact CTA string');
  check(/Spieler zuweisen/.test(browser), 'controller CTA string');
  // Promotion CTAs live in the Library ⋮ corner menu (not card action buttons).
  check(/id: 'template-to-character'/.test(browser), 'template menu action');
  check(/id: 'compact-to-full'/.test(browser), 'compact menu action');
  check(/id: 'assign-controller'/.test(browser), 'assign menu action');
  check(/setCharacterEditorBootstrap/.test(browser), 'sets character editor bootstrap');
  check(/npc-promotion/.test(browser), 'npc-promotion bootstrap kind');
  check(/NpcCreatureAssignControllerDialog/.test(browser), 'wires assign dialog');

  const bootstrap = read('src/app/character/shared/characterEditorBootstrap.ts');
  check(/npc-promotion/.test(bootstrap), 'bootstrap kind npc-promotion');
  check(/sagatree:npc-promotion/.test(bootstrap), 'sessionStorage key');

  const editor = read('src/app/character/edit/CharacterEditor.tsx');
  check(/data-npc-promotion-unresolved/.test(editor), 'unresolved banner hook');
  check(/offene Entscheidungen/i.test(editor), 'unresolved banner copy');
  check(/promoteNpcCreatureCompactToFull/.test(editor), 'save promotes compact-to-full');
  check(/npc-promotion/.test(editor), 'editor handles npc-promotion');
  check(/setValidationAttempted\(true\)/.test(editor), 'validationAttempted on promotion hydrate');

  const library = read('src/app/library/Library.tsx');
  check(/onNavigateToCharacterEditor/.test(library), 'Library character editor navigate');
  check(/gmProjects/.test(library), 'Library passes gmProjects');
  check(/visitedTabs\.has\('npcs'\)/.test(library), 'loads projects when npcs visited');

  const app = read('src/App.tsx');
  check(/onNavigateToCharacterEditor/.test(app), 'App wires character editor navigate to Library');

  const index = read('src/app/library/npc-creatures/index.ts');
  check(/NpcCreatureAssignControllerDialog/.test(index), 'assign dialog exported');

  const service = read('src/infrastructure/npc-creature/npc-creature-service.ts');
  check(/promoteNpcCreatureCompactToFull/.test(service), 'service promote');
  check(/assignNpcCreatureController/.test(service), 'service assign');
  check(/getNpcCreatureControllerAssignment/.test(service), 'service get assignment');

  const migration = read('archive/supabase-legacy/supabase/migrations/022_npc_creature_controller_assignments.sql');
  check(/assign_npc_creature_controller/.test(migration), 'RPC name');
  check(/SECURITY DEFINER/.test(migration), 'SECURITY DEFINER RPC');
  check(/npc_creature_controller_assignments/.test(migration), 'assignments table');
  check(/clear_npc_creature_controller_on_member_inactive/.test(migration), 'leave-member clear');
  check(
    !/FOR INSERT[\s\S]*authenticated/i.test(migration)
      || /no INSERT|Deliberately no INSERT/i.test(migration),
    'no direct INSERT policy for authenticated',
  );
  check(/GRANT SELECT ON TABLE public\.npc_creature_controller_assignments TO authenticated/.test(migration), 'SELECT only for authenticated');
}

section('3 · domain offline tests');
{
  const esbuild = require('esbuild');
  const outdir = join(root, 'node_modules/.cache/npc-creature-promotion-check');
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

  const coreCitizen = npc.getCoreNpcCreatureDefinition('core:npc.citizen');
  check(Boolean(coreCitizen), 'core citizen exists');
  const templatePlan = npc.planTemplateToCharacterPromotion(coreCitizen);
  check(templatePlan.ok === true, 'template→character ok');
  check(templatePlan.plan?.preserveIdentity === false, 'template does not preserve identity');
  check(templatePlan.plan?.kind === 'template-to-character', 'template plan kind');
  check(
    templatePlan.plan?.unresolvedChoices?.length > 0,
    'template has unresolved choices',
  );

  const compactDraft = {
    name: 'Waldläuferin',
    description: 'Einzigartige Spurensucherin',
    kind: 'npc',
    category: 'npc',
    sheetMode: 'compact',
    level: 3,
    combatProfile: 'balanced',
    combatRole: 'standard',
    tags: ['unique'],
  };
  const compactDef = npc.assembleNpcCreatureDefinition(
    'personal:cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'personal',
    compactDraft,
  );
  const compactRecord = {
    definition: compactDef,
    status: 'active',
    ownerUserId: 'owner-1',
    worldProfileId: null,
  };
  const compactOk = npc.planCompactToFullPromotion(compactRecord, {
    userId: 'owner-1',
    editableWorldProfileIds: [],
  });
  check(compactOk.ok === true, 'compact→full owner ok');
  check(compactOk.plan?.preserveIdentity === true, 'compact preserves identity');
  check(compactOk.plan?.sourceDefinitionId === compactDef.id, 'same definition id');

  const crossOwner = npc.planCompactToFullPromotion(compactRecord, {
    userId: 'other-user',
    editableWorldProfileIds: [],
  });
  check(crossOwner.ok === false && crossOwner.code === 'cannot_mutate', 'cross-owner blocked');

  const illegalAttrs = { strength: 20, dexterity: 20, endurance: 20, mind: 20, perception: 20, charisma: 20 };
  const illegalSheet = npc.assertFullSheetHasNoSilentIllegalAttributes({ attributes: illegalAttrs });
  check(illegalSheet.ok === false, 'illegal attributes rejected');

  const legalAttrs = { strength: 4, dexterity: 3, endurance: 3, mind: 2, perception: 2, charisma: 1 };
  const legalSheet = npc.assertFullSheetHasNoSilentIllegalAttributes({ attributes: legalAttrs });
  check(legalSheet.ok === true, 'legal attributes accepted');

  const fullDef = {
    ...compactDef,
    sheetMode: 'full',
    fullSheet: { attributes: legalAttrs },
  };
  const assignOk = npc.planNpcControllerAssignment(
    fullDef,
    {
      projectId: '11111111-1111-4111-8111-111111111111',
      definitionId: fullDef.id,
      controllerUserId: 'player-1',
    },
    {
      actorUserId: 'gm-1',
      actorRole: 'gm',
      activeMemberUserIds: ['gm-1', 'player-1'],
    },
  );
  check(assignOk.ok === true, 'controller assign ok');
  check(assignOk.preservesSheetMode === true, 'assign preserves sheet mode');
  check(assignOk.preservesIdentity === true, 'assign preserves identity');

  const assignPlayer = npc.planNpcControllerAssignment(
    fullDef,
    {
      projectId: '11111111-1111-4111-8111-111111111111',
      definitionId: fullDef.id,
      controllerUserId: 'player-1',
    },
    {
      actorUserId: 'player-1',
      actorRole: 'player',
      activeMemberUserIds: ['gm-1', 'player-1'],
    },
  );
  check(assignPlayer.ok === false && assignPlayer.code === 'not_gm', 'non-gm blocked');

  const assignNonMember = npc.planNpcControllerAssignment(
    fullDef,
    {
      projectId: '11111111-1111-4111-8111-111111111111',
      definitionId: fullDef.id,
      controllerUserId: 'outsider',
    },
    {
      actorUserId: 'gm-1',
      actorRole: 'gm',
      activeMemberUserIds: ['gm-1', 'player-1'],
    },
  );
  check(
    assignNonMember.ok === false && assignNonMember.code === 'invalid_controller',
    'non-member controller blocked',
  );

  const leave = npc.resolveControllerAfterMemberLeave(
    {
      projectId: '11111111-1111-4111-8111-111111111111',
      definitionId: fullDef.id,
      controllerUserId: 'player-1',
    },
    'player-1',
  );
  check(leave.controllerUserId === null, 'leave clears controller');

  const classifyTemplate = npc.classifyNpcLibraryPromotionAction(coreCitizen);
  check(classifyTemplate === 'template-to-character', 'classify template');
  const classifyCompact = npc.classifyNpcLibraryPromotionAction(compactDef);
  check(classifyCompact === 'compact-to-full', 'classify compact');
  const classifyFull = npc.classifyNpcLibraryPromotionAction(fullDef);
  check(classifyFull === 'controller-assign', 'classify full');
}

section('4 · acceptance + composition CLEAR + test-gate wiring');
{
  const acceptance = read('.qa/acceptance/npc-creature-promotion-controller.md');
  check(/npc-creature-promotion-controller/.test(acceptance), 'acceptance slug');
  mustExist('.qa/runs/composition-gate-npc-creature-promotion-controller.md');
  const gateProof = read('.qa/runs/composition-gate-npc-creature-promotion-controller.md');
  check(/HEAD_SHA:/.test(gateProof), 'composition has HEAD_SHA');
  check(/BASE_SHA:\s*c7c5de0166c739562dd180623478db44629fb05a/.test(gateProof), 'composition BASE_SHA');
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
    /npc-creature-promotion-check\.mjs/.test(gate),
    'test-gate invokes npc-creature-promotion-check',
  );
  check(/checkNpcCreaturePromotion/.test(gate), 'test-gate has checkNpcCreaturePromotion');
}

if (failures > 0) {
  console.error(`\nnpc-creature-promotion-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('npc-creature-promotion-check: OK (#200)');
