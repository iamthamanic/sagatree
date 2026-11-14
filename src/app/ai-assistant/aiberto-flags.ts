/**
 * aiberto-flags — feature flags for Aiberto companion (AIB-02 / AIB-05 / AIB-06).
 * Location: src/app/ai-assistant/aiberto-flags.ts
 *
 * Companion default ON. Chat tab default OFF until VITE_AIBERTO_CHAT_ENABLED=1
 * (pairs with host AIBERTO_CHAT_ENABLED for aiberto-ask).
 * Tools Read/Nav default OFF until VITE_AIBERTO_TOOLS_READ_ENABLED=1
 * (pairs with host AIBERTO_TOOLS_READ_ENABLED).
 */

function envFlagEnabled(raw: unknown, defaultEnabled: boolean): boolean {
  if (raw === undefined || raw === null || raw === '') return defaultEnabled;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') {
    return false;
  }
  if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') {
    return true;
  }
  return defaultEnabled;
}

export function isAibertoCompanionEnabled(): boolean {
  return envFlagEnabled(import.meta.env.VITE_AIBERTO_COMPANION_ENABLED, true);
}

/** Chat tab capability — default off (Release B). */
export function isAibertoChatEnabled(): boolean {
  return envFlagEnabled(import.meta.env.VITE_AIBERTO_CHAT_ENABLED, false);
}

/** Read/Nav tools capability — default off (Release C1). */
export function isAibertoToolsReadEnabled(): boolean {
  return envFlagEnabled(import.meta.env.VITE_AIBERTO_TOOLS_READ_ENABLED, false);
}
