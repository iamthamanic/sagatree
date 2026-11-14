/**
 * atlas-workstation-adaptive — ATL2-C05/G03 composition + chrome state rules.
 * Location: src/domains/world/atlas/atlas-workstation-adaptive.ts
 *
 * Pure domain — no React / no shared UI imports.
 * Surface class: Workstation (AU contract §2 / §6.2).
 * G03 adds gesture/keyboard/fallback surface states across device bands.
 */

export type AtlasAdaptiveBand = 'phone' | 'tablet' | 'desktop';

/** Content-width thresholds aligned with AU bands (px). */
export const ATLAS_PHONE_CONTENT_MAX_PX = 767 as const;
export const ATLAS_TABLET_CONTENT_MAX_PX = 1023 as const;

/**
 * Desktop multi-pane side rails appear at this container width (Tailwind @[48rem]).
 * Below: Phone/Tablet reduced composition (map + sheet chrome).
 */
export const ATLAS_SIDE_RAIL_MIN_PX = 768 as const;

/** Narrowest supported content width for AU-CONTENT-WIDTH proofs. */
export const ATLAS_CONTENT_WIDTH_FLOOR_PX = 320 as const;

export type AtlasWorkstationComposition = {
  readonly band: AtlasAdaptiveBand;
  /** Show left/right desktop rails inline. */
  readonly showSideRails: boolean;
  /** Prefer Sheet/Drawer for inspector & hierarchy. */
  readonly useSheetsForChrome: boolean;
  /** Reduced Phone workstation: primary map task only. */
  readonly reducedPhoneComposition: boolean;
};

export function resolveAtlasAdaptiveBand(widthPx: number): AtlasAdaptiveBand {
  if (!Number.isFinite(widthPx) || widthPx < 0) return 'desktop';
  if (widthPx <= ATLAS_PHONE_CONTENT_MAX_PX) return 'phone';
  if (widthPx <= ATLAS_TABLET_CONTENT_MAX_PX) return 'tablet';
  return 'desktop';
}

export function resolveAtlasWorkstationComposition(
  contentWidthPx: number,
): AtlasWorkstationComposition {
  const band = resolveAtlasAdaptiveBand(contentWidthPx);
  const showSideRails = contentWidthPx >= ATLAS_SIDE_RAIL_MIN_PX;
  return {
    band,
    showSideRails,
    useSheetsForChrome: !showSideRails,
    reducedPhoneComposition: band === 'phone',
  };
}

/** Touch vs pointer: critical actions must not be hover-only (AU / CE-12). */
export function atlasInteractionModeLabelDe(mode: 'touch' | 'pointer' | 'keyboard'): string {
  if (mode === 'touch') return 'Touch — Werkzeuge über Leiste und Sheets';
  if (mode === 'keyboard') return 'Tastatur — Tab/Enter; Escape bricht Entwürfe ab';
  return 'Zeiger — Klick wählt; Ziehen bearbeitet';
}

export function atlasContentWidthUsable(widthPx: number): boolean {
  return Number.isFinite(widthPx) && widthPx >= ATLAS_CONTENT_WIDTH_FLOOR_PX;
}

/** AU touch target floor for primary atlas chrome (px). */
export const ATLAS_MIN_TOUCH_TARGET_PX = 44 as const;

/**
 * ATL2-G03 — observable workstation chrome / canvas states (not CSS-only).
 * Used for aria/live regions and data-atlas-* markers across Phone/Tablet/Desktop.
 */
export type AtlasWorkstationSurfaceState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'unlocated'
  | 'error'
  | 'webgl-fallback'
  | 'reduced-motion';

export type AtlasGestureMode = 'pan' | 'draw' | 'select' | 'navigate';

export type AtlasCriticalControlId =
  | 'save'
  | 'undo'
  | 'nav-breadcrumb'
  | 'tool-hand'
  | 'view-2d'
  | 'view-3d';

export type AtlasKeyboardShortcut = {
  readonly id: string;
  readonly keysDe: string;
  readonly actionDe: string;
  readonly bands: readonly AtlasAdaptiveBand[];
};

/** Documented shortcuts — must remain reachable without hover-only paths. */
export const ATLAS_KEYBOARD_SHORTCUTS: readonly AtlasKeyboardShortcut[] = [
  {
    id: 'escape-cancel',
    keysDe: 'Escape',
    actionDe: 'Entwurf / Auswahl abbrechen',
    bands: ['phone', 'tablet', 'desktop'],
  },
  {
    id: 'undo',
    keysDe: 'Strg+Z',
    actionDe: 'Rückgängig',
    bands: ['tablet', 'desktop'],
  },
  {
    id: 'redo',
    keysDe: 'Strg+Umschalt+Z',
    actionDe: 'Wiederholen',
    bands: ['tablet', 'desktop'],
  },
  {
    id: 'hand-tool',
    keysDe: 'H',
    actionDe: 'Hand / Schwenken',
    bands: ['phone', 'tablet', 'desktop'],
  },
  {
    id: 'save',
    keysDe: 'Strg+S',
    actionDe: 'Speichern',
    bands: ['tablet', 'desktop'],
  },
] as const;

