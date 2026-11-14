/**
 * ai-assistant area — Aiberto companion public barrel (AIB-02 / #1125).
 * Location: src/app/ai-assistant/index.ts
 */
export { AibertoCompanion, AibertoToggleButton } from './AibertoCompanion';
export { RulebookBrowser } from './RulebookBrowser';
export { isAibertoCompanionEnabled } from './aiberto-flags';
export {
  AIBERTO_DOCK_DEFAULT_PX,
  AIBERTO_DOCK_MAX_PX,
  AIBERTO_DOCK_MIN_PX,
  AIBERTO_PREFS_KEY,
  clampAibertoDockWidth,
  defaultAibertoPrefs,
  readAibertoPrefs,
  writeAibertoPrefs,
  type AibertoPrefs,
} from './aiberto-prefs';
