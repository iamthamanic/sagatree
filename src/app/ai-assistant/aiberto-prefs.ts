/**
 * aiberto-prefs — local layout prefs for Aiberto companion (no chat text).
 * Location: src/app/ai-assistant/aiberto-prefs.ts
 */

export const AIBERTO_PREFS_KEY = 'sagatree-aiberto-prefs';

export const AIBERTO_DOCK_MIN_PX = 320;
export const AIBERTO_DOCK_MAX_PX = 520;
export const AIBERTO_DOCK_DEFAULT_PX = 380;

export type AibertoPrefs = {
  open: boolean;
  widthPx: number;
};

export function clampAibertoDockWidth(widthPx: number): number {
  if (!Number.isFinite(widthPx)) return AIBERTO_DOCK_DEFAULT_PX;
  return Math.min(AIBERTO_DOCK_MAX_PX, Math.max(AIBERTO_DOCK_MIN_PX, Math.round(widthPx)));
}

export function defaultAibertoPrefs(): AibertoPrefs {
  return { open: false, widthPx: AIBERTO_DOCK_DEFAULT_PX };
}

export function readAibertoPrefs(): AibertoPrefs {
  const defaults = defaultAibertoPrefs();
  try {
    const raw = localStorage.getItem(AIBERTO_PREFS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AibertoPrefs>;
    return {
      open: Boolean(parsed.open),
      widthPx: clampAibertoDockWidth(
        typeof parsed.widthPx === 'number' ? parsed.widthPx : defaults.widthPx,
      ),
    };
  } catch {
    return defaults;
  }
}

export function writeAibertoPrefs(prefs: AibertoPrefs): void {
  try {
    localStorage.setItem(
      AIBERTO_PREFS_KEY,
      JSON.stringify({
        open: Boolean(prefs.open),
        widthPx: clampAibertoDockWidth(prefs.widthPx),
      }),
    );
  } catch {
    // private mode / quota — ignore
  }
}
