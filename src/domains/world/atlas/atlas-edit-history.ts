/**
 * atlas-edit-history — undo/redo stacks + edit batches (ATL2-C04).
 * Location: src/domains/world/atlas/atlas-edit-history.ts
 *
 * Pure domain — no React. Snapshots are JSON strings of UnifiedCanvasDoc.
 */
import type { UnifiedCanvasDoc } from './unified-canvas-doc';

/** Acceptance requires ≥100 consecutive edit/undo/redo cycles. */
export const ATLAS_EDIT_HISTORY_LIMIT = 100 as const;

export type AtlasEditHistory = {
  readonly past: readonly string[];
  readonly future: readonly string[];
  /** When set, intermediate edits coalesce into one undo step ending at commitBatch. */
  readonly batchBase: string | null;
};

export function emptyAtlasEditHistory(): AtlasEditHistory {
  return { past: [], future: [], batchBase: null };
}

export function serializeAtlasEditSnapshot(doc: UnifiedCanvasDoc): string {
  return JSON.stringify(doc);
}

export function parseAtlasEditSnapshot(raw: string): UnifiedCanvasDoc {
  return JSON.parse(raw) as UnifiedCanvasDoc;
}

function trimPast(past: readonly string[]): readonly string[] {
  if (past.length <= ATLAS_EDIT_HISTORY_LIMIT) return past;
  return past.slice(past.length - ATLAS_EDIT_HISTORY_LIMIT);
}

/**
 * Record `prev` before applying a new edit. Clears redo. No-op while a batch is open
 * (batchBase already holds the pre-batch snapshot).
 */
export function pushAtlasEdit(
  history: AtlasEditHistory,
  prev: UnifiedCanvasDoc,
): AtlasEditHistory {
  if (history.batchBase !== null) {
    return { ...history, future: [] };
  }
  return {
    past: trimPast([...history.past, serializeAtlasEditSnapshot(prev)]),
    future: [],
    batchBase: null,
  };
}

/**
 * Start a multi-step gesture (drag/paint) that should undo as one unit.
 * Does not clear redo until the batch actually mutates and commits.
 */
export function beginAtlasEditBatch(
  history: AtlasEditHistory,
  current: UnifiedCanvasDoc,
): AtlasEditHistory {
  if (history.batchBase !== null) return history;
  return {
    past: history.past,
    future: history.future,
    batchBase: serializeAtlasEditSnapshot(current),
  };
}

/**
 * Close an open batch. If `current` is unchanged from `batchBase`, discard the
 * batch without pushing history or clearing redo (selection-only clicks).
 */
export function commitAtlasEditBatch(
  history: AtlasEditHistory,
  current?: UnifiedCanvasDoc,
): AtlasEditHistory {
  if (history.batchBase === null) return history;
  if (
    current !== undefined &&
    serializeAtlasEditSnapshot(current) === history.batchBase
  ) {
    return { past: history.past, future: history.future, batchBase: null };
  }
  return {
    past: trimPast([...history.past, history.batchBase]),
    future: [],
    batchBase: null,
  };
}

/**
 * Abort an open batch and restore the document to batchBase.
 * If no batch is open, returns null.
 */
export function cancelAtlasEditBatch(
  history: AtlasEditHistory,
): { readonly history: AtlasEditHistory; readonly doc: UnifiedCanvasDoc } | null {
  if (history.batchBase === null) return null;
  return {
    history: { past: history.past, future: [], batchBase: null },
    doc: parseAtlasEditSnapshot(history.batchBase),
  };
}

export function undoAtlasEdit(
  history: AtlasEditHistory,
  current: UnifiedCanvasDoc,
): { readonly history: AtlasEditHistory; readonly doc: UnifiedCanvasDoc } | null {
  if (history.batchBase !== null) {
    const cancelled = cancelAtlasEditBatch(history);
    return cancelled;
  }
  if (history.past.length === 0) return null;
  const prev = history.past[history.past.length - 1];
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, serializeAtlasEditSnapshot(current)],
      batchBase: null,
    },
    doc: parseAtlasEditSnapshot(prev),
  };
}

export function redoAtlasEdit(
  history: AtlasEditHistory,
  current: UnifiedCanvasDoc,
): { readonly history: AtlasEditHistory; readonly doc: UnifiedCanvasDoc } | null {
  if (history.batchBase !== null) return null;
  if (history.future.length === 0) return null;
  const next = history.future[history.future.length - 1];
  return {
    history: {
      past: trimPast([...history.past, serializeAtlasEditSnapshot(current)]),
      future: history.future.slice(0, -1),
      batchBase: null,
    },
    doc: parseAtlasEditSnapshot(next),
  };
}

export function canAtlasUndo(history: AtlasEditHistory): boolean {
  return history.batchBase !== null || history.past.length > 0;
}

export function canAtlasRedo(history: AtlasEditHistory): boolean {
  return history.batchBase === null && history.future.length > 0;
}
