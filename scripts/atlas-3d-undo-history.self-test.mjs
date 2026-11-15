#!/usr/bin/env node
/**
 * Self-test: 3D product map Undo/Redo survives runtime rebuilds (G05 finding, #1233).
 * Location: scripts/atlas-3d-undo-history.self-test.mjs
 *
 * Root cause: AtlasNative3dEditor remounted the WebGL runtime whenever the dungeonLookDoc
 * object identity changed (every edit / autosave echo), and the runtime kept undo/redo in
 * mount-local arrays, so each edit wiped the history. Fix: (1) remount only on a dungeon-look
 * value key, (2) host-owned history store reused by every mount of the same map.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function assert(cond, msg) {
  if (!cond) {
    console.error(`atlas-3d-undo-history self-test failed: ${msg}`);
    process.exit(1);
  }
}

const root = process.cwd();
const runtimePath = path.join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs');
const editorPath = path.join(root, 'src/app/world/atlas/unified/AtlasNative3dEditor.tsx');
const lookPath = path.join(root, 'src/app/world/atlas/unified/atlas-native-3d-look.ts');

/* 1) Runtime history store: survives a simulated remount. */
const { createAtlasEditHistory } = await import(pathToFileURL(runtimePath).href);
const store = { undo: [], redo: [] };
const s0 = JSON.stringify({ props: [] });
const s1 = JSON.stringify({ props: [{ id: 'p1' }] });
const s2 = JSON.stringify({ props: [{ id: 'p1' }, { id: 'p2' }] });
const mountA = createAtlasEditHistory(store);
mountA.snapshot(s0); // edit 1: s0 → s1
mountA.snapshot(s1); // edit 2: s1 → s2
// Edit-driven rebuild: a NEW runtime mount for the same map reuses the store.
const mountB = createAtlasEditHistory(store);
assert(mountB.undo.length === 2, 'history survives remount');
assert(mountB.undoFrom(s2) === s1, 'undo after remount restores previous state');
assert(mountB.undoFrom(s1) === s0, 'second undo after remount');
assert(mountB.undoFrom(s0) === null, 'nothing left to undo');
const mountC = createAtlasEditHistory(store);
assert(mountC.redoFrom(s0) === s1, 'redo survives another remount');
assert(mountC.redoFrom(s1) === s2, 'second redo');
assert(mountC.redoFrom(s2) === null, 'nothing left to redo');
mountC.undoFrom(s2);
mountC.snapshot(s1);
assert(store.redo.length === 0, 'new edit clears redo branch');
const capped = createAtlasEditHistory({ undo: [], redo: [] }, 3);
for (let i = 0; i < 5; i += 1) capped.snapshot(String(i));
assert(capped.undo.join() === '2,3,4', 'history cap drops oldest');
const fresh = createAtlasEditHistory(null);
assert(fresh.undo.length === 0 && fresh.redo.length === 0, 'no store → mount-local history');

/* 2) Remount key is value-based: plain edits on non-dungeon maps never remount. */
const esbuildBin = path.join(root, 'node_modules/.bin/esbuild');
assert(fs.existsSync(esbuildBin), 'esbuild available');
const out = path.join(root, '.qa/tmp/atlas-native-3d-look-bundle.mjs');
const entry = path.join(root, '.qa/tmp/atlas-native-3d-look-entry.ts');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  entry,
  `export * from '${lookPath.replace(/\\/g, '/')}';\nexport { emptyUnifiedCanvasDoc } from '${path
    .join(root, 'src/domains/world/atlas')
    .replace(/\\/g, '/')}';\n`,
);
execFileSync(esbuildBin, [entry, '--bundle', '--format=esm', '--platform=neutral', `--outfile=${out}`], {
  cwd: root,
  stdio: 'pipe',
});
const look = await import(pathToFileURL(out).href);
const base = { ...JSON.parse(JSON.stringify(look.emptyUnifiedCanvasDoc(false))), demoSeed: false };
const withHouse = { ...base, objects: [...base.objects, { id: 'p-house-1', type: 'haus', x: 400, y: 400, size: 1 }] };
const keyA = look.atlasNative3dDungeonLookKey(look.resolveAtlasNative3dDungeonLook(base, null, 'balanced'));
const keyB = look.atlasNative3dDungeonLookKey(look.resolveAtlasNative3dDungeonLook(withHouse, null, 'balanced'));
assert(keyA === 'none' && keyB === 'none', `non-dungeon edit keeps key (got ${keyA} / ${keyB})`);
const dungeon = {
  ...base,
  rooms: [{ id: 'droom-1', x: 100, y: 100, w: 120, h: 80, material: 'stein' }],
};
const dungeonEdited = {
  ...dungeon,
  objects: [...dungeon.objects, { id: 'p-house-2', type: 'haus', x: 500, y: 500, size: 1 }],
};
const dungeonMoreRooms = {
  ...dungeon,
  rooms: [...dungeon.rooms, { id: 'droom-2', x: 300, y: 100, w: 80, h: 80, material: 'stein' }],
};
const kD = look.atlasNative3dDungeonLookKey(look.resolveAtlasNative3dDungeonLook(dungeon, 'ancient', 'balanced'));
const kDE = look.atlasNative3dDungeonLookKey(look.resolveAtlasNative3dDungeonLook(dungeonEdited, 'ancient', 'balanced'));
const kDR = look.atlasNative3dDungeonLookKey(look.resolveAtlasNative3dDungeonLook(dungeonMoreRooms, 'ancient', 'balanced'));
assert(kD !== 'none', 'dungeon map has a look');
assert(kD === kDE, 'non-dungeon prop edit on a dungeon map keeps the look key');
assert(kD !== kDR, 'dungeon geometry change updates the look key (remount allowed, history kept)');

/* 3) Wiring guards. */
const editor = fs.readFileSync(editorPath, 'utf8');
const runtime = fs.readFileSync(runtimePath, 'utf8');
assert(/\}, \[mapKey, controlled, graphicsPresetId, dungeonLookKey\]\);/.test(editor), 'mount effect keyed by look value, not doc identity');
assert(!/\[[^\]]*dungeonLookDoc\][^\n]*;\s*$/m.test(editor.split('const dungeonLook = useMemo')[1] ?? ''), 'no doc-identity mount dep');
assert(editor.includes('historyStore: historyStoreRef.current'), 'host passes history store to runtime');
assert(runtime.includes('const editHistory = createAtlasEditHistory(options && options.historyStore);'), 'runtime uses host store');
assert(!/\bhistory=\[\],redoStack=\[\]/.test(runtime), 'no mount-local history arrays');
assert(!/[^.\w]history\.pop\(\)/.test(runtime), 'no accidental window.history access');
assert(runtime.includes('undoDepth:editHistory.undo.length,redoDepth:editHistory.redo.length'), 'bridge exposes history depth for E2E');

console.log('atlas-3d-undo-history self-test: PASS');
