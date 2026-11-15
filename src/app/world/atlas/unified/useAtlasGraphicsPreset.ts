/**
 * useAtlasGraphicsPreset — device-local Atlas 3D quality switch (high / balanced / lite).
 * Location: src/app/world/atlas/unified/useAtlasGraphicsPreset.ts
 *
 * ATL3-V01 (#1295): product setting, persisted per device in localStorage
 * (same convention as other display preferences). Default `balanced`.
 * Unknown / missing values fall back to the default; never a test-only hook.
 */
import { useCallback, useState } from 'react';
import {
  ATLAS_GRAPHICS_PRESET_DEFAULT,
  ATLAS_GRAPHICS_PRESET_STORAGE_KEY,
  parseAtlasGraphicsPresetId,
  type AtlasGraphicsPresetId,
} from '../../../../domains/world/atlas';

export function loadAtlasGraphicsPreset(): AtlasGraphicsPresetId {
  try {
    return (
      parseAtlasGraphicsPresetId(window.localStorage.getItem(ATLAS_GRAPHICS_PRESET_STORAGE_KEY)) ??
      ATLAS_GRAPHICS_PRESET_DEFAULT
    );
  } catch {
    return ATLAS_GRAPHICS_PRESET_DEFAULT;
  }
}

export function useAtlasGraphicsPreset() {
  const [presetId, setPresetState] = useState<AtlasGraphicsPresetId>(loadAtlasGraphicsPreset);
  const setPresetId = useCallback((next: AtlasGraphicsPresetId) => {
    setPresetState(next);
    try {
      window.localStorage.setItem(ATLAS_GRAPHICS_PRESET_STORAGE_KEY, next);
    } catch {
      // Private mode / storage disabled — keep the in-memory choice.
    }
  }, []);
  return { presetId, setPresetId } as const;
}
