/**
 * atlas-dungeon-look — ATL2-F04 dungeon theme materials, instancing budgets, lighting.
 * Location: src/domains/world/atlas/atlas-dungeon-look.ts
 *
 * Pure domain — no React / Host / Three. Themes are atmospheric: they never mint
 * or rewrite canonical feature IDs (IV-01 / IV-02 / IV-18). Productive 3D target
 * remains custom WebGL (R01 NO-GO for Three.js product switch).
 */

import type { AtlasGraphicsPresetId } from './atlas-renderer-target';
import type { DungeonThemeKey } from './dungeon-generator';
import type {
  UnifiedCanvasDoc,
  UnifiedCanvasDoor,
  UnifiedCanvasObject,
  UnifiedCanvasRoom,
  UnifiedCanvasWall,
} from './unified-canvas-doc';

export const ATLAS_DUNGEON_LOOK_FORMAT = 'atl2-dungeon-look-plan-v1' as const;

export const ATLAS_DUNGEON_THEME_KEYS: readonly DungeonThemeKey[] = [
  'ancient',
  'molten',
  'frost',
  'grim',
  'verdant',
] as const;

const DUNGEON_FEATURE_ID_RE = /^(droom-|dwall-|dcorr-|dgrid-|dlamp-|dchest-|ddoor-)/;

export type AtlasDungeonLookAuthority = 'canonical' | 'atmospheric';

export type AtlasDungeonThemePalette = {
  readonly themeKey: DungeonThemeKey;
  readonly labelDe: string;
  readonly floor: string;
  readonly wall: string;
  readonly door: string;
  readonly accent: string;
  readonly light: string;
  readonly fogColor: string;
  readonly clearColor: readonly [number, number, number, number];
};

export type AtlasDungeonLightProfile = {
  readonly themeKey: DungeonThemeKey;
  readonly presetId: AtlasGraphicsPresetId;
  readonly labelDe: string;
  readonly daylightDir: readonly [number, number, number];
  readonly ambient: number;
  readonly fogDensity: number;
  readonly fogColor: string;
  readonly clearColor: readonly [number, number, number, number];
  readonly torchIntensity: number;
  readonly shadowStrength: number;
  readonly bloomEnabled: boolean;
  readonly particlesEnabled: boolean;
};

export type AtlasDungeonQualityBudget = {
  readonly presetId: AtlasGraphicsPresetId;
  readonly maxInstances: number;
  readonly maxTorchInstances: number;
  readonly maxParticleEmitters: number;
  readonly bloomEnabled: boolean;
  readonly particlesEnabled: boolean;
  readonly preferSoftwareFallback: boolean;
};

export type AtlasDungeonInstanceKind = 'wall' | 'door' | 'floor' | 'torch' | 'prop';

export type AtlasDungeonInstanceBatch = {
  readonly batchKey: string;
  readonly kind: AtlasDungeonInstanceKind;
  readonly authority: AtlasDungeonLookAuthority;
  readonly materialId: string;
  readonly albedo: string;
  readonly instanceIds: readonly string[];
};

export type AtlasDungeonLookPlan = {
  readonly format: typeof ATLAS_DUNGEON_LOOK_FORMAT;
  readonly themeKey: DungeonThemeKey;
  readonly palette: AtlasDungeonThemePalette;
  readonly light: AtlasDungeonLightProfile;
  readonly budget: AtlasDungeonQualityBudget;
  readonly batches: readonly AtlasDungeonInstanceBatch[];
  readonly counts: {
    readonly floors: number;
    readonly walls: number;
    readonly doors: number;
    readonly torches: number;
    readonly props: number;
    readonly batches: number;
    readonly instances: number;
    readonly truncated: number;
  };
  /** Theme-independent fingerprint of dungeon feature IDs (geometry SoT). */
  readonly geometryFingerprint: string;
  /** Theme + budget dependent fingerprint (look SoT). */
  readonly lookFingerprint: string;
};

const THEME_PALETTES: Readonly<Record<DungeonThemeKey, AtlasDungeonThemePalette>> = {
  ancient: {
    themeKey: 'ancient',
    labelDe: 'Antik',
    floor: '#777b82',
    wall: '#505963',
    door: '#8a745b',
    accent: '#d4a96b',
    light: '#ffc17b',
    fogColor: '#6a6e78',
    clearColor: [0.08, 0.09, 0.11, 1],
  },
  molten: {
    themeKey: 'molten',
    labelDe: 'Magma',
    floor: '#80655d',
    wall: '#55423e',
    door: '#6b4034',
    accent: '#e2683c',
    light: '#ff9546',
    fogColor: '#5a3830',
    clearColor: [0.12, 0.05, 0.04, 1],
  },
  frost: {
    themeKey: 'frost',
    labelDe: 'Frost',
    floor: '#9cacb9',
    wall: '#71869b',
    door: '#5a7088',
    accent: '#72c8f4',
    light: '#b6ecff',
    fogColor: '#7a92a4',
    clearColor: [0.1, 0.14, 0.18, 1],
  },
  grim: {
    themeKey: 'grim',
    labelDe: 'Düster',
    floor: '#667069',
    wall: '#424b47',
    door: '#3a403c',
    accent: '#8fad68',
    light: '#beef80',
    fogColor: '#3d4540',
    clearColor: [0.05, 0.07, 0.06, 1],
  },
  verdant: {
    themeKey: 'verdant',
    labelDe: 'Grün',
    floor: '#758b70',
    wall: '#495e51',
    door: '#3d5346',
    accent: '#6dcba5',
    light: '#bcff9b',
    fogColor: '#4a6554',
    clearColor: [0.06, 0.1, 0.08, 1],
  },
};