export type AtlasGestureDisambiguation = {
  readonly mode: AtlasGestureMode;
  readonly touchActionCss: 'none' | 'pan-x pan-y' | 'manipulation';
  readonly pointerPrimary: 'touch' | 'mouse' | 'pen' | 'keyboard';
  readonly labelDe: string;
};

/**
 * Pan vs draw: one-finger pan on touch when hand/navigate; draw/select capture
 * pointer so chrome sheets stay scrollable (AU gesture disambiguation).
 */
export function resolveAtlasGestureDisambiguation(input: {
  readonly tool: string;
  readonly pointerType: string;
  readonly band: AtlasAdaptiveBand;
}): AtlasGestureDisambiguation {
  const tool = typeof input.tool === 'string' ? input.tool.trim().toLowerCase() : 'hand';
  const pointer = typeof input.pointerType === 'string' ? input.pointerType.trim().toLowerCase() : '';
  const pointerPrimary: AtlasGestureDisambiguation['pointerPrimary'] =
    pointer === 'touch' || pointer === 'pen' || pointer === 'mouse' || pointer === 'keyboard'
      ? (pointer as AtlasGestureDisambiguation['pointerPrimary'])
      : input.band === 'phone'
        ? 'touch'
        : 'mouse';

  let mode: AtlasGestureMode = 'pan';
  if (tool === 'hand' || tool === 'navigate' || tool === '') mode = 'pan';
  else if (tool === 'select') mode = 'select';
  else if (tool === 'focus' || tool === 'nav') mode = 'navigate';
  else mode = 'draw';

  if (mode === 'pan' || mode === 'navigate') {
    return {
      mode,
      touchActionCss: 'pan-x pan-y',
      pointerPrimary,
      labelDe:
        mode === 'navigate'
          ? 'Navigation — Wischen schwenkt; Tippen öffnet Orte'
          : 'Schwenken — ein Finger bewegt die Karte; Werkzeuge in der Leiste',
    };
  }
  return {
    mode,
    touchActionCss: 'none',
    pointerPrimary,
    labelDe:
      mode === 'select'
        ? 'Auswahl — Tippen wählt; Ziehen verschiebt Objekte'
        : 'Zeichnen — Geste bleibt auf der Leinwand (kein Seitenscroll)',
  };
}

export type ResolveAtlasSurfaceStateInput = {
  readonly loading?: boolean;
  readonly error?: boolean;
  readonly emptyMaps?: boolean;
  readonly unlocated?: boolean;
  readonly webglFallback?: boolean;
  readonly reducedMotion?: boolean;
};

/**
 * Priority: error > loading > empty > unlocated > webgl-fallback > reduced-motion > ready.
 * Reduced-motion is a modifier state when otherwise ready (still safe to interact).
 */
export function resolveAtlasWorkstationSurfaceState(
  input: ResolveAtlasSurfaceStateInput,
): AtlasWorkstationSurfaceState {
  if (input.error) return 'error';
  if (input.loading) return 'loading';
  if (input.emptyMaps) return 'empty';
  if (input.unlocated) return 'unlocated';
  if (input.webglFallback) return 'webgl-fallback';
  if (input.reducedMotion) return 'reduced-motion';
  return 'ready';
}

export function atlasWorkstationSurfaceLabelDe(state: AtlasWorkstationSurfaceState): string {
  switch (state) {
    case 'loading':
      return 'Karte wird geladen…';
    case 'empty':
      return 'Noch keine Karte — Root anlegen oder Golden starten';
    case 'unlocated':
      return 'Kindkarte ohne Parent-Anker — Locate im Elternraum';
    case 'error':
      return 'Atlas konnte nicht geladen werden';
    case 'webgl-fallback':
      return 'WebGL fehlt — Software-3D / 2D-Fallback aktiv';
    case 'reduced-motion':
      return 'Reduzierte Bewegung — Zoom/Schwenk ohne Animation';
    default:
      return 'Atlas bereit';
  }
}

export function atlasCriticalControlsForBand(
  band: AtlasAdaptiveBand,
): readonly AtlasCriticalControlId[] {
  if (band === 'phone') {
    return ['save', 'undo', 'nav-breadcrumb', 'tool-hand', 'view-2d'];
  }
  return ['save', 'undo', 'nav-breadcrumb', 'tool-hand', 'view-2d', 'view-3d'];
}

export function atlasKeyboardShortcutsForBand(
  band: AtlasAdaptiveBand,
): readonly AtlasKeyboardShortcut[] {
  return ATLAS_KEYBOARD_SHORTCUTS.filter((s) => s.bands.includes(band));
}

export function atlasChromeOverflowSafe(input: {
  readonly contentWidthPx: number;
  readonly criticalControlCount: number;
  readonly minTouchTargetPx?: number;
}): boolean {
  const floor = ATLAS_CONTENT_WIDTH_FLOOR_PX;
  const target = input.minTouchTargetPx ?? ATLAS_MIN_TOUCH_TARGET_PX;
  if (!atlasContentWidthUsable(input.contentWidthPx)) return false;
  if (input.criticalControlCount <= 0) return true;
  /* Soft budget: controls must fit in one wrap row without forcing < floor usable map. */
  const estimated = input.criticalControlCount * (target + 8);
  return input.contentWidthPx >= floor && estimated <= Math.max(floor, input.contentWidthPx * 2);
}
