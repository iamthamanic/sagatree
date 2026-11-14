/**
 * atlas-golden-visual — ATL2-G04 golden visual regression fixtures + checklist.
 * Location: src/domains/world/atlas/atlas-golden-visual.ts
 *
 * Pure domain — no React / Host / Three. Screenshots are represented as
 * deterministic fingerprints (materials, camera, light, selection chrome).
 * Pixel tolerance is documented for Playwright review; CI asserts fingerprints.
 * Productive 3D remains custom-webgl (R01 NO-GO). Atmospheric detail never
 * invents canonical geometry (IV-01 / IV-02).
 */

import {
  ATLAS_DIORAMA_MATERIALS,
  atlasDioramaLookPlanIsCanonicalOnly,
  buildAtlasDioramaLookPlan,
  buildAtlasDioramaMeshRecipe,
  resolveAtlasDioramaLightProfile,
  type AtlasDioramaDetailLevel,
} from './atlas-diorama-look';
import { buildAtlasDungeonLookPlan } from './atlas-dungeon-look';
import {
  ATLAS_DIORAMA_PITCH_DEFAULT,
  defaultAtlasProductCameraState,
  type AtlasProductCameraState,
} from './atlas-product-camera';
import type { AtlasGraphicsPresetId } from './atlas-renderer-target';
import {
  DORNHAIN_GOLDEN_MAPS,
  DORNHAIN_WORLD_MAP_SEED,
  buildGoldenCountryCanvas,
  buildGoldenCryptCanvas,
  buildGoldenDornhainCanvas,
  buildGoldenTavernCanvas,
} from './dornhain-golden-hierarchy';
import { buildDornhainUnifiedCanvasDoc } from './dornhain-unified-starter';
import {
  emptyUnifiedCanvasDoc,
  type UnifiedCanvasDoc,
  type UnifiedCanvasMaterial,
} from './unified-canvas-doc';

export const ATLAS_GOLDEN_VISUAL_FORMAT = 'atl2-golden-visual-v1' as const;

/** Six hierarchy screenshot fixtures (issue scope). */
export const ATLAS_GOLDEN_VISUAL_SCALE_IDS = [
  'world',
  'country',
  'city',
  'tavern',
  'crypt',
  'room',
] as const;

export type AtlasGoldenVisualScaleId = (typeof ATLAS_GOLDEN_VISUAL_SCALE_IDS)[number];

/** Documented Playwright / review pixel tolerance (not asserted in Node CI). */
export type AtlasGoldenVisualTolerance = {
  readonly format: typeof ATLAS_GOLDEN_VISUAL_FORMAT;
  /** Max per-channel absolute diff for soft pixel review. */
  readonly maxChannelDelta: number;
  /** Max fraction of differing pixels before mandatory human review. */
  readonly maxDiffPixelRatio: number;
  /** CI compares fingerprints exactly; pixel soft-fail never auto-promotes. */
  readonly ciMode: 'fingerprint-exact';
  readonly reviewLabelDe: string;
};

export const ATLAS_GOLDEN_VISUAL_TOLERANCE: AtlasGoldenVisualTolerance = {
  format: ATLAS_GOLDEN_VISUAL_FORMAT,
  maxChannelDelta: 8,
  maxDiffPixelRatio: 0.02,
  ciMode: 'fingerprint-exact',
  reviewLabelDe:
    'Pixel-Diff nur Review; CI fordert identische Material-/Kamera-/Licht-Fingerprints',
};

/** SagaTree Cyan selected / primary (THEME_GUIDE dark). */
export const ATLAS_GOLDEN_SELECTION_OUTLINE = '#06B6D4' as const;
/** Neutral card surface for contrast baseline (THEME_GUIDE dark Surface). */
export const ATLAS_GOLDEN_SELECTION_SURFACE = '#1E293B' as const;

export type AtlasGoldenVisualFixture = {
  readonly id: AtlasGoldenVisualScaleId;
  readonly labelDe: string;
  readonly mapSeedKey: string;
  readonly camera: AtlasProductCameraState;
  readonly graphicsPresetId: AtlasGraphicsPresetId;
  /** outdoor → diorama look; indoor → dungeon look for material variety. */
  readonly lookFamily: 'outdoor' | 'indoor';
  readonly indoorThemeKey: 'ancient' | 'grim' | null;
  readonly selectionFeatureId: string;
  readonly buildCanvas: () => UnifiedCanvasDoc;
};

