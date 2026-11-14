#!/usr/bin/env node
/**
 * ATL2-E03 — six-level hierarchy zoom / breadcrumb / back-nav (#1221).
 * Location: scripts/atl2-e03-hierarchy-nav.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createJiti } from 'jiti';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const nav = jiti(join(root, 'src/domains/world/atlas/atlas-hierarchy-nav.ts'));
const mf = jiti(join(root, 'src/domains/world/atlas/map-frame.ts'));

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-e03.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-e03-hierarchy-nav.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const barrel = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const workbench = readFileSync(join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx'), 'utf8');
const editor = readFileSync(
  join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'),
  'utf8',
);

assert.ok(acceptance.includes('atl2-e03'));
assert.ok(acceptance.includes('Breadcrumb'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(design.includes('enterChildMap'));
assert.ok(gate.includes('atl2-e03-hierarchy-nav.self-test.mjs'), 'wired in test-gate');
assert.ok(barrel.includes('enterChildMap'));
assert.ok(barrel.includes('navigateBack'));
assert.ok(workbench.includes('data-world-atlas-hierarchy-back'));
assert.ok(workbench.includes('openMapWithHierarchy'));
assert.ok(workbench.includes('pendingAfterFlyRef'));
assert.ok(workbench.includes('parentFlyTo'));
assert.ok(workbench.includes('isDirect'));
assert.ok(editor.includes('onHierarchyBack'));
assert.ok(editor.includes('navRestoreView'));
assert.ok(editor.includes('parseHierarchyNavKey'));
assert.ok(editor.includes('wheelRequestsHierarchyBack'));
assert.ok(editor.includes('isContentEditable'));
assert.ok(editor.includes('if (navRestoreView)'));
assert.ok(
  editor.includes('onNavPendingFocusConsumed?.()'),
  'fly-to completion consumes pending focus',
);
const native3d = readFileSync(
  join(root, 'src/app/world/atlas/unified/AtlasNative3dEditor.tsx'),
  'utf8',
);
assert.ok(native3d.includes('applyNavCamera'));
assert.ok(native3d.includes('getNavCamera'));
assert.ok(native3d.includes('navRestoreView'));

/** Synthetic six-level chain: world → Westmark → Nordreich → Dornhain → Taverne → Schankraum */
const maps = [
  { id: 'm-world', title: 'Donalu', parentMapId: null },
  { id: 'm-westmark', title: 'Kontinent Westmark', parentMapId: 'm-world' },
  { id: 'm-nordreich', title: 'Nordreich', parentMapId: 'm-westmark' },
  { id: 'm-dornhain', title: 'Dornhain', parentMapId: 'm-nordreich' },
  { id: 'm-tavern', title: 'Taverne Zum Flüstern', parentMapId: 'm-dornhain' },
  { id: 'm-schank', title: 'Schankraum', parentMapId: 'm-tavern' },
  { id: 'm-crypt', title: 'Krypta unter dem Hügel', parentMapId: 'm-dornhain' },
  { id: 'm-gruft', title: 'Gruftkammer', parentMapId: 'm-crypt' },
];

const crumbSchank = nav.buildMapBreadcrumb(maps, 'm-schank');
assert.deepEqual(
  crumbSchank.map((c) => c.id),
  ['m-world', 'm-westmark', 'm-nordreich', 'm-dornhain', 'm-tavern', 'm-schank'],
);

const crumbGruft = nav.buildMapBreadcrumb(maps, 'm-gruft');
assert.deepEqual(
  crumbGruft.map((c) => c.id),
  ['m-world', 'm-westmark', 'm-nordreich', 'm-dornhain', 'm-crypt', 'm-gruft'],
);

const indep = nav.assertIndependentBranches({
  maps,
  tipA: 'm-schank',
  tipB: 'm-gruft',
});
assert.equal(indep.ok, true, 'tavern and crypt tips are independent');

const loopMaps = [
  { id: 'a', title: 'A', parentMapId: 'b' },
  { id: 'b', title: 'B', parentMapId: 'a' },
];
const loopCrumb = nav.buildMapBreadcrumb(loopMaps, 'a');
assert.equal(loopCrumb.length, 2, 'cycle guard stops without infinite walk');

