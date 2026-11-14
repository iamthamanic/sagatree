/**
 * ai-assistant area — Aiberto companion public barrel (AIB-02 / AIB-05 / AIB-06).
 * Location: src/app/ai-assistant/index.ts
 */
export { AibertoCompanion, AibertoToggleButton } from './AibertoCompanion';
export { AibertoChatPanel } from './AibertoChatPanel';
export { RulebookBrowser } from './RulebookBrowser';
export {
  AibertoToolActivityCard,
  AibertoToolActivityList,
  type AibertoToolActivity,
  type AibertoToolActivityStatus,
} from './AibertoToolActivityCard';
export {
  isAibertoChatEnabled,
  isAibertoCompanionEnabled,
  isAibertoToolsReadEnabled,
} from './aiberto-flags';
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
export {
  escapeHtml,
  extractDisplayCitationIds,
  renderSafeChatMarkdown,
  stripCitationMarkers,
} from './safe-chat-markdown';
