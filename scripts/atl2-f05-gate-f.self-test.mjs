#!/usr/bin/env node
/**
 * ATL2-F05 Gate F — Dungeon generate→edit→2D/3D parity evidence lock (#1228).
 * Location: scripts/atl2-f05-gate-f.self-test.mjs
 *
 * Not a new product feature — stitches F01–F04 into one golden-path proof.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-f05.md'), 'utf8');
const composition = readFileSync(join(root, '.qa/runs/composition-gate-atl2-f05.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const editorSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'),
  'utf8',
);
const hookSrc = readFileSync(join(root, 'src/app/world/atlas/useWorldAtlasEditor.ts'), 'utf8');
const workbenchSrc = readFileSync(
  join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx'),
  'utf8',
);
const lookSrc = readFileSync(join(root, 'src/domains/world/atlas/atlas-dungeon-look.ts'), 'utf8');
const workflowSrc = readFileSync(
  join(root, 'src/domains/world/atlas/dungeon-forge-workflow.ts'),
  'utf8',
);
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

assert.ok(acceptance.includes('atl2-f05'));
assert.ok(acceptance.includes('#1228'));
assert.ok(acceptance.includes('IV-01'));
assert.ok(acceptance.includes('IV-18'));
assert.ok(acceptance.includes('GM vs Player') || acceptance.includes('canEdit=false'));
assert.ok(composition.includes('CLEAR'));
assert.ok(composition.includes('Two consumers / crash'));
assert.ok(/Acceptance tier:\s*\S+/i.test(composition));
assert.ok(/Deferred integration:\s*\S+/i.test(composition));
assert.ok(composition.includes('atl2-f05'));
assert.ok(gate.includes('atl2-f05-gate-f.self-test.mjs'));
assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');
assert.ok(!lookSrc.includes(' as any'));
assert.ok(!lookSrc.includes('@ts-ignore'));
assert.ok(!lookSrc.includes('@ts-expect-error'));
assert.ok(!workflowSrc.includes(' as any'));
assert.ok(!workflowSrc.includes('@ts-ignore'));
assert.ok(!workflowSrc.includes('@ts-expect-error'));

/* Forge panel is exclusively assigned under canEdit; player render is null. */
const forgePanelMatch = editorSrc.match(
  /const dungeonForgePanel\s*=\s*canEdit\s*\?\s*\(([\s\S]*?)\)\s*:/,
);
assert.ok(forgePanelMatch, 'dungeonForgePanel must be canEdit-ternary');
const forgePanelGmJsx = forgePanelMatch[1];
assert.ok(forgePanelGmJsx.includes('data-atlas-dungeon-forge'));
assert.ok(forgePanelGmJsx.includes('data-atlas-dungeon-generate') || forgePanelGmJsx.includes('Seed'));
assert.ok(
  /:\s*null/.test(editorSrc.slice(forgePanelMatch.index, forgePanelMatch.index + forgePanelMatch[0].length + 80)) ||
    /const dungeonForgePanel\s*=\s*canEdit\s*\?[\s\S]{0,40}:\s*null/.test(editorSrc) ||
    editorSrc.includes('canEdit ? (\n      <div className="space-y-2 rounded-md border border-border p-2" data-atlas-dungeon-forge>'),
);

/** @param {boolean} canEdit */
function renderDungeonForgeForRole(canEdit) {
  if (!canEdit) return null;
  return forgePanelGmJsx;
}