const BUDGETS: Readonly<Record<AtlasGraphicsPresetId, Omit<AtlasDungeonQualityBudget, 'presetId'>>> =
  {
    high: {
      maxInstances: 2048,
      maxTorchInstances: 96,
      maxParticleEmitters: 24,
      bloomEnabled: true,
      particlesEnabled: true,
      preferSoftwareFallback: false,
    },
    balanced: {
      maxInstances: 1024,
      maxTorchInstances: 48,
      maxParticleEmitters: 12,
      bloomEnabled: true,
      particlesEnabled: true,
      preferSoftwareFallback: false,
    },
    lite: {
      maxInstances: 256,
      maxTorchInstances: 12,
      maxParticleEmitters: 0,
      bloomEnabled: false,
      particlesEnabled: false,
      preferSoftwareFallback: true,
    },
  };

export function isAtlasDungeonFeatureId(id: string): boolean {
  return DUNGEON_FEATURE_ID_RE.test(id);
}

export function resolveAtlasDungeonThemeKey(raw: unknown): DungeonThemeKey {
  if (typeof raw === 'string' && (ATLAS_DUNGEON_THEME_KEYS as readonly string[]).includes(raw)) {
    return raw as DungeonThemeKey;
  }
  return 'ancient';
}

export function resolveAtlasDungeonThemePalette(themeKey: DungeonThemeKey): AtlasDungeonThemePalette {
  return THEME_PALETTES[resolveAtlasDungeonThemeKey(themeKey)] ?? THEME_PALETTES.ancient;
}

export function resolveAtlasDungeonQualityBudget(
  presetId: AtlasGraphicsPresetId,
): AtlasDungeonQualityBudget {
  const base = BUDGETS[presetId] ?? BUDGETS.balanced;
  return { presetId: BUDGETS[presetId] ? presetId : 'balanced', ...base };
}

export function resolveAtlasDungeonLightProfile(
  themeKey: DungeonThemeKey,
  presetId: AtlasGraphicsPresetId,
): AtlasDungeonLightProfile {
  const palette = resolveAtlasDungeonThemePalette(themeKey);
  const budget = resolveAtlasDungeonQualityBudget(presetId);
  const ambientByPreset: Record<AtlasGraphicsPresetId, number> = {
    high: 0.22,
    balanced: 0.28,
    lite: 0.4,
  };
  const fogByPreset: Record<AtlasGraphicsPresetId, number> = {
    high: 0.00055,
    balanced: 0.0004,
    lite: 0,
  };
  const torchByPreset: Record<AtlasGraphicsPresetId, number> = {
    high: 1,
    balanced: 0.75,
    lite: 0.45,
  };
  return {
    themeKey: palette.themeKey,
    presetId: budget.presetId,
    labelDe: `${palette.labelDe} — ${budget.presetId}`,
    daylightDir: [-0.35, 1, -0.25],
    ambient: ambientByPreset[budget.presetId],
    fogDensity: fogByPreset[budget.presetId],
    fogColor: palette.fogColor,
    clearColor: palette.clearColor,
    torchIntensity: torchByPreset[budget.presetId],
    shadowStrength: budget.presetId === 'lite' ? 0.15 : budget.presetId === 'high' ? 0.55 : 0.35,
    bloomEnabled: budget.bloomEnabled,
    particlesEnabled: budget.particlesEnabled,
  };
}