let state = nav.createAtlasHierarchyNavState(
  'm-world',
  nav.defaultAtlasNavCameraView({ centerX: 100, centerY: 200, span: 400, mode: 'ortho-topdown' }),
);

const camWorld = nav.defaultAtlasNavCameraView({
  centerX: 100,
  centerY: 200,
  span: 400,
  mode: 'diorama-oblique',
});
state = {
  ...state,
  snapshots: { ...state.snapshots, 'm-world': camWorld },
};

const locatedFrame = {
  status: 'ready',
  parentAnchor: {
    parentMapId: 'm-world',
    centerX: 260,
    centerY: 420,
    extentX: 80,
    extentY: 110,
    rotationRad: 0,
    metersPerUnit: null,
  },
};

const enterWest = nav.enterChildMap({
  state,
  childMapId: 'm-westmark',
  parentCamera: camWorld,
  childFrame: locatedFrame,
  childParentMapId: 'm-world',
});
assert.equal(enterWest.ok, true);
assert.equal(enterWest.state.activeMapId, 'm-westmark');
assert.equal(enterWest.state.pendingFocus, null, 'child uses snapshot restore, not parent-space focus');
assert.ok(enterWest.parentFlyTo, 'parent-space fly-to before switch');
assert.ok(enterWest.parentFlyTo.width > 0);
assert.equal(enterWest.state.snapshots['m-world'].mode, 'diorama-oblique');
assert.equal(enterWest.state.snapshots['m-world'].span, 400);
state = enterWest.state;

const notDirect = nav.enterChildMap({
  state: nav.createAtlasHierarchyNavState('m-world', camWorld),
  childMapId: 'm-schank',
  parentCamera: camWorld,
  childFrame: locatedFrame,
  childParentMapId: 'm-tavern',
});
assert.equal(notDirect.ok, false, 'grandchild is not a direct child');

const camWest = nav.defaultAtlasNavCameraView({
  centerX: 300,
  centerY: 350,
  span: 120,
  mode: 'perspective',
});
const path = [
  'm-nordreich',
  'm-dornhain',
  'm-tavern',
  'm-schank',
];
for (const childId of path) {
  const parentId = maps.find((m) => m.id === childId).parentMapId;
  const frame = {
    status: 'ready',
    parentAnchor: {
      parentMapId: parentId,
      centerX: 360,
      centerY: 510,
      extentX: 40,
      extentY: 40,
      rotationRad: 0.1,
      metersPerUnit: null,
    },
  };
  const step = nav.enterChildMap({
    state,
    childMapId: childId,
    parentCamera: camWest,
    childFrame: frame,
    childParentMapId: parentId,
  });
  assert.equal(step.ok, true, `enter ${childId}`);
  state = step.state;
}
assert.equal(state.activeMapId, 'm-schank');

const back1 = nav.navigateBack({
  state,
  maps,
  currentCamera: nav.defaultAtlasNavCameraView({ span: 20, mode: 'ortho-topdown' }),
});
assert.equal(back1.ok, true);
assert.equal(back1.state.activeMapId, 'm-tavern');
assert.equal(back1.state.snapshots['m-tavern'].mode, 'perspective');
state = back1.state;

const jumpWorld = nav.navigateToAncestor({
  state,
  maps,
  targetMapId: 'm-world',
  currentCamera: nav.defaultAtlasNavCameraView({ span: 50 }),
});
assert.equal(jumpWorld.ok, true);
assert.equal(jumpWorld.state.activeMapId, 'm-world');
assert.equal(jumpWorld.state.snapshots['m-world'].span, 400);
assert.equal(jumpWorld.state.snapshots['m-world'].mode, 'diorama-oblique');
state = jumpWorld.state;

const badSkip = nav.navigateToAncestor({
  state,
  maps,
  targetMapId: 'm-gruft',
  currentCamera: camWorld,
});
assert.equal(badSkip.ok, false, 'cannot skip to unrelated tip via breadcrumb');