const playerForge = renderDungeonForgeForRole(false);
assert.equal(playerForge, null, 'player canEdit=false must not render forge panel');
assert.ok(!String(playerForge ?? '').includes('data-atlas-dungeon-forge'));
const gmForge = renderDungeonForgeForRole(true);
assert.ok(gmForge.includes('data-atlas-dungeon-forge'));
assert.ok(editorSrc.includes('data-atlas-dungeon-forge-3d'));
assert.ok(
  /\{canEdit \? \(\s*<div[\s\S]*?data-atlas-dungeon-forge-3d[\s\S]*?\{dungeonForgePanel\}[\s\S]*?\) : null\}/.test(
    editorSrc,
  ),
  '3D forge chrome must also be canEdit-gated',
);
assert.ok(editorSrc.includes('dungeonNeedsReforgeConfirm'));
assert.ok(editorSrc.includes('mergeDungeonPreviewIntoDoc'));
assert.ok(editorSrc.includes('commitDungeonFeaturesToDoc'));
assert.ok(editorSrc.includes('dungeonLookDoc'));
assert.ok(editorSrc.includes('dungeonThemeKey'));
assert.ok(editorSrc.includes('Ungültiger Seed'));
assert.ok(editorSrc.includes('onDungeonMetaChange?.({ ...meta, manualDirty: true })'));
assert.ok(workbenchSrc.includes('onDungeonMetaChange={editor.updateDungeonMeta}'));
assert.ok(hookSrc.includes('mergeDungeonMetaIntoGeneratorMeta(generatorMeta, dungeonMeta)'));
assert.ok(hookSrc.includes('extractDungeonMetaFromGeneratorMeta(next.generatorMeta)'));
assert.ok(hookSrc.includes('extractDungeonMetaFromGeneratorMeta(vm.generatorMeta)'));
assert.match(hookSrc, /const saveCanvas = useCallback\(async \(\) => \{\s*if \(!map \|\| !canEdit\) return;/);

const gen = jiti(join(root, 'src/domains/world/atlas/dungeon-generator.ts'));
const grid = jiti(join(root, 'src/domains/world/atlas/dungeon-grid.ts'));
const forge = jiti(join(root, 'src/domains/world/atlas/dungeon-forge-workflow.ts'));
const look = jiti(join(root, 'src/domains/world/atlas/atlas-dungeon-look.ts'));
const { emptyUnifiedCanvasDoc } = jiti(
  join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'),
);

const GOLDEN = {
  seed: 4242,
  roomCount: 16,
  loopChance: 0.2,
  themeKey: 'ancient',
  originX: 10,
  originY: 20,
  unitScale: 1,
};

/* --- 1. generate --- */
const generated = gen.generateDungeon(GOLDEN);
assert.equal(generated.valid, true, generated.error);
const sem = gen.validateDungeonSemantics(generated.rooms, generated.edges);
assert.equal(sem.ok, true, sem.error);
assert.ok(
  gen.validateDungeonConnectivity(generated.rooms.length, generated.edges, sem.entranceId),
);
const layoutFp = gen.fingerprintDungeonLayout(generated);

/* --- 2. rasterize + BFS --- */
const raster = grid.rasterizeDungeonGenerateResult(generated);
assert.equal(raster.valid, true, raster.error);
assert.equal(raster.passable, true, 'BFS entrance→floors must pass');

/* --- 3. preview (non-canonical) --- */
const payload = forge.dungeonCommitPayloadFromResults(generated, raster);
assert.ok(payload);
const userRoom = { id: 'user-room-krypta', x: 0, y: 0, w: 3, h: 3, material: 'stein' };
const canonical = {
  ...emptyUnifiedCanvasDoc(false),
  rooms: [userRoom],
};
const previewDoc = forge.mergeDungeonPreviewIntoDoc(canonical, payload);
assert.ok(previewDoc.rooms.some((r) => r.id === 'user-room-krypta'));
assert.ok(previewDoc.rooms.some((r) => r.id.startsWith('droom-')));
assert.equal(canonical.rooms.length, 1, 'preview must not mutate canonical');
assert.equal(canonical.rooms[0].id, 'user-room-krypta');

/* --- 4. commit (editor onDungeonMetaChange + onDocChange) --- */
/** @type {import('../src/domains/world/atlas/dungeon-generator.ts').DungeonGeneratorMeta | null} */
let dungeonMetaState = null;
const onDungeonMetaChange = (next) => {
  dungeonMetaState = next;
};
const onDocChange = (next) => {
  canvasDocState = next;
};
let canvasDocState = canonical;

const commitMeta = gen.buildDungeonGeneratorMeta(generated, true);
onDungeonMetaChange(commitMeta);
canvasDocState = forge.commitDungeonFeaturesToDoc(canvasDocState, payload, true);
assert.ok(canvasDocState.rooms.some((r) => r.id === 'user-room-krypta'));
assert.equal(
  canvasDocState.rooms.filter((r) => r.id.startsWith('droom-')).length,
  payload.rooms.length,
);
assert.ok(dungeonMetaState);
assert.equal(dungeonMetaState.confirmed, true);
assert.equal(dungeonMetaState.manualDirty, false);
assert.equal(gen.dungeonNeedsReforgeConfirm(dungeonMetaState), true);

/* --- 5. edit (manual) via UnifiedAtlasEditor.commit dirty wire --- */
const edited = {
  ...canvasDocState,
  rooms: [
    ...canvasDocState.rooms,
    { id: 'user-alcove-1', x: 40, y: 40, w: 2, h: 2, material: 'stein' },
  ],
};
{
  const meta = dungeonMetaState;
  if (meta?.confirmed && !meta.manualDirty) {
    onDungeonMetaChange({ ...meta, manualDirty: true });
  }
  onDocChange(edited);
}
assert.equal(dungeonMetaState.manualDirty, true);
assert.equal(gen.dungeonNeedsReforgeConfirm(dungeonMetaState), true);
assert.ok(canvasDocState.rooms.some((r) => r.id === 'user-alcove-1'));

/* --- 6. saveCanvas + reloadActiveMap path (useWorldAtlasEditor) --- */
/** Mirrors saveCanvas: merge dungeon meta into generatorMeta (canEdit required). */
function simulateSaveCanvas({ canEdit, priorGeneratorMeta, dungeonMeta }) {
  if (!canEdit) return null;
  let generatorMeta = { ...priorGeneratorMeta };
  if (dungeonMeta) {
    generatorMeta = gen.mergeDungeonMetaIntoGeneratorMeta(generatorMeta, dungeonMeta);
  }
  return generatorMeta;
}

/** Mirrors reloadActiveMap: extract dungeon meta after host round-trip. */
function simulateReloadActiveMap(generatorMeta) {
  return gen.extractDungeonMetaFromGeneratorMeta(generatorMeta);
}

assert.equal(
  simulateSaveCanvas({
    canEdit: false,
    priorGeneratorMeta: {},
    dungeonMeta: dungeonMetaState,
  }),
  null,
  'unauthorized saveCanvas must no-op',
);

const persistedMeta = simulateSaveCanvas({
  canEdit: true,
  priorGeneratorMeta: { engine: 'atlas' },
  dungeonMeta: dungeonMetaState,
});
assert.ok(persistedMeta);
const reloaded = simulateReloadActiveMap(persistedMeta);
assert.ok(reloaded);
assert.equal(reloaded.seed, GOLDEN.seed);
assert.equal(reloaded.themeKey, GOLDEN.themeKey);
assert.equal(reloaded.confirmed, true);
assert.equal(reloaded.manualDirty, true);
assert.equal(reloaded.generatorVersion, gen.DUNGEON_GENERATOR_VERSION);

const idSnap = (doc) =>
  [...doc.rooms, ...doc.walls, ...(doc.doors ?? []), ...doc.objects]
    .map((f) => f.id)
    .sort()
    .join('|');
assert.equal(idSnap(canvasDocState), idSnap(JSON.parse(JSON.stringify(canvasDocState))));

/* --- 7. 3D look + theme switch (same geometry) --- */
const lookAncient = look.buildAtlasDungeonLookPlan(canvasDocState, {
  themeKey: 'ancient',
  graphicsPresetId: 'balanced',
});
const lookMolten = look.buildAtlasDungeonLookPlan(canvasDocState, {
  themeKey: 'molten',
  graphicsPresetId: 'balanced',
});
assert.ok(lookAncient.counts.walls > 0);
assert.ok(lookAncient.counts.floors > 0);
assert.ok(lookAncient.counts.doors > 0);
assert.equal(
  lookAncient.geometryFingerprint,
  lookMolten.geometryFingerprint,
  'theme must not change geometry IDs',
);
assert.notEqual(lookAncient.lookFingerprint, lookMolten.lookFingerprint);

for (const key of look.ATLAS_DUNGEON_THEME_KEYS) {
  const plan = look.buildAtlasDungeonLookPlan(canvasDocState, {
    themeKey: key,
    graphicsPresetId: 'high',
  });
  assert.equal(plan.geometryFingerprint, lookAncient.geometryFingerprint);
}

/* --- 8. reforge guard: replace generator IDs only --- */
const nextGen = gen.generateDungeon({ ...GOLDEN, seed: 9001, themeKey: 'frost', roomCount: 12 });
assert.equal(nextGen.valid, true, nextGen.error);
const nextRaster = grid.rasterizeDungeonGenerateResult(nextGen);
assert.equal(nextRaster.valid && nextRaster.passable, true, nextRaster.error);
const nextPayload = forge.dungeonCommitPayloadFromResults(nextGen, nextRaster);
assert.ok(nextPayload);
const reforged = forge.commitDungeonFeaturesToDoc(canvasDocState, nextPayload, true);
assert.ok(reforged.rooms.some((r) => r.id === 'user-room-krypta'));
assert.ok(reforged.rooms.some((r) => r.id === 'user-alcove-1'));
const oldIds = new Set(payload.rooms.map((r) => r.id));
assert.ok(
  !reforged.rooms.some((r) => oldIds.has(r.id)),
  'reforge must drop prior generator room ids',
);
assert.equal(
  reforged.rooms.filter((r) => r.id.startsWith('droom-')).length,
  nextPayload.rooms.length,
);

/* --- Negatives: corrupt / unauthorized semantics --- */
assert.equal(
  forge.dungeonCommitPayloadFromResults(
    { valid: false, error: 'generation failed' },
    { valid: false, passable: false },
  ),
  null,
);
assert.equal(gen.dungeonNeedsReforgeConfirm(null), false);
assert.equal(
  gen.dungeonNeedsReforgeConfirm(gen.buildDungeonGeneratorMeta(generated, false)),
  false,
);

/* Determinism lock for golden seed (Gate F reopen parity). */
const again = gen.generateDungeon(GOLDEN);
assert.equal(again.valid, true, again.error);
assert.equal(gen.fingerprintDungeonLayout(again), layoutFp);

console.log(
  JSON.stringify({
    ok: true,
    gate: 'atl2-f05',
    issue: 1228,
    rooms: payload.rooms.length,
    walls: payload.walls.length,
    doors: payload.doors.length,
    geomFp: lookAncient.geometryFingerprint,
    layoutFp,
    target: target.ATLAS_PRODUCT_3D_TARGET,
    playerForgeAbsent: playerForge === null,
    manualDirtyAfterReload: reloaded.manualDirty === true,
  }),
);