function fnv1a(parts: readonly string[]): string {
  let h = 2166136261;
  for (const part of parts) {
    for (let i = 0; i < part.length; i += 1) {
      h ^= part.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x7c;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function dungeonRooms(doc: UnifiedCanvasDoc): readonly UnifiedCanvasRoom[] {
  return doc.rooms.filter((r) => isAtlasDungeonFeatureId(r.id));
}

function dungeonWalls(doc: UnifiedCanvasDoc): readonly UnifiedCanvasWall[] {
  return doc.walls.filter((w) => isAtlasDungeonFeatureId(w.id));
}

function dungeonDoors(doc: UnifiedCanvasDoc): readonly UnifiedCanvasDoor[] {
  return (doc.doors ?? []).filter(
    (d) => isAtlasDungeonFeatureId(d.id) || isAtlasDungeonFeatureId(d.wallId),
  );
}

function dungeonObjects(doc: UnifiedCanvasDoc): readonly UnifiedCanvasObject[] {
  return doc.objects.filter((o) => isAtlasDungeonFeatureId(o.id));
}

function takeIds(
  ids: readonly string[],
  limit: number,
): { readonly kept: readonly string[]; readonly truncated: number } {
  if (ids.length <= limit) return { kept: ids, truncated: 0 };
  return { kept: ids.slice(0, Math.max(0, limit)), truncated: ids.length - limit };
}

/**
 * Build atmospheric dungeon look plan from canonical doc features.
 * Theme/preset never alter the set of geometry IDs in `geometryFingerprint`.
 */
export function buildAtlasDungeonLookPlan(
  doc: UnifiedCanvasDoc,
  options?: {
    readonly themeKey?: DungeonThemeKey | string | null;
    readonly graphicsPresetId?: AtlasGraphicsPresetId;
  },
): AtlasDungeonLookPlan {
  const themeKey = resolveAtlasDungeonThemeKey(options?.themeKey);
  const presetId = options?.graphicsPresetId ?? 'balanced';
  const palette = resolveAtlasDungeonThemePalette(themeKey);
  const budget = resolveAtlasDungeonQualityBudget(presetId);
  const light = resolveAtlasDungeonLightProfile(themeKey, presetId);

  const floors = dungeonRooms(doc);
  const walls = dungeonWalls(doc);
  const doors = dungeonDoors(doc);
  const objects = dungeonObjects(doc);
  const torches = objects.filter((o) => o.type === 'lampe' || o.id.startsWith('dlamp-'));
  const props = objects.filter((o) => !(o.type === 'lampe' || o.id.startsWith('dlamp-')));

  const geometryIds = [
    ...floors.map((r) => r.id),
    ...walls.map((w) => w.id),
    ...doors.map((d) => d.id),
    ...objects.map((o) => o.id),
  ].sort();
  const geometryFingerprint = fnv1a(geometryIds);

  let remaining = budget.maxInstances;
  let truncated = 0;
  const batches: AtlasDungeonInstanceBatch[] = [];

  const pushBatch = (
    kind: AtlasDungeonInstanceKind,
    materialId: string,
    albedo: string,
    ids: readonly string[],
    hardCap?: number,
  ) => {
    const cap = Math.min(remaining, hardCap ?? remaining);
    const taken = takeIds(ids, cap);
    truncated += taken.truncated;
    if (taken.kept.length === 0) return;
    remaining -= taken.kept.length;
    batches.push({
      batchKey: `${kind}:${materialId}:${themeKey}`,
      kind,
      authority: kind === 'torch' || kind === 'prop' ? 'atmospheric' : 'canonical',
      materialId,
      albedo,
      instanceIds: taken.kept,
    });
  };

  pushBatch(
    'floor',
    'dungeon-floor',
    palette.floor,
    floors.map((r) => r.id),
  );
  pushBatch(
    'wall',
    'dungeon-wall',
    palette.wall,
    walls.map((w) => w.id),
  );
  pushBatch(
    'door',
    'dungeon-door',
    palette.door,
    doors.map((d) => d.id),
  );
  pushBatch(
    'torch',
    'dungeon-torch',
    palette.light,
    torches.map((o) => o.id),
    budget.maxTorchInstances,
  );
  pushBatch(
    'prop',
    'dungeon-prop',
    palette.accent,
    props.map((o) => o.id),
  );

  const instanceCount = batches.reduce((n, b) => n + b.instanceIds.length, 0);
  const lookFingerprint = fnv1a([
    themeKey,
    budget.presetId,
    String(budget.maxInstances),
    String(budget.bloomEnabled),
    String(budget.particlesEnabled),
    geometryFingerprint,
    ...batches.map((b) => `${b.batchKey}:${b.instanceIds.length}`),
  ]);

  return {
    format: ATLAS_DUNGEON_LOOK_FORMAT,
    themeKey,
    palette,
    light,
    budget,
    batches,
    counts: {
      floors: floors.length,
      walls: walls.length,
      doors: doors.length,
      torches: torches.length,
      props: props.length,
      batches: batches.length,
      instances: instanceCount,
      truncated,
    },
    geometryFingerprint,
    lookFingerprint,
  };
}

/** Runtime helper: albedo for a dungeon feature id under a look plan. */
export function atlasDungeonFeatureAlbedo(
  plan: AtlasDungeonLookPlan,
  featureId: string,
  kind: AtlasDungeonInstanceKind,
): string | null {
  if (!isAtlasDungeonFeatureId(featureId)) return null;
  const batch = plan.batches.find((b) => b.kind === kind && b.instanceIds.includes(featureId));
  if (batch) return batch.albedo;
  switch (kind) {
    case 'floor':
      return plan.palette.floor;
    case 'wall':
      return plan.palette.wall;
    case 'door':
      return plan.palette.door;
    case 'torch':
      return plan.palette.light;
    case 'prop':
      return plan.palette.accent;
    default:
      return null;
  }
}
