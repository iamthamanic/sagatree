/**
 * atlas-label-hierarchy — Google-Maps-style progressive zoom-tier labels & portal archetypes.
 * Location: src/domains/world/atlas/atlas-label-hierarchy.ts
 *
 * Pure domain (no React, no DOM, no Three.js):
 *  - Assigns every map pin a semantic importance tier (1 = primary landmark/continent,
 *    2 = major district/building/plaza, 3 = street/crypt entrance/micro POI) so labels
 *    progressively reveal with smooth opacity & scale ramps as you zoom in.
 *  - Classifies map-to-map transitions into atmospheric outdoor flights vs. thematic
 *    building/crypt portal animations (oak tavern doors, iron crypt portcullis, sunlit exit).
 */
import type { AtlasMapScale } from './atlas-map-pins';

export type AtlasLabelTier = 1 | 2 | 3;

export type AtlasPinZoomPresentation = {
  readonly tier: AtlasLabelTier;
  /** Smooth [0..1] opacity across the reveal zoom ramp (0 = hidden). */
  readonly opacity: number;
  /** Subtle [0.86..1.0] scale ramp for silky reveal. */
  readonly scale: number;
  /** True when the pin is visible enough to render and participate in decluttering. */
  readonly visible: boolean;
  /** True when full label text should show (Tier 3 can show subtle dot slightly before text). */
  readonly showText: boolean;
  /** True when this pin is currently focused/active and must never be hidden or pushed aside. */
  readonly locked?: boolean;
};

export type AtlasPortalTransitionKind =
  | 'flight-in'
  | 'flight-out'
  | 'tavern-doors'
  | 'crypt-gate'
  | 'outdoor-exit';

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Determine semantic cartographic importance tier for a pin on the active map:
 * - Tier 1: Continents, countries, major regions, settlements on world maps, primary hubs.
 * - Tier 2: Important buildings, taverns, plazas, towers, keeps inside settlements.
 * - Tier 3: Streets, roads, crypt/cave entrances, rooms, micro-POIs (revealed on close zoom).
 */
export type AtlasLabelPinLike = {
  readonly id: string;
  readonly label: string;
  readonly kind?: string | null;
};

export function classifyAtlasPinTier(
  pin: AtlasLabelPinLike,
  mapScale: AtlasMapScale,
): AtlasLabelTier {
  const kind = (pin.kind ?? '').toLowerCase();
  const label = (pin.label ?? '').toLowerCase();

  // Explicit Tier 3 micro-POIs: roads, streets, crypt/dungeon/cave entrances, rooms
  if (
    kind === 'room' ||
    kind === 'poi' ||
    kind === 'street' ||
    kind === 'road' ||
    /\b(road|straße|strasse|weg|gasse|pfad|krypta|crypt|höhle|hoehle|cave|dungeon|keller|gruft|eingang|tor)\b/i.test(
      label,
    )
  ) {
    return 3;
  }

  // On world / continent / country maps: continents, regions & major settlements are Tier 1
  if (mapScale === 'world') {
    if (
      kind === 'continent' ||
      kind === 'country' ||
      kind === 'region' ||
      kind === 'land' ||
      kind === 'place' ||
      kind === 'settlement' ||
      /\b(kontinent|reich|land|westmark|nordreich|dornhain)\b/i.test(label)
    ) {
      return 1;
    }
    return 2;
  }

  // On settlement maps (e.g. Dornhain): central town square / primary tavern stands above secondary POIs
  if (mapScale === 'settlement') {
    if (
      /\b(taverne|gasthaus|inn|burg|schloss|kathedrale|rathaus|dorfkern|dornhain)\b/i.test(label)
    ) {
      return 1;
    }
    if (
      kind === 'building' ||
      kind === 'place' ||
      /\b(markt|platz|turm|wachturm|schmiede|tempel|hafen|brücke)\b/i.test(label)
    ) {
      return 2;
    }
    return 3;
  }

  // Inside buildings / interiors: rooms & landmarks are Tier 2, details Tier 3
  return kind === 'building' || kind === 'place' ? 2 : 3;
}