/* Independent crypt branch from Dornhain */
state = nav.createAtlasHierarchyNavState('m-dornhain', camWest);
const enterCrypt = nav.enterChildMap({
  state,
  childMapId: 'm-crypt',
  parentCamera: camWest,
  childParentMapId: 'm-dornhain',
  childFrame: {
    status: 'ready',
    parentAnchor: {
      parentMapId: 'm-dornhain',
      centerX: 406,
      centerY: 462,
      extentX: 28,
      extentY: 28,
      rotationRad: 0,
      metersPerUnit: null,
    },
  },
});
assert.equal(enterCrypt.ok, true);
state = enterCrypt.state;
const enterGruft = nav.enterChildMap({
  state,
  childMapId: 'm-gruft',
  parentCamera: camWest,
  childParentMapId: 'm-crypt',
  childFrame: {
    status: 'ready',
    parentAnchor: {
      parentMapId: 'm-crypt',
      centerX: 400,
      centerY: 600,
      extentX: 30,
      extentY: 30,
      rotationRad: 0,
      metersPerUnit: null,
    },
  },
});
assert.equal(enterGruft.ok, true);
assert.equal(enterGruft.state.activeMapId, 'm-gruft');

const unlocated = mf.unlocatedChildMapGeneratorMeta({ seed: 'e03.u' });
const unlocatedFrame = mf.extractMapFrameFromGeneratorMeta(unlocated);
const blocked = nav.enterChildMap({
  state: nav.createAtlasHierarchyNavState('m-dornhain'),
  childMapId: 'm-ghost',
  parentCamera: camWest,
  childFrame: unlocatedFrame,
  allowUnlocatedOpen: false,
});
assert.equal(blocked.ok, false);
assert.match(blocked.reasonDe, /unverortet/i);

const openUnlocated = nav.enterChildMap({
  state: nav.createAtlasHierarchyNavState('m-dornhain'),
  childMapId: 'm-ghost',
  parentCamera: camWest,
  childFrame: unlocatedFrame,
  allowUnlocatedOpen: true,
});
assert.equal(openUnlocated.ok, true);
assert.equal(openUnlocated.unlocated, true);
assert.equal(openUnlocated.state.pendingFocus, null);

assert.equal(nav.parseHierarchyNavKey({ key: 'Escape', altKey: false }), 'back');
assert.equal(nav.parseHierarchyNavKey({ key: 'ArrowUp', altKey: true }), 'back');
assert.equal(nav.parseHierarchyNavKey({ key: 'a', altKey: false }), 'none');
assert.equal(nav.wheelRequestsHierarchyBack({ deltaY: 40, atMinSpan: true }), true);
assert.equal(nav.wheelRequestsHierarchyBack({ deltaY: 40, atMinSpan: false }), false);
assert.equal(nav.wheelRequestsHierarchyBack({ deltaY: -10, atMinSpan: true }), false);

const rect = nav.focusRectFromParentAnchor(locatedFrame.parentAnchor);
assert.ok(rect.width > 0 && rect.height > 0);

const withParentFocus = {
  ...enterWest.state,
  pendingFocus: { mapId: 'm-world', ...enterWest.parentFlyTo },
};
const consumed = nav.consumePendingFocus(withParentFocus);
assert.equal(consumed.state.pendingFocus, null);
assert.ok(consumed.focus);

const rootBack = nav.navigateBack({
  state: nav.createAtlasHierarchyNavState('m-world'),
  maps,
  currentCamera: camWorld,
});
assert.equal(rootBack.ok, false);

if (process.env.ATL2_E03_WRITE_EVIDENCE === '1') {
  const outDir = join(root, '.qa/runs');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'atl2-e03-hierarchy-nav.md'),
    `# ATL2-E03 hierarchy nav\n\n- Verdict: **CLEAR**\n- Date: ${new Date().toISOString().slice(0, 10)}\n- Journeys: Welt→…→Schankraum + Dornhain→Krypta→Gruftkammer\n- Checks: breadcrumb, back restore, unlocated, keyboard/wheel, independent branches\n`,
  );
  writeFileSync(
    join(outDir, 'atl2-e03-hierarchy-nav.json'),
    JSON.stringify(
      {
        verdict: 'CLEAR',
        journeys: ['welt-westmark-nordreich-dornhain-taverne-schankraum', 'dornhain-krypta-gruft'],
      },
      null,
      2,
    ) + '\n',
  );
}

console.log('atl2-e03-hierarchy-nav self-test: PASS (CLEAR)');
console.log('report: transient (set ATL2_E03_WRITE_EVIDENCE=1 to pin .qa/runs)');
