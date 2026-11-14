/**
 * atlas-golden-visual — ATL2-G04 golden visual regression fixtures + checklist.
 * Location: src/domains/world/atlas/atlas-golden-visual.ts
 *
 * Pure domain — no React / Host / Three. Content fingerprints pin materials,
 * camera, light, and selection chrome. Browser E2E must still capture real
 * Custom-WebGL screenshots and pixel-diff them (never auto-PASS on fingerprints
 * alone). Productive 3D remains custom-webgl (R01 NO-GO). Atmospheric detail
 * never invents canonical geometry (IV-01 / IV-02).
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

/**
 * Documented Playwright pixel tolerance + dual CI modes.
 * Fingerprints alone never satisfy G04 — Browser E2E must pixel-diff.
 */
export type AtlasGoldenVisualTolerance = {
  readonly format: typeof ATLAS_GOLDEN_VISUAL_FORMAT;
  /** Max per-channel absolute diff for soft pixel review. */
  readonly maxChannelDelta: number;
  /** Max fraction of differing pixels before fail (Playwright toHaveScreenshot). */
  readonly maxDiffPixelRatio: number;
  /**
   * Node/test-gate: fingerprint-exact.
   * Browser E2E: pixel-diff against committed PNG baselines (fail if missing).
   */
  readonly ciMode: 'fingerprint-and-screenshot';
  readonly reviewLabelDe: string;
};

export const ATLAS_GOLDEN_VISUAL_TOLERANCE: AtlasGoldenVisualTolerance = {
  format: ATLAS_GOLDEN_VISUAL_FORMAT,
  maxChannelDelta: 8,
  maxDiffPixelRatio: 0.02,
  ciMode: 'fingerprint-and-screenshot',
  reviewLabelDe:
    'CI: Fingerprints exakt + Playwright Pixel-Diff (maxDiffPixelRatio 0.02); fehlende Baseline = FAIL',
};

/** Fixed capture viewports — Desktop all fixtures; Mobile at least one relevant. */
export const ATLAS_GOLDEN_VISUAL_VIEWPORTS = [
  { id: 'desktop', width: 1280, height: 800 },
  { id: 'mobile', width: 390, height: 844 },
] as const;

export type AtlasGoldenVisualViewportId =
  (typeof ATLAS_GOLDEN_VISUAL_VIEWPORTS)[number]['id'];

/** Fixtures that must run on mobile in addition to full desktop matrix. */
export const ATLAS_GOLDEN_VISUAL_MOBILE_FIXTURE_IDS = [
  'world',
  'tavern',
] as const satisfies readonly AtlasGoldenVisualScaleId[];

/** SagaTree Cyan selected / primary (THEME_GUIDE dark). */
export const ATLAS_GOLDEN_SELECTION_OUTLINE = '#06B6D4' as const;
/** Neutral card surface for contrast baseline (THEME_GUIDE dark Surface). */
export const ATLAS_GOLDEN_SELECTION_SURFACE = '#1E293B' as const;

