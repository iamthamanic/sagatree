/**
 * atlas-workstation-adaptive — ATL2-C05 composition rules for Atlas Workstation.
 * Location: src/domains/world/atlas/atlas-workstation-adaptive.ts
 *
 * Pure domain — no React / no shared UI imports.
 * Surface class: Workstation (AU contract §2 / §6.2).
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
