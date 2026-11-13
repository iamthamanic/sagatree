#!/usr/bin/env node
/**
 * ATL2-C04 — undo/redo history, batches, autosave/conflict contracts.
 * Location: scripts/atl2-c04-undo-autosave.self-test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });

const hist = jiti(join(root, 'src/domains/world/atlas/atlas-edit-history.ts'));
const canvas = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts'));
const ops = jiti(join(root, 'src/domains/world/atlas/map-edit-ops.ts'));
const rev = jiti(join(root, 'src/domains/world/atlas/atlas-revision-contract.ts'));
const persist = jiti(join(root, 'src/domains/world/atlas/atlas-persist-state.ts'));

const editorSrc = readFileSync(join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'), 'utf8');
const hookSrc = readFileSync(join(root, 'src/app/world/atlas/useWorldAtlasEditor.ts'), 'utf8');
const wbSrc = readFileSync(join(root, 'src/app/world/atlas/WorldAtlasWorkbench.tsx'), 'utf8');
const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-c04.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');

assert.ok(acceptance.includes('atl2-c04'));
assert.ok(gate.includes('atl2-c04-undo-autosave.self-test.mjs'));
assert.ok(editorSrc.includes('beginAtlasEditBatch'));
assert.ok(editorSrc.includes('commitAtlasEditBatch'));
assert.ok(editorSrc.includes('data-atlas-undo'));
assert.ok(hookSrc.includes('decideAtlasAutosave'));
assert.ok(hookSrc.includes('autosaveDecision'));
assert.ok(wbSrc.includes('autosaveDecision'));
assert.ok(wbSrc.includes('autosaveDebounceMs'));

assert.equal(hist.ATLAS_EDIT_HISTORY_LIMIT, 100);

let doc = canvas.emptyUnifiedCanvasDoc(false);
let history = hist.emptyAtlasEditHistory();
const snapshots = [];

for (let i = 0; i < 100; i += 1) {
  snapshots.push(hist.serializeAtlasEditSnapshot(doc));
  history = hist.pushAtlasEdit(history, doc);
  doc = ops.applyMapEdit(doc, {
    op: 'add_object',
    object: { id: `o${i}`, type: 'haus', x: i, y: i, size: 1, angle: 0 },
  });
}
assert.equal(doc.objects.length, 100);
assert.equal(history.past.length, 100);

for (let i = 99; i >= 0; i -= 1) {
  const stepped = hist.undoAtlasEdit(history, doc);
  assert.ok(stepped);
  history = stepped.history;
  doc = stepped.doc;
  assert.equal(doc.objects.length, i);
  assert.equal(hist.serializeAtlasEditSnapshot(doc), snapshots[i]);
}
assert.equal(history.past.length, 0);
assert.equal(history.future.length, 100);

for (let i = 0; i < 100; i += 1) {
  const stepped = hist.redoAtlasEdit(history, doc);
  assert.ok(stepped);
  history = stepped.history;
  doc = stepped.doc;
  assert.equal(doc.objects.length, i + 1);
}
assert.equal(doc.objects.length, 100);

// Batch: drag coalesces to one undo step.
history = hist.emptyAtlasEditHistory();
doc = canvas.emptyUnifiedCanvasDoc(false);
doc = ops.applyMapEdit(doc, {
  op: 'add_object',
  object: { id: 'drag', type: 'haus', x: 0, y: 0, size: 1, angle: 0 },
});
history = hist.beginAtlasEditBatch(history, doc);
doc = ops.applyMapEdit(doc, { op: 'move_object', id: 'drag', x: 5, y: 5 });
doc = ops.applyMapEdit(doc, { op: 'move_object', id: 'drag', x: 9, y: 2 });
history = hist.commitAtlasEditBatch(history, doc);
assert.equal(history.past.length, 1);
const afterBatchUndo = hist.undoAtlasEdit(history, doc);
assert.ok(afterBatchUndo);
assert.equal(afterBatchUndo.doc.objects.find((o) => o.id === 'drag').x, 0);

// Selection-only batch must not clear redo / push history.
let withRedo = hist.pushAtlasEdit(hist.emptyAtlasEditHistory(), afterBatchUndo.doc);
let moved = ops.applyMapEdit(afterBatchUndo.doc, { op: 'move_object', id: 'drag', x: 3, y: 3 });
const undone = hist.undoAtlasEdit(withRedo, moved);
assert.ok(undone);
assert.equal(undone.history.future.length, 1);
withRedo = hist.beginAtlasEditBatch(undone.history, undone.doc);
withRedo = hist.commitAtlasEditBatch(withRedo, undone.doc);
assert.equal(withRedo.future.length, 1);
assert.equal(withRedo.past.length, undone.history.past.length);

// Cancel batch restores base.
history = hist.beginAtlasEditBatch(hist.emptyAtlasEditHistory(), afterBatchUndo.doc);
let mid = ops.applyMapEdit(afterBatchUndo.doc, { op: 'move_object', id: 'drag', x: 99, y: 99 });
const cancelled = hist.cancelAtlasEditBatch(history);
assert.ok(cancelled);
assert.equal(cancelled.doc.objects.find((o) => o.id === 'drag').x, 0);
assert.equal(mid.objects.find((o) => o.id === 'drag').x, 99);

assert.ok(editorSrc.includes('abortEditBatch') || editorSrc.includes('cancelAtlasEditBatch'));
assert.ok(editorSrc.includes('onPointerCancel'));
assert.ok(wbSrc.includes('ATLAS_AUTOSAVE_MAX_PENDING_OPS') || wbSrc.includes('immediate'));

// Autosave / conflict: never save while conflicted; fail does not invent saved.
assert.equal(
  rev.decideAtlasAutosave({ status: 'conflict', pendingOps: 99, msSinceLastEdit: 99_000 }).action,
  'blocked_conflict',
);
assert.equal(
  rev.decideAtlasAutosave({
    status: 'dirty',
    pendingOps: 1,
    msSinceLastEdit: rev.ATLAS_AUTOSAVE_DEBOUNCE_MS,
  }).action,
  'save',
);
let status = persist.reduceAtlasPersistStatus('dirty', { type: 'save_start' });
status = persist.reduceAtlasPersistStatus(status, {
  type: 'save_fail',
  conflict: persist.isAtlasRevisionConflictMessage(rev.ATLAS_REVISION_CONFLICT_DE),
});
assert.equal(status, 'conflict');
assert.equal(persist.atlasPersistStatusLabelDe(status).includes('Konflikt'), true);
status = persist.reduceAtlasPersistStatus('dirty', { type: 'ack_saved' });
assert.equal(status, 'dirty');

console.log('atl2-c04-undo-autosave self-test: PASS');