/**
 * Compute continuous Google-Maps-style progressive visibility for a pin.
 *
 * In continuous World Scene Graph mode (`opts.isWorldSceneGraph === true` with real
 * `projectedSpanPx` of the place's footprint on screen):
 *  - Visibility follows actual screen projection + hierarchy (Continent → Country → Place →
 *    Building/Dungeon → Room), NEVER rigid global span cutoffs!
 *  - A focused or larger-located place reveals proportionally without being blocked by a
 *    hardcoded span wall, and the currently focused/active place stays locked & visible.
 *
 * In legacy single-map mode (`!opts.isWorldSceneGraph`), preserves the existing local span
 * reveal curve for single-document editing.
 */
export function computeAtlasPinZoomPresentation(
  pin: AtlasLabelPinLike,
  span: number,
  mapScale: AtlasMapScale,
  opts?: {
    readonly activePlaceId?: string | null;
    readonly totalPins?: number;
    readonly isWorldSceneGraph?: boolean;
    readonly projectedSpanPx?: number;
    readonly isFocused?: boolean;
  },
): AtlasPinZoomPresentation {
  const isSelected = Boolean(
    opts?.isFocused || (opts?.activePlaceId && opts.activePlaceId === pin.id),
  );

  // Continuous World Scene Graph: projection-driven hierarchy (Continent → Country → Place → Building → Room)
  if (opts?.isWorldSceneGraph) {
    const kind = (pin.kind ?? '').toLowerCase();
    const label = (pin.label ?? '').toLowerCase();
    const projPx = Number.isFinite(opts.projectedSpanPx) ? Math.max(0, opts.projectedSpanPx!) : 0;

    if (isSelected) {
      const activeTier: AtlasLabelTier =
        kind === 'continent' || kind === 'country' || kind === 'place' ? 1 : 2;
      return {
        tier: activeTier,
        opacity: 1,
        scale: 1,
        visible: true,
        showText: true,
        locked: true,
      };
    }

    const isMicroPoi =
      kind === 'room' ||
      kind === 'poi' ||
      kind === 'street' ||
      kind === 'road' ||
      /\b(road|straße|strasse|weg|gasse|pfad)\b/i.test(label);

    if (kind === 'continent') {
      // Visible from world overview; gently yields once zoomed deep into a country/settlement
      const fadeOut = 1 - smoothstep(2400, 4200, projPx);
      const opacity = Math.round(fadeOut * 1000) / 1000;
      return {
        tier: 1,
        opacity,
        scale: Math.round((0.9 + 0.1 * opacity) * 1000) / 1000,
        visible: opacity > 0.05,
        showText: opacity > 0.18,
      };
    }

    if (kind === 'country' || kind === 'region' || kind === 'land') {
      // Appears as the continent approaches viewport scale; yields smoothly inside town close-ups
      const fadeIn = smoothstep(95, 190, projPx);
      const fadeOut = 1 - smoothstep(3200, 5400, projPx);
      const opacity = Math.round(fadeIn * fadeOut * 1000) / 1000;
      return {
        tier: 1,
        opacity,
        scale: Math.round((0.88 + 0.12 * opacity) * 1000) / 1000,
        visible: opacity > 0.05,
        showText: opacity > 0.18,
      };
    }

    if ((kind === 'place' || kind === 'settlement') && !isMicroPoi) {
      // Settlements (e.g. Moorbrück, Dornhain): reveal as soon as projected footprint >= ~18..44 px
      // (already visible on regional/country zoom, never cluttering planet overview at ~3 px!)
      const fadeIn = smoothstep(18, 44, projPx);
      const fadeOut = 1 - smoothstep(2600, 4400, projPx);
      const opacity = Math.round(fadeIn * fadeOut * 1000) / 1000;
      return {
        tier: 2,
        opacity,
        scale: Math.round((0.88 + 0.12 * opacity) * 1000) / 1000,
        visible: opacity > 0.05,
        showText: opacity > 0.16,
      };
    }

    if (kind === 'building' && !isMicroPoi) {
      // Buildings & Dungeons (e.g. Taverne, Krypta, Versunkenes Gewölbe): reveal on settlement zoom
      const fadeIn = smoothstep(14, 36, projPx);
      const opacity = Math.round(fadeIn * 1000) / 1000;
      return {
        tier: 2,
        opacity,
        scale: Math.round((0.86 + 0.14 * opacity) * 1000) / 1000,
        visible: opacity > 0.05,
        showText: opacity > 0.2,
      };
    }

    // Rooms & micro-POIs (e.g. Schankraum, Marktplatz, Whisper Road): reveal on close building/town zoom
    const fadeIn = smoothstep(22, 54, projPx);
    const opacity = Math.round(fadeIn * 1000) / 1000;
    return {
      tier: 3,
      opacity,
      scale: Math.round((0.86 + 0.14 * opacity) * 1000) / 1000,
      visible: opacity > 0.05,
      showText: opacity > 0.22,
    };
  }

  const tier = classifyAtlasPinTier(pin, mapScale);

  // If the map has only 1 pin (e.g. Weltkarte's single Kontinent Westmark), or it is Tier 1 / active: always visible!
  if (tier === 1 || isSelected || (opts?.totalPins !== undefined && opts.totalPins <= 1)) {
    return { tier: 1, opacity: 1, scale: 1, visible: true, showText: true, locked: isSelected };
  }

  // Reveal thresholds (span decreases as user zooms in):
  // - Tier 2 fades smoothly from fadeStart → fadeFull
  // - Tier 3 stays hidden at overview, fades smoothly in only at close-up zoom!
  let fadeStart: number;
  let fadeFull: number;
  if (mapScale === 'world') {
    if (tier === 2) {
      fadeStart = 430;
      fadeFull = 290;
    } else {
      fadeStart = 230;
      fadeFull = 145;
    }
  } else if (mapScale === 'settlement') {
    if (tier === 2) {
      fadeStart = 310;
      fadeFull = 215;
    } else {
      fadeStart = 185;
      fadeFull = 128;
    }
  } else {
    if (tier === 2) {
      fadeStart = 340;
      fadeFull = 230;
    } else {
      fadeStart = 210;
      fadeFull = 135;
    }
  }

  // smoothstep inverted: 0 when span >= fadeStart, 1 when span <= fadeFull
  const opacity = 1 - smoothstep(fadeFull, fadeStart, span);
  const visible = opacity > 0.04;
  return {
    tier,
    opacity: Math.round(opacity * 1000) / 1000,
    scale: Math.round((0.86 + 0.14 * opacity) * 1000) / 1000,
    visible,
    showText: opacity > 0.18,
  };
}