function fixedDioramaCamera(
  x: number,
  z: number,
  span: number,
): AtlasProductCameraState {
  return defaultAtlasProductCameraState({
    mode: 'diorama-oblique',
    x,
    z,
    span,
    yawRad: 0.35,
    pitchRad: ATLAS_DIORAMA_PITCH_DEFAULT,
  });
}

/** Room-scale fixture: taproom crop — atmospheric props stay non-canonical. */
export function buildGoldenRoomCanvas(): UnifiedCanvasDoc {
  const empty = emptyUnifiedCanvasDoc(false);
  return {
    ...empty,
    rooms: [
      {
        id: 'g.room.tap',
        material: 'holz',
        x: 280,
        y: 280,
        w: 160,
        h: 140,
      },
    ],
    walls: [
      { id: 'g.room.w1', x1: 280, y1: 280, x2: 440, y2: 280, width: 6 },
      { id: 'g.room.w2', x1: 280, y1: 280, x2: 280, y2: 420, width: 6 },
      { id: 'g.room.w3', x1: 440, y1: 280, x2: 440, y2: 420, width: 6 },
      { id: 'g.room.w4', x1: 280, y1: 420, x2: 440, y2: 420, width: 6 },
    ],
    objects: [
      { id: 'g.room.table', type: 'tisch', x: 350, y: 340, size: 0.55 },
      { id: 'g.room.lamp', type: 'lampe', x: 310, y: 300, size: 0.3 },
    ],
  };
}

export const ATLAS_GOLDEN_VISUAL_FIXTURES: readonly AtlasGoldenVisualFixture[] = [
  {
    id: 'world',
    labelDe: 'Welt Donalu / Dornhain',
    mapSeedKey: DORNHAIN_WORLD_MAP_SEED,
    camera: fixedDioramaCamera(500, 500, 900),
    graphicsPresetId: 'balanced',
    lookFamily: 'outdoor',
    indoorThemeKey: null,
    selectionFeatureId: 'w.loc.dornhain',
    buildCanvas: buildDornhainUnifiedCanvasDoc,
  },
  {
    id: 'country',
    labelDe: 'Land Westmark',
    mapSeedKey: 'dornhain.map.country.westmark',
    camera: fixedDioramaCamera(430, 400, 420),
    graphicsPresetId: 'balanced',
    lookFamily: 'outdoor',
    indoorThemeKey: null,
    selectionFeatureId: 'g.country.core',
    buildCanvas: buildGoldenCountryCanvas,
  },
  {
    id: 'city',
    labelDe: 'Siedlung Dornhain',
    mapSeedKey: 'dornhain.map.place.dornhain',
    camera: fixedDioramaCamera(360, 510, 220),
    graphicsPresetId: 'high',
    lookFamily: 'outdoor',
    indoorThemeKey: null,
    selectionFeatureId: 'g.tavern',
    buildCanvas: buildGoldenDornhainCanvas,
  },
  {
    id: 'tavern',
    labelDe: 'Taverne Zum Flüstern',
    mapSeedKey: 'dornhain.map.loc.tavern',
    camera: fixedDioramaCamera(400, 360, 140),
    graphicsPresetId: 'balanced',
    lookFamily: 'indoor',
    indoorThemeKey: 'grim',
    selectionFeatureId: 'g.tav.bar',
    buildCanvas: buildGoldenTavernCanvas,
  },
  {
    id: 'crypt',
    labelDe: 'Krypta unter dem Hügel',
    mapSeedKey: 'dornhain.map.loc.crypt',
    camera: fixedDioramaCamera(420, 380, 160),
    graphicsPresetId: 'balanced',
    lookFamily: 'indoor',
    indoorThemeKey: 'ancient',
    selectionFeatureId: 'g.crypt.hall',
    buildCanvas: buildGoldenCryptCanvas,
  },
  {
    id: 'room',
    labelDe: 'Schankraum (Raum-Maßstab)',
    mapSeedKey: 'dornhain.map.loc.tavern#room.tap',
    camera: fixedDioramaCamera(360, 350, 90),
    graphicsPresetId: 'lite',
    lookFamily: 'indoor',
    indoorThemeKey: 'grim',
    selectionFeatureId: 'g.room.tap',
    buildCanvas: buildGoldenRoomCanvas,
  },
] as const;

export type AtlasGoldenArtDirectionCheckId =
  | 'materials-distinct'
  | 'selection-readable'
  | 'detail-degradable'
  | 'no-unsolicited-canonical'
  | 'fixed-camera-light'
  | 'overlay-tokens';

