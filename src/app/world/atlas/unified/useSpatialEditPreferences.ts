/**
 * useSpatialEditPreferences — device-local persistence for SCM confirmation preferences (§6).
 * Location: src/app/world/atlas/unified/useSpatialEditPreferences.ts
 *
 * Follows the exact device-local preference convention of `useAtlasGraphicsPreset.ts`:
 * persisted under `sagatree.atlas.spatialEditPrefs.v1` in `localStorage`.
 * Controls ONLY confirmation prompts, never domain invariants or undo atomicity (INV-6).
 */
import { useCallback, useState } from 'react';
import {
  DEFAULT_SPATIAL_EDIT_PREFERENCES,
  SPATIAL_EDIT_PREFS_STORAGE_KEY,
  applyDontAskAgainPreference,
  parseSpatialEditPreferences,
  serializeSpatialEditPreferences,
  type ExecuteSpatialWorldResult,
  type SpatialConfirmationKind,
  type SpatialEditIntent,
  type SpatialEditPreferences,
  type SpatialPropagationPlanResult,
  type SpatialWorldModel,
  type WorldOperationPlan,
} from '../../../../domains/world/atlas';

/**
 * UI-to-Workbench adapter contract for SCM world operations (SCM-04).
 * Planning & invariant validation live purely in `src/domains/world/atlas/`;
 * the adapter only binds in-memory multi-map state, undo history, and `upsertMap` persistence.
 */
export type AtlasSpatialContainmentAdapter = {
  readonly world: SpatialWorldModel;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly planIntent: (intent: SpatialEditIntent) => SpatialPropagationPlanResult;
  readonly commitPlan: (plan: WorldOperationPlan) => Promise<ExecuteSpatialWorldResult>;
  readonly undo: () => Promise<boolean>;
  readonly redo: () => Promise<boolean>;
};

export function loadSpatialEditPreferences(): SpatialEditPreferences {
  try {
    return parseSpatialEditPreferences(window.localStorage.getItem(SPATIAL_EDIT_PREFS_STORAGE_KEY));
  } catch {
    return DEFAULT_SPATIAL_EDIT_PREFERENCES;
  }
}

export function saveSpatialEditPreferences(next: SpatialEditPreferences): void {
  try {
    window.localStorage.setItem(
      SPATIAL_EDIT_PREFS_STORAGE_KEY,
      serializeSpatialEditPreferences(next),
    );
  } catch {
    // Private mode / disabled storage — keep in-memory state.
  }
}

export function useSpatialEditPreferences() {
  const [prefs, setPrefsState] = useState<SpatialEditPreferences>(loadSpatialEditPreferences);

  const updatePrefs = useCallback(
    (updater: (prev: SpatialEditPreferences) => SpatialEditPreferences) => {
      setPrefsState((prev) => {
        const next = updater(prev);
        saveSpatialEditPreferences(next);
        return next;
      });
    },
    [],
  );

  const setConfirmGrow = useCallback(
    (confirmGrow: boolean) => {
      updatePrefs((prev) => ({ ...prev, confirmGrow }));
    },
    [updatePrefs],
  );

  const setConfirmCascade = useCallback(
    (confirmCascade: boolean) => {
      updatePrefs((prev) => ({ ...prev, confirmCascade }));
    },
    [updatePrefs],
  );

  const dismissPromptFor = useCallback(
    (confirmation: SpatialConfirmationKind) => {
      updatePrefs((prev) => applyDontAskAgainPreference(prev, confirmation));
    },
    [updatePrefs],
  );

  return {
    prefs,
    setConfirmGrow,
    setConfirmCascade,
    dismissPromptFor,
  } as const;
}
