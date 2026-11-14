/**
 * aiberto-flags — feature flag for Aiberto companion shell (AIB-02 / #1125).
 * Location: src/app/ai-assistant/aiberto-flags.ts
 *
 * Default ON. Set VITE_AIBERTO_COMPANION_ENABLED=0|false to disable.
 */

export function isAibertoCompanionEnabled(): boolean {
  const raw = import.meta.env.VITE_AIBERTO_COMPANION_ENABLED;
  if (raw === undefined || raw === null || raw === '') return true;
  const normalized = String(raw).trim().toLowerCase();
  return normalized !== '0' && normalized !== 'false' && normalized !== 'off';
}