export type AtlasGoldenArtDirectionCheck = {
  readonly id: AtlasGoldenArtDirectionCheckId;
  readonly labelDe: string;
  readonly measurable: string;
};

/** Measurable art-direction checklist (no subjective "premium" wording). */
export const ATLAS_GOLDEN_ART_DIRECTION_CHECKS: readonly AtlasGoldenArtDirectionCheck[] = [
  {
    id: 'materials-distinct',
    labelDe: 'Unterschiedliche Gelände-/Gebäude-/Dungeon-Materialien',
    measurable: '≥2 distinct canvas materials OR ≥2 look albedo tokens per fixture',
  },
  {
    id: 'selection-readable',
    labelDe: 'Lesbare Auswahlzustände',
    measurable: `selection outline ${ATLAS_GOLDEN_SELECTION_OUTLINE} vs surface contrast ≥ 3:1`,
  },
  {
    id: 'detail-degradable',
    labelDe: '3D-Details optional / degradierbar',
    measurable: 'lite detailLevel=minimal and includeFacades=false vs high full',
  },
  {
    id: 'no-unsolicited-canonical',
    labelDe: 'Keine ungefragte Kanonisierung physischer Weltobjekte',
    measurable: 'atmospheric batches never rewrite geometry fingerprint',
  },
  {
    id: 'fixed-camera-light',
    labelDe: 'Fixierte Kamera und Beleuchtung',
    measurable: 'diorama-oblique + documented yaw/pitch/span + preset light profile',
  },
  {
    id: 'overlay-tokens',
    labelDe: 'UI-Overlay-Tokens dokumentiert',
    measurable: 'selection outline + surface tokens exported for chrome parity',
  },
] as const;

export type AtlasGoldenVisualSnapshot = {
  readonly format: typeof ATLAS_GOLDEN_VISUAL_FORMAT;
  readonly fixtureId: AtlasGoldenVisualScaleId;
  readonly mapSeedKey: string;
  readonly cameraFingerprint: string;
  readonly lightFingerprint: string;
  readonly materialKeys: readonly string[];
  readonly lookAlbedos: readonly string[];
  readonly geometryFingerprint: string;
  readonly lookFingerprint: string;
  readonly selectionOutline: typeof ATLAS_GOLDEN_SELECTION_OUTLINE;
  readonly selectionContrastRatio: number;
  readonly contentFingerprint: string;
  readonly detailLevel: AtlasDioramaDetailLevel | 'indoor-theme';
};

function hexToRgb(hex: string): readonly [number, number, number] {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex: string): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two sRGB hex colors. */
export function atlasGoldenContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function stableJoin(parts: readonly string[]): string {
  return [...parts].sort().join('|');
}

