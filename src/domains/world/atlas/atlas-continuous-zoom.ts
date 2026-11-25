/**
 * atlas-continuous-zoom — ATL3-S01 (#1301) & ATL4-S02 (#1319) zoom & scale continuity.
 * Location: src/domains/world/atlas/atlas-continuous-zoom.ts
 *
 * Pure domain — no React, no Three.js, no Host SDKs.
 * Evaluates continuous wheel-zoom transitions across the six hierarchy scales
 * (Welt → Kontinent → Land → Ort → Gebäude → Raum) using persisted map pins
 * and parent spatial anchors without inventing unlocated coordinates.
 */

import type { AtlasMapPin, AtlasMapScale } from './atlas-map-pins';

export type AtlasZoomTransitionIntent =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'enter-child';
      readonly pin: AtlasMapPin;
      readonly distance: number;
    }
  | {
      readonly kind: 'exit-parent';
    };

export type AtlasScaleLabelSpec = {
  readonly scale: AtlasMapScale;
  readonly tagDe: string;
  readonly unitsPerKm: number;
};

export function formatAtlasSpanLabelDe(span: number, mapScale: AtlasMapScale): string {
  const safe = Math.max(1, Number.isFinite(span) ? span : 500);
  if (mapScale === 'world') {
    const km = Math.max(1, Math.round(safe * 2.4));
    return `${km} km Ausschnitt`;
  }
  if (mapScale === 'settlement') {
    const meters = Math.max(10, Math.round(safe * 1.2));
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km Ausschnitt` : `${meters} m Ausschnitt`;
  }
  const meters = Math.max(2, Math.round(safe * 0.15));
  return `${meters} m Innenraum`;
}

/**
 * Determine whether continuous wheel zoom should offer/trigger a drill-in to
 * the closest located child pin or zoom-out to the parent map.
 */
export function resolveContinuousZoomTransition(input: {
  readonly centerX: number;
  readonly centerY: number;
  readonly span: number;
  readonly wheelDeltaY: number;
  readonly hasParentMap: boolean;
  readonly pins: readonly AtlasMapPin[];
  readonly mapScale: AtlasMapScale;
}): AtlasZoomTransitionIntent {
  const { centerX, centerY, span, wheelDeltaY, hasParentMap, pins, mapScale } = input;

  // Zooming out past max overview span returns smoothly to parent map (Google-Maps continuous zoom).
  const exitThreshold = mapScale === 'interior' ? 760 : 880;
  if (wheelDeltaY > 0 && hasParentMap && span >= exitThreshold) {
    return { kind: 'exit-parent' };
  }

  // Zooming deeply in over a located child pin drills seamlessly into that child map.
  const enterThreshold = mapScale === 'world' ? 145 : mapScale === 'settlement' ? 88 : 50;
  if (wheelDeltaY < 0 && span <= enterThreshold && pins.length > 0) {
    let best: { pin: AtlasMapPin; dist: number } | null = null;
    for (const pin of pins) {
      const dist = Math.hypot(pin.x - centerX, pin.y - centerY);
      const hitRadius = Math.max(span * 0.85, 85);
      if (dist <= hitRadius && (!best || dist < best.dist)) {
        best = { pin, dist };
      }
    }
    if (best) {
      return { kind: 'enter-child', pin: best.pin, distance: best.dist };
    }
  }

  return { kind: 'none' };
}
