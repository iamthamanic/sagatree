/**
 * atlas-revision-contract — ATL2-B03 CAS / autosave / changeset rules.
 * Location: src/domains/world/atlas/atlas-revision-contract.ts
 *
 * Pure domain helpers for owner-scoped atlas saves. Host SQLite remains
 * authoritative for revision CAS and ownership.
 */

import { applyMapEdits, type MapEditOperation } from './map-edit-ops';
import type { UnifiedCanvasDoc } from './unified-canvas-doc';
import {
  isAtlasRevisionConflictMessage,
  reduceAtlasPersistStatus,
  type AtlasPersistStatus,
} from './atlas-persist-state';

/** Debounced autosave delay (ms). Explicit Save may bypass and call immediately. */
export const ATLAS_AUTOSAVE_DEBOUNCE_MS = 1_200 as const;

/** Max queued local edits before forcing a save attempt. */
export const ATLAS_AUTOSAVE_MAX_PENDING_OPS = 40 as const;

export const ATLAS_REVISION_CONFLICT_DE =
  'Die Karte wurde inzwischen geändert. Bitte neu laden und erneut speichern.' as const;

export const ATLAS_REVISION_REQUIRED_DE =
  'Karten-Revision fehlt — Speichern ohne Versionsabgleich ist nicht erlaubt.' as const;

export type AtlasSaveRevisionRequirement =
  | { readonly mode: 'create'; readonly expectedRevision: null }
  | { readonly mode: 'update'; readonly expectedRevision: number };

/**
 * Create may omit revision; updates must send a finite non-negative expectedRevision.
 */
export function resolveAtlasSaveRevisionRequirement(
  mapId: string | null | undefined,
  expectedRevision: number | null | undefined,
):
  | { readonly ok: true; readonly value: AtlasSaveRevisionRequirement }
  | { readonly ok: false; readonly reason: 'revision_required' } {
  const id = typeof mapId === 'string' && mapId.trim().length > 0 ? mapId.trim() : null;
  if (!id) {
    return { ok: true, value: { mode: 'create', expectedRevision: null } };
  }
  if (typeof expectedRevision !== 'number' || !Number.isFinite(expectedRevision) || expectedRevision < 0) {
    return { ok: false, reason: 'revision_required' };
  }
  return { ok: true, value: { mode: 'update', expectedRevision } };
}

/**
 * Apply a bundled edit changeset locally before a single host upsert.
 * Empty ops return the same doc reference semantics via applyMapEdits reduce.
 */
export function applyAtlasEditChangeset(
  doc: UnifiedCanvasDoc,
  ops: readonly MapEditOperation[],
): UnifiedCanvasDoc {
  if (ops.length === 0) return doc;
  return applyMapEdits(doc, ops);
}

export type AtlasAutosaveDecision =
  | { readonly action: 'wait' }
  | { readonly action: 'save' }
  | { readonly action: 'blocked_conflict' };

/**
 * Autosave contract: never claim saved without server `save_ok`.
 * While conflicted, autosave stays blocked until explicit reload/retry.
 */
export function decideAtlasAutosave(input: {
  readonly status: AtlasPersistStatus;
  readonly pendingOps: number;
  readonly msSinceLastEdit: number;
}): AtlasAutosaveDecision {
  if (input.status === 'conflict') return { action: 'blocked_conflict' };
  if (input.status === 'saving' || input.status === 'clean' || input.status === 'saved') {
    return { action: 'wait' };
  }
  if (input.status !== 'dirty') return { action: 'wait' };
  if (input.pendingOps >= ATLAS_AUTOSAVE_MAX_PENDING_OPS) return { action: 'save' };
  if (input.msSinceLastEdit >= ATLAS_AUTOSAVE_DEBOUNCE_MS) return { action: 'save' };
  return { action: 'wait' };
}

export function atlasPersistAfterHostError(
  current: AtlasPersistStatus,
  message: string,
): AtlasPersistStatus {
  return reduceAtlasPersistStatus(current, {
    type: 'save_fail',
    conflict: isAtlasRevisionConflictMessage(message),
  });
}