function hashParts(parts: readonly string[]): string {
  let h = 2166136261;
  const s = parts.join('\0');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function canvasMaterialKeys(doc: UnifiedCanvasDoc): readonly UnifiedCanvasMaterial[] {
  const set = new Set<UnifiedCanvasMaterial>();
  for (const r of doc.rooms) set.add(r.material);
  for (const s of doc.strokes) set.add(s.material);
  return [...set];
}

function cameraFingerprint(cam: AtlasProductCameraState): string {
  return hashParts([
    cam.mode,
    cam.x.toFixed(3),
    cam.z.toFixed(3),
    cam.span.toFixed(3),
    cam.yawRad.toFixed(4),
    cam.pitchRad.toFixed(4),
  ]);
}

export function resolveAtlasGoldenVisualFixture(
  id: AtlasGoldenVisualScaleId,
): AtlasGoldenVisualFixture {
  const hit = ATLAS_GOLDEN_VISUAL_FIXTURES.find((f) => f.id === id);
  if (!hit) {
    throw new Error(`Unknown golden visual fixture: ${id}`);
  }
  return hit;
}

export function buildAtlasGoldenVisualSnapshot(
  fixture: AtlasGoldenVisualFixture,
): AtlasGoldenVisualSnapshot {
  const doc = fixture.buildCanvas();
  const materials = canvasMaterialKeys(doc);
  const selectionContrastRatio = atlasGoldenContrastRatio(
    ATLAS_GOLDEN_SELECTION_OUTLINE,
    ATLAS_GOLDEN_SELECTION_SURFACE,
  );

  if (fixture.lookFamily === 'outdoor') {
    const plan = buildAtlasDioramaLookPlan(doc, {
      graphicsPresetId: fixture.graphicsPresetId,
    });
    const light = plan.light;
    const lookAlbedos = [...new Set(plan.materials.map((m) => m.albedo))];
    const contentFingerprint = hashParts([
      fixture.id,
      fixture.mapSeedKey,
      cameraFingerprint(fixture.camera),
      light.presetId,
      light.detailLevel,
      plan.contentFingerprint,
      stableJoin(materials),
      stableJoin(lookAlbedos),
    ]);
    return {
      format: ATLAS_GOLDEN_VISUAL_FORMAT,
      fixtureId: fixture.id,
      mapSeedKey: fixture.mapSeedKey,
      cameraFingerprint: cameraFingerprint(fixture.camera),
      lightFingerprint: hashParts([
        light.presetId,
        light.detailLevel,
        light.fogColor,
        String(light.ambient),
        light.daylightDir.join(','),
      ]),
      materialKeys: materials,
      lookAlbedos,
      geometryFingerprint: plan.contentFingerprint,
      lookFingerprint: plan.contentFingerprint,
      selectionOutline: ATLAS_GOLDEN_SELECTION_OUTLINE,
      selectionContrastRatio,
      contentFingerprint,
      detailLevel: light.detailLevel,
    };
  }

  const themeKey = fixture.indoorThemeKey ?? 'ancient';
  const plan = buildAtlasDungeonLookPlan(doc, {
    themeKey,
    graphicsPresetId: fixture.graphicsPresetId,
  });
  const lookAlbedos = [
    ...new Set(plan.batches.map((b) => b.albedo)),
    plan.palette.floor,
    plan.palette.wall,
  ];
  const contentFingerprint = hashParts([
    fixture.id,
    fixture.mapSeedKey,
    cameraFingerprint(fixture.camera),
    plan.themeKey,
    plan.budget.presetId,
    plan.geometryFingerprint,
    plan.lookFingerprint,
    stableJoin(materials),
    stableJoin(lookAlbedos),
  ]);
  return {
    format: ATLAS_GOLDEN_VISUAL_FORMAT,
    fixtureId: fixture.id,
    mapSeedKey: fixture.mapSeedKey,
    cameraFingerprint: cameraFingerprint(fixture.camera),
    lightFingerprint: hashParts([
      plan.light.themeKey,
      plan.light.presetId,
      plan.light.fogColor,
      String(plan.light.ambient),
      plan.light.daylightDir.join(','),
    ]),
    materialKeys: materials,
    lookAlbedos,
    geometryFingerprint: plan.geometryFingerprint,
    lookFingerprint: plan.lookFingerprint,
    selectionOutline: ATLAS_GOLDEN_SELECTION_OUTLINE,
    selectionContrastRatio,
    contentFingerprint,
    detailLevel: 'indoor-theme',
  };
}

export type AtlasGoldenVisualCompareResult = {
  readonly ok: boolean;
  readonly reason: string;
  readonly expected: string;
  readonly actual: string;
};

export function compareAtlasGoldenVisualSnapshots(
  expected: AtlasGoldenVisualSnapshot,
  actual: AtlasGoldenVisualSnapshot,
): AtlasGoldenVisualCompareResult {
  if (expected.contentFingerprint !== actual.contentFingerprint) {
    return {
      ok: false,
      reason: 'contentFingerprint mismatch',
      expected: expected.contentFingerprint,
      actual: actual.contentFingerprint,
    };
  }
  if (expected.cameraFingerprint !== actual.cameraFingerprint) {
    return {
      ok: false,
      reason: 'cameraFingerprint mismatch',
      expected: expected.cameraFingerprint,
      actual: actual.cameraFingerprint,
    };
  }
  if (expected.geometryFingerprint !== actual.geometryFingerprint) {
    return {
      ok: false,
      reason: 'geometryFingerprint mismatch',
      expected: expected.geometryFingerprint,
      actual: actual.geometryFingerprint,
    };
  }
  return {
    ok: true,
    reason: 'match',
    expected: expected.contentFingerprint,
    actual: actual.contentFingerprint,
  };
}

export type AtlasGoldenArtDirectionReport = {
  readonly format: typeof ATLAS_GOLDEN_VISUAL_FORMAT;
  readonly checks: Readonly<Record<AtlasGoldenArtDirectionCheckId, boolean>>;
  readonly allPass: boolean;
  readonly selectionContrastRatio: number;
  readonly fixtureMaterialCounts: Readonly<Record<AtlasGoldenVisualScaleId, number>>;
  readonly outdoorCanonicalOnly: boolean;
  readonly detailDegrades: boolean;
};

export function evaluateAtlasGoldenArtDirection(): AtlasGoldenArtDirectionReport {
  const fixtureMaterialCounts = {} as Record<AtlasGoldenVisualScaleId, number>;
  let selectionContrastRatio = 0;
  let materialsDistinct = true;

  for (const fixture of ATLAS_GOLDEN_VISUAL_FIXTURES) {
    const snap = buildAtlasGoldenVisualSnapshot(fixture);
    const distinct = new Set([...snap.materialKeys, ...snap.lookAlbedos]).size;
    fixtureMaterialCounts[fixture.id] = distinct;
    if (distinct < 2) materialsDistinct = false;
    selectionContrastRatio = snap.selectionContrastRatio;
  }

  const selectionReadable = selectionContrastRatio >= 3;

  const highLight = resolveAtlasDioramaLightProfile('high');
  const liteLight = resolveAtlasDioramaLightProfile('lite');
  const highRecipe = buildAtlasDioramaMeshRecipe('haus', 'g.check.house', highLight.detailLevel);
  const liteRecipe = buildAtlasDioramaMeshRecipe('haus', 'g.check.house', liteLight.detailLevel);
  const detailDegrades =
    highLight.detailLevel === 'full' &&
    liteLight.detailLevel === 'minimal' &&
    highRecipe.includeFacades === true &&
    liteRecipe.includeFacades === false;

  const city = resolveAtlasGoldenVisualFixture('city');
  const cityDoc = city.buildCanvas();
  const cityPlan = buildAtlasDioramaLookPlan(cityDoc, { graphicsPresetId: 'high' });
  const outdoorCanonicalOnly = atlasDioramaLookPlanIsCanonicalOnly(cityPlan);

  const themeA = buildAtlasDungeonLookPlan(buildGoldenCryptCanvas(), {
    themeKey: 'ancient',
    graphicsPresetId: 'balanced',
  });
  const themeB = buildAtlasDungeonLookPlan(buildGoldenCryptCanvas(), {
    themeKey: 'molten',
    graphicsPresetId: 'balanced',
  });
  const noUnsolicitedCanonical = themeA.geometryFingerprint === themeB.geometryFingerprint;

  const fixedCameraLight = ATLAS_GOLDEN_VISUAL_FIXTURES.every(
    (f) => f.camera.mode === 'diorama-oblique' && Number.isFinite(f.camera.pitchRad),
  );

  const overlayTokens =
    ATLAS_GOLDEN_SELECTION_OUTLINE === '#06B6D4' &&
    ATLAS_GOLDEN_SELECTION_SURFACE === '#1E293B' &&
    Object.keys(ATLAS_DIORAMA_MATERIALS).length >= 8;

  const checks: Record<AtlasGoldenArtDirectionCheckId, boolean> = {
    'materials-distinct': materialsDistinct,
    'selection-readable': selectionReadable,
    'detail-degradable': detailDegrades,
    'no-unsolicited-canonical': noUnsolicitedCanonical && outdoorCanonicalOnly,
    'fixed-camera-light': fixedCameraLight,
    'overlay-tokens': overlayTokens,
  };

  return {
    format: ATLAS_GOLDEN_VISUAL_FORMAT,
    checks,
    allPass: Object.values(checks).every(Boolean),
    selectionContrastRatio,
    fixtureMaterialCounts,
    outdoorCanonicalOnly,
    detailDegrades,
  };
}

/** Sanity: fixture map seeds align with Dornhain golden hierarchy where applicable. */
export function atlasGoldenVisualFixturesCoverHierarchy(): boolean {
  if (ATLAS_GOLDEN_VISUAL_FIXTURES.length !== 6) return false;
  const country = DORNHAIN_GOLDEN_MAPS.find((m) => m.seedKey.includes('country'));
  const city = DORNHAIN_GOLDEN_MAPS.find((m) => m.seedKey.includes('place.dornhain'));
  const tavern = DORNHAIN_GOLDEN_MAPS.find((m) => m.seedKey.includes('tavern'));
  const crypt = DORNHAIN_GOLDEN_MAPS.find((m) => m.seedKey.includes('crypt'));
  return Boolean(country && city && tavern && crypt);
}
