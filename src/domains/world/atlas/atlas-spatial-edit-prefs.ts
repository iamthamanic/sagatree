/**
 * atlas-spatial-edit-prefs — SCM-04: Pure domain contract for spatial confirmation preferences (§6).
 * Location: src/domains/world/atlas/atlas-spatial-edit-prefs.ts
 *
 * Pure domain — NO React, NO window/localStorage, NO Host SDK (BR-005).
 *
 * Two persistent user preferences (default ON):
 *  - `confirmGrow`    (`spatialEdit.confirmGrow`)    — prompt before upward auto-grow propagation
 *  - `confirmCascade` (`spatialEdit.confirmCascade`) — prompt before downward soft-cascade removal
 *
 * Disabling a prompt NEVER disables atomicity, invariants, or undo (INV-6).
 */
import type { SpatialConfirmationKind, WorldOperationPlan } from './atlas-spatial-propagation';

export const SPATIAL_EDIT_PREFS_STORAGE_KEY = 'sagatree.atlas.spatialEditPrefs.v1' as const;

export type SpatialEditPreferences = {
  readonly confirmGrow: boolean;
  readonly confirmCascade: boolean;
};

export const DEFAULT_SPATIAL_EDIT_PREFERENCES: SpatialEditPreferences = {
  confirmGrow: true,
  confirmCascade: true,
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse raw JSON string or object fail-safe; missing/invalid fields fall back to default `true`. */
export function parseSpatialEditPreferences(raw: unknown): SpatialEditPreferences {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return DEFAULT_SPATIAL_EDIT_PREFERENCES;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      return DEFAULT_SPATIAL_EDIT_PREFERENCES;
    }
  }
  if (!isPlainRecord(obj)) {
    return DEFAULT_SPATIAL_EDIT_PREFERENCES;
  }
  return {
    confirmGrow:
      typeof obj.confirmGrow === 'boolean'
        ? obj.confirmGrow
        : DEFAULT_SPATIAL_EDIT_PREFERENCES.confirmGrow,
    confirmCascade:
      typeof obj.confirmCascade === 'boolean'
        ? obj.confirmCascade
        : DEFAULT_SPATIAL_EDIT_PREFERENCES.confirmCascade,
  };
}

export function serializeSpatialEditPreferences(prefs: SpatialEditPreferences): string {
  return JSON.stringify({
    confirmGrow: Boolean(prefs.confirmGrow),
    confirmCascade: Boolean(prefs.confirmCascade),
  });
}

/** Decide whether a planned `WorldOperationPlan` must show a confirmation dialog. */
export function shouldPromptSpatialOperation(
  plan: Pick<WorldOperationPlan, 'requiresConfirmation'>,
  prefs: SpatialEditPreferences,
): boolean {
  if (plan.requiresConfirmation === 'grow') return prefs.confirmGrow;
  if (plan.requiresConfirmation === 'cascade') return prefs.confirmCascade;
  return false;
}

/** Apply „Nicht mehr nachfragen“ for a confirmation kind without mutating input. */
export function applyDontAskAgainPreference(
  prefs: SpatialEditPreferences,
  confirmation: SpatialConfirmationKind,
): SpatialEditPreferences {
  if (confirmation === 'grow') {
    return { ...prefs, confirmGrow: false };
  }
  if (confirmation === 'cascade') {
    return { ...prefs, confirmCascade: false };
  }
  return prefs;
}