export type AtlasGoldenVisualFixture = {
  readonly id: AtlasGoldenVisualScaleId;
  readonly labelDe: string;
  /** Product nav / atlas map title used to open the scene in Browser E2E. */
  readonly uiMapTitleDe: string;
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
    uiMapTitleDe: 'Welt',
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
    uiMapTitleDe: 'Land Westmark',
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
    uiMapTitleDe: 'Dornhain',
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
    uiMapTitleDe: 'Taverne Zum Flüstern',
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
    uiMapTitleDe: 'Krypta unter dem Hügel',
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
    /** Room scale reuses tavern product map; camera span is fixed to room. */
    uiMapTitleDe: 'Taverne Zum Flüstern',
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
    measurable:
      'per fixture: ≥2 distinct canvas materials OR (≥2 look albedo tokens) — counted separately, not as a mixed union',
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

/**
 * Spatial geometry fingerprint — includes coordinates / extents so moving an
 * object, stroke, room, wall, or door changes the golden hash even when IDs
 * and materials stay the same (Codex P1 #1232).
 */
export function atlasGoldenSpatialGeometryFingerprint(doc: UnifiedCanvasDoc): string {
  const parts: string[] = [];
  for (const r of [...doc.rooms].sort((a, b) => a.id.localeCompare(b.id))) {
    const poly =
      Array.isArray(r.points) && r.points.length > 0
        ? r.points.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(';')
        : '';
    parts.push(
      `room:${r.id}:${r.material}:${r.x.toFixed(3)}:${r.y.toFixed(3)}:${r.w.toFixed(3)}:${r.h.toFixed(3)}:${poly}`,
    );
  }
  for (const s of [...doc.strokes].sort((a, b) => a.id.localeCompare(b.id))) {
    const pts = s.points.map((p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(';');
    parts.push(`stroke:${s.id}:${s.material}:${s.width.toFixed(3)}:${pts}`);
  }
  for (const o of [...doc.objects].sort((a, b) => a.id.localeCompare(b.id))) {
    parts.push(
      `obj:${o.id}:${o.type}:${o.x.toFixed(3)}:${o.y.toFixed(3)}:${o.size.toFixed(3)}`,
    );
  }
  for (const w of [...doc.walls].sort((a, b) => a.id.localeCompare(b.id))) {
    parts.push(
      `wall:${w.id}:${w.x1.toFixed(3)}:${w.y1.toFixed(3)}:${w.x2.toFixed(3)}:${w.y2.toFixed(3)}:${w.width.toFixed(3)}`,
    );
  }
  for (const d of [...(doc.doors ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
    parts.push(
      `door:${d.id}:${d.wallId}:${d.t.toFixed(4)}:${d.width.toFixed(3)}`,
    );
  }
  return hashParts(parts);
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

  const spatialGeometry = atlasGoldenSpatialGeometryFingerprint(doc);

  if (fixture.lookFamily === 'outdoor') {
    const plan = buildAtlasDioramaLookPlan(doc, {
      graphicsPresetId: fixture.graphicsPresetId,
    });
    const light = plan.light;
    const lookAlbedos = [...new Set(plan.materials.map((m) => m.albedo))];
    const lightFingerprint = hashParts([
      light.presetId,
      light.detailLevel,
      light.fogColor,
      String(light.ambient),
      light.daylightDir.join(','),
    ]);
    const lookFingerprint = hashParts([plan.contentFingerprint, spatialGeometry]);
    const geometryFingerprint = hashParts([spatialGeometry, plan.contentFingerprint]);
    const camFp = cameraFingerprint(fixture.camera);
    const contentFingerprint = hashParts([
      fixture.id,
      fixture.mapSeedKey,
      camFp,
      lightFingerprint,
      lookFingerprint,
      geometryFingerprint,
      stableJoin(materials),
      stableJoin(lookAlbedos),
      ATLAS_GOLDEN_SELECTION_OUTLINE,
      selectionContrastRatio.toFixed(4),
    ]);
    return {
      format: ATLAS_GOLDEN_VISUAL_FORMAT,
      fixtureId: fixture.id,
      mapSeedKey: fixture.mapSeedKey,
      cameraFingerprint: camFp,
      lightFingerprint,
      materialKeys: materials,
      lookAlbedos,
      geometryFingerprint,
      lookFingerprint,
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
    ...new Set([
      ...plan.batches.map((b) => b.albedo),
      plan.palette.floor,
      plan.palette.wall,
      plan.palette.door,
      plan.palette.accent,
    ]),
  ];
  const lightFingerprint = hashParts([
    plan.light.themeKey,
    plan.light.presetId,
    plan.light.fogColor,
    String(plan.light.ambient),
    plan.light.daylightDir.join(','),
  ]);
  const geometryFingerprint = hashParts([
    spatialGeometry,
    plan.geometryFingerprint,
  ]);
  const lookFingerprint = hashParts([plan.lookFingerprint, spatialGeometry]);
  const camFp = cameraFingerprint(fixture.camera);
  const contentFingerprint = hashParts([
    fixture.id,
    fixture.mapSeedKey,
    camFp,
    lightFingerprint,
    lookFingerprint,
    geometryFingerprint,
    plan.themeKey,
    plan.budget.presetId,
    stableJoin(materials),
    stableJoin(lookAlbedos),
    ATLAS_GOLDEN_SELECTION_OUTLINE,
    selectionContrastRatio.toFixed(4),
  ]);
  return {
    format: ATLAS_GOLDEN_VISUAL_FORMAT,
    fixtureId: fixture.id,
    mapSeedKey: fixture.mapSeedKey,
    cameraFingerprint: camFp,
    lightFingerprint,
    materialKeys: materials,
    lookAlbedos,
    geometryFingerprint,
    lookFingerprint,
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
  const fields: readonly (keyof AtlasGoldenVisualSnapshot)[] = [
    'format',
    'fixtureId',
    'mapSeedKey',
    'cameraFingerprint',
    'lightFingerprint',
    'geometryFingerprint',
    'lookFingerprint',
    'selectionOutline',
    'contentFingerprint',
    'detailLevel',
  ];
  for (const field of fields) {
    const e = String(expected[field]);
    const a = String(actual[field]);
    if (e !== a) {
      return { ok: false, reason: `${field} mismatch`, expected: e, actual: a };
    }
  }
  if (
    Math.abs(expected.selectionContrastRatio - actual.selectionContrastRatio) > 1e-6
  ) {
    return {
      ok: false,
      reason: 'selectionContrastRatio mismatch',
      expected: String(expected.selectionContrastRatio),
      actual: String(actual.selectionContrastRatio),
    };
  }
  if (stableJoin(expected.materialKeys) !== stableJoin(actual.materialKeys)) {
    return {
      ok: false,
      reason: 'materialKeys mismatch',
      expected: stableJoin(expected.materialKeys),
      actual: stableJoin(actual.materialKeys),
    };
  }
  if (stableJoin(expected.lookAlbedos) !== stableJoin(actual.lookAlbedos)) {
    return {
      ok: false,
      reason: 'lookAlbedos mismatch',
      expected: stableJoin(expected.lookAlbedos),
      actual: stableJoin(actual.lookAlbedos),
    };
  }
  return {
    ok: true,
    reason: 'match',
    expected: expected.contentFingerprint,
    actual: actual.contentFingerprint,
  };
}

/** Committed cross-commit golden baseline (fingerprint-exact CI). */
export type AtlasGoldenVisualBaseline = {
  readonly fixtureId: AtlasGoldenVisualScaleId;
  readonly contentFingerprint: string;
  readonly cameraFingerprint: string;
  readonly lightFingerprint: string;
  readonly geometryFingerprint: string;
  readonly lookFingerprint: string;
  readonly selectionOutline: typeof ATLAS_GOLDEN_SELECTION_OUTLINE;
  readonly selectionContrastRatio: number;
  readonly materialKeys: readonly string[];
  readonly lookAlbedos: readonly string[];
  readonly detailLevel: AtlasDioramaDetailLevel | 'indoor-theme';
};

/**
 * Regenerated when fixtures / look contracts intentionally change.
 * Self-test compares live snapshots to this table (not same-run twin captures).
 */
export const ATLAS_GOLDEN_VISUAL_BASELINES: readonly AtlasGoldenVisualBaseline[] = [
  {
    fixtureId: 'world',
    contentFingerprint: '2a6c7829',
    cameraFingerprint: '5a8a75ad',
    lightFingerprint: 'abb4f920',
    geometryFingerprint: 'cafdac1f',
    lookFingerprint: '59e9b5d9',
    selectionOutline: '#06B6D4',
    selectionContrastRatio: 6.025371305386859,
    materialKeys: ['erde', 'gras', 'holz', 'pflaster', 'sand', 'stein', 'wasser'],
    lookAlbedos: [
      '#2a3a48',
      '#376456',
      '#493f3a',
      '#5a6b4a',
      '#66584a',
      '#6a9a62',
      '#6f4f45',
      '#794c3c',
      '#7a6548',
      '#82928a',
      '#9a9180',
      '#adb2a4',
      '#ae774c',
      '#cfc6b4',
      '#d7c6a5',
    ],
    detailLevel: 'reduced',
  },
  {
    fixtureId: 'country',
    contentFingerprint: '04896ab7',
    cameraFingerprint: '172fbc93',
    lightFingerprint: 'abb4f920',
    geometryFingerprint: '9d877e76',
    lookFingerprint: 'fbf314cc',
    selectionOutline: '#06B6D4',
    selectionContrastRatio: 6.025371305386859,
    materialKeys: ['gras', 'pflaster', 'wasser'],
    lookAlbedos: ['#2a3a48', '#493f3a', '#6f4f45', '#82928a', '#9a9180', '#adb2a4'],
    detailLevel: 'reduced',
  },
  {
    fixtureId: 'city',
    contentFingerprint: '4591075b',
    cameraFingerprint: '3dadb73b',
    lightFingerprint: 'f63a4b91',
    geometryFingerprint: 'b7bf318d',
    lookFingerprint: '3b44bf05',
    selectionOutline: '#06B6D4',
    selectionContrastRatio: 6.025371305386859,
    materialKeys: ['holz', 'pflaster', 'stein', 'wasser'],
    lookAlbedos: [
      '#2a3a48',
      '#376456',
      '#493f3a',
      '#527b55',
      '#5a6b4a',
      '#66584a',
      '#6a9a62',
      '#6f4f45',
      '#82928a',
      '#9a9180',
      '#adb2a4',
      '#ae774c',
      '#cfc6b4',
    ],
    detailLevel: 'full',
  },
  {
    fixtureId: 'tavern',
    contentFingerprint: '3fc09e5a',
    cameraFingerprint: '23f272a6',
    lightFingerprint: '9a386073',
    geometryFingerprint: 'b4ec7bde',
    lookFingerprint: 'fc8da4a4',
    selectionOutline: '#06B6D4',
    selectionContrastRatio: 6.025371305386859,
    materialKeys: ['holz', 'stein'],
    lookAlbedos: ['#3a403c', '#424b47', '#667069', '#8fad68'],
    detailLevel: 'indoor-theme',
  },
  {
    fixtureId: 'crypt',
    contentFingerprint: '31bd7680',
    cameraFingerprint: 'f5d89624',
    lightFingerprint: '522e872b',
    geometryFingerprint: '72aff879',
    lookFingerprint: '90c20a94',
    selectionOutline: '#06B6D4',
    selectionContrastRatio: 6.025371305386859,
    materialKeys: ['erde', 'stein'],
    lookAlbedos: ['#505963', '#777b82', '#8a745b', '#d4a96b'],
    detailLevel: 'indoor-theme',
  },
  {
    fixtureId: 'room',
    contentFingerprint: 'd9f36dad',
    cameraFingerprint: '7c4a89e6',
    lightFingerprint: '479333c7',
    geometryFingerprint: 'b7858c00',
    lookFingerprint: '4aa371fa',
    selectionOutline: '#06B6D4',
    selectionContrastRatio: 6.025371305386859,
    materialKeys: ['holz'],
    lookAlbedos: ['#3a403c', '#424b47', '#667069', '#8fad68'],
    detailLevel: 'indoor-theme',
  },
];

export function resolveAtlasGoldenVisualBaseline(
  id: AtlasGoldenVisualScaleId,
): AtlasGoldenVisualBaseline | null {
  return ATLAS_GOLDEN_VISUAL_BASELINES.find((b) => b.fixtureId === id) ?? null;
}

export function snapshotMatchesGoldenBaseline(
  snap: AtlasGoldenVisualSnapshot,
  baseline: AtlasGoldenVisualBaseline,
): AtlasGoldenVisualCompareResult {
  return compareAtlasGoldenVisualSnapshots(
    {
      format: ATLAS_GOLDEN_VISUAL_FORMAT,
      fixtureId: baseline.fixtureId,
      mapSeedKey: snap.mapSeedKey,
      cameraFingerprint: baseline.cameraFingerprint,
      lightFingerprint: baseline.lightFingerprint,
      materialKeys: baseline.materialKeys,
      lookAlbedos: baseline.lookAlbedos,
      geometryFingerprint: baseline.geometryFingerprint,
      lookFingerprint: baseline.lookFingerprint,
      selectionOutline: baseline.selectionOutline,
      selectionContrastRatio: baseline.selectionContrastRatio,
      contentFingerprint: baseline.contentFingerprint,
      detailLevel: baseline.detailLevel,
    },
    snap,
  );
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
    const canvasDistinct = new Set(snap.materialKeys).size;
    const albedoDistinct = new Set(snap.lookAlbedos).size;
    /* Counted separately — do not mix material names with albedo hex strings. */
    fixtureMaterialCounts[fixture.id] = Math.max(canvasDistinct, albedoDistinct);
    if (canvasDistinct < 2 && albedoDistinct < 2) materialsDistinct = false;
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