/**
 * Pick the thematic transition choreography when moving between Atlas hierarchy levels:
 * - Entering a tavern / house / inn / building → 3D opening carved oak double doors (`tavern-doors`)
 * - Entering a crypt / dungeon / cave / ruin → rising wrought-iron portcullis stone archway (`crypt-gate`)
 * - Stepping out of an interior back to a settlement → warm sunlit outdoor exit (`outdoor-exit`)
 * - Outdoor ↔ Outdoor scale change → smooth Google-Earth atmospheric camera flight (`flight-in` / `flight-out`)
 */
export function classifyAtlasPortalKind(input: {
  readonly direction: 'in' | 'out';
  readonly fromScale: AtlasMapScale;
  readonly targetLabel?: string | null;
  readonly targetKind?: string | null;
  readonly targetSub?: string | null;
}): AtlasPortalTransitionKind {
  const { direction, fromScale } = input;
  if (direction === 'out') {
    return fromScale === 'interior' ? 'outdoor-exit' : 'flight-out';
  }

  const text = `${input.targetLabel ?? ''} ${input.targetKind ?? ''} ${input.targetSub ?? ''}`.toLowerCase();

  if (
    /\b(krypta|crypt|dungeon|höhle|hoehle|cave|ruine|ruin|katakomb|mine|gruft|gewölbe|gewoelbe|keller|cellar|verlies|untergrund)\b/i.test(
      text,
    )
  ) {
    return 'crypt-gate';
  }

  if (
    /\b(taverne|tavern|gasthaus|inn|haus|house|building|gebäude|gebaeude|schmiede|laden|shop|tempel|kirche|turm|tower|burg|keep|halle|raum|room|innenraum|scene|szene|schankraum)\b/i.test(
      text,
    )
  ) {
    return 'tavern-doors';
  }

  return 'flight-in';
}
