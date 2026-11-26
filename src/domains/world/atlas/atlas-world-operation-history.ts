/**
 * atlas-world-operation-history — SCM-03/M-2: Atomic Multi-Map Transaction Undo/Redo (INV-6).
 * Location: src/domains/world/atlas/atlas-world-operation-history.ts
 *
 * Pure domain — NO React, NO Three.js, NO Host SDK (BR-005).
 *
 * Complements `atlas-edit-history.ts` (single-doc undo) for multi-level SCM world
 * operations: one `applyWorldOperation` (including all upward growth propagation,
 * downward soft-cascade archiving, and freeland rerouting) is ALWAYS exactly ONE
 * undo/redo step (INV-6). Each snapshot retains the original `WorldOperationPlan`
 * and optional per-map `{ doc, parentAnchor }` snapshots so Undo/Redo can persist
 * every restored map back to SQLite losslessly (Finding M-2).
 */
import { ATLAS_EDIT_HISTORY_LIMIT } from './atlas-edit-history';
import type { SpatialWorldModel } from './atlas-spatial-containment';
import {
  applyWorldOperation,
  type ApplyWorldOperationResult,
  type WorldOperationPlan,
} from './atlas-spatial-propagation';
import type { ParentSpatialAnchor } from './map-frame';
import type { UnifiedCanvasDoc } from './unified-canvas-doc';

/** Persisted per-map state captured before/after an atomic SCM transaction (M-2). */
export type SpatialMapPersistSnapshot = {
  readonly doc: UnifiedCanvasDoc;
  readonly parentAnchor: ParentSpatialAnchor | null;
};

export type SpatialWorldHistorySnapshot = {
  readonly worldJson: string;
  readonly summaryDe: string;
  readonly affectedMapIds: readonly string[];
  readonly plan: WorldOperationPlan;
  readonly mapSnapshots?: Readonly<Record<string, SpatialMapPersistSnapshot>>;
};

export type SpatialWorldTransactionHistory = {
  readonly past: readonly SpatialWorldHistorySnapshot[];
  readonly future: readonly SpatialWorldHistorySnapshot[];
};

export function emptySpatialWorldHistory(): SpatialWorldTransactionHistory {
  return { past: [], future: [] };
}

export function serializeSpatialWorld(world: SpatialWorldModel): string {
  return JSON.stringify(world);
}

export function parseSpatialWorld(raw: string): SpatialWorldModel {
  return JSON.parse(raw) as SpatialWorldModel;
}

function trimPast(
  past: readonly SpatialWorldHistorySnapshot[],
): readonly SpatialWorldHistorySnapshot[] {
  if (past.length <= ATLAS_EDIT_HISTORY_LIMIT) return past;
  return past.slice(past.length - ATLAS_EDIT_HISTORY_LIMIT);
}

export type ExecuteSpatialWorldResult =
  | {
      readonly ok: true;
      readonly world: SpatialWorldModel;
      readonly history: SpatialWorldTransactionHistory;
      readonly appliedChangeCount: number;
      readonly affectedMapIds: readonly string[];
    }
  | {
      readonly ok: false;
      readonly world: SpatialWorldModel;
      readonly history: SpatialWorldTransactionHistory;
      readonly code: Extract<ApplyWorldOperationResult, { ok: false }>['code'];
      readonly violations: Extract<ApplyWorldOperationResult, { ok: false }>['violations'];
      readonly reasonDe: string;
    };

/**
 * Execute a planned `WorldOperationPlan` atomically and record exactly ONE undo entry.
 * On pre/post invariant failure: rolls back cleanly; both `world` and `history` stay untouched.
 */
export function executeSpatialWorldOperation(
  world: SpatialWorldModel,
  history: SpatialWorldTransactionHistory,
  plan: WorldOperationPlan,
  preMapSnapshots?: Readonly<Record<string, SpatialMapPersistSnapshot>>,
): ExecuteSpatialWorldResult {
  const applied = applyWorldOperation(world, plan);
  if ('reasonDe' in applied) {
    return {
      ok: false,
      world,
      history,
      code: applied.code,
      violations: applied.violations,
      reasonDe: applied.reasonDe,
    };
  }
  const snapshot: SpatialWorldHistorySnapshot = {
    worldJson: serializeSpatialWorld(world),
    summaryDe: plan.summaryDe,
    affectedMapIds: applied.affectedMapIds,
    plan,
    ...(preMapSnapshots ? { mapSnapshots: preMapSnapshots } : {}),
  };
  return {
    ok: true,
    world: applied.world,
    history: {
      past: trimPast([...history.past, snapshot]),
      future: [],
    },
    appliedChangeCount: applied.appliedChangeCount,
    affectedMapIds: applied.affectedMapIds,
  };
}

export function undoSpatialWorldOperation(
  world: SpatialWorldModel,
  history: SpatialWorldTransactionHistory,
  currentMapSnapshots?: Readonly<Record<string, SpatialMapPersistSnapshot>>,
): {
  readonly world: SpatialWorldModel;
  readonly history: SpatialWorldTransactionHistory;
  readonly affectedMapIds: readonly string[];
  readonly plan: WorldOperationPlan;
  readonly mapSnapshots?: Readonly<Record<string, SpatialMapPersistSnapshot>>;
} | null {
  if (history.past.length === 0) return null;
  const last = history.past[history.past.length - 1]!;
  const currentSnapshot: SpatialWorldHistorySnapshot = {
    worldJson: serializeSpatialWorld(world),
    summaryDe: last.summaryDe,
    affectedMapIds: last.affectedMapIds,
    plan: last.plan,
    ...(currentMapSnapshots ? { mapSnapshots: currentMapSnapshots } : {}),
  };
  return {
    world: parseSpatialWorld(last.worldJson),
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, currentSnapshot],
    },
    affectedMapIds: last.affectedMapIds,
    plan: last.plan,
    ...(last.mapSnapshots ? { mapSnapshots: last.mapSnapshots } : {}),
  };
}

export function redoSpatialWorldOperation(
  world: SpatialWorldModel,
  history: SpatialWorldTransactionHistory,
  currentMapSnapshots?: Readonly<Record<string, SpatialMapPersistSnapshot>>,
): {
  readonly world: SpatialWorldModel;
  readonly history: SpatialWorldTransactionHistory;
  readonly affectedMapIds: readonly string[];
  readonly plan: WorldOperationPlan;
  readonly mapSnapshots?: Readonly<Record<string, SpatialMapPersistSnapshot>>;
} | null {
  if (history.future.length === 0) return null;
  const next = history.future[history.future.length - 1]!;
  const currentSnapshot: SpatialWorldHistorySnapshot = {
    worldJson: serializeSpatialWorld(world),
    summaryDe: next.summaryDe,
    affectedMapIds: next.affectedMapIds,
    plan: next.plan,
    ...(currentMapSnapshots ? { mapSnapshots: currentMapSnapshots } : {}),
  };
  return {
    world: parseSpatialWorld(next.worldJson),
    history: {
      past: trimPast([...history.past, currentSnapshot]),
      future: history.future.slice(0, -1),
    },
    affectedMapIds: next.affectedMapIds,
    plan: next.plan,
    ...(next.mapSnapshots ? { mapSnapshots: next.mapSnapshots } : {}),
  };
}

export function canUndoSpatialWorld(history: SpatialWorldTransactionHistory): boolean {
  return history.past.length > 0;
}

export function canRedoSpatialWorld(history: SpatialWorldTransactionHistory): boolean {
  return history.future.length > 0;
}
