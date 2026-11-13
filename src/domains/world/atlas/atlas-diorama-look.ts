/**
 * atlas-diorama-look — ATL2-D06 fantasy diorama materials, mesh recipes, light.
 * Location: src/domains/world/atlas/atlas-diorama-look.ts
 *
 * Pure domain — no React / Host. Visualizes existing UnifiedCanvasDoc stamps
 * and paths only; does not invent canonical geography (IV-01 / IV-02).
 */

import type { AtlasGraphicsPresetId } from './atlas-renderer-target';
import type { UnifiedCanvasDoc, UnifiedCanvasObject } from './unified-canvas-doc';

export const ATLAS_DIORAMA_LOOK_FORMAT = 'atl2-diorama-look-plan-v1' as const;

/** Imagination-first authority for a look primitive. */
export type AtlasDioramaLookAuthority = 'canonical' | 'suggestive' | 'atmospheric';

export type AtlasDioramaMaterialToken = {
  readonly id: string;
  readonly albedo: string;
  /** 0 = glossy / metal-ish, 1 = matte (PBR-like roughness token). */
  readonly roughness: number;
  readonly metalness: number;
};

export type AtlasDioramaDetailLevel = 'full' | 'reduced' | 'minimal';

export type AtlasDioramaLightProfile = {
  readonly presetId: AtlasGraphicsPresetId;
  readonly labelDe: string;
  /** Directional daylight (world space, unit-ish). */
  readonly daylightDir: readonly [number, number, number];
  readonly ambient: number;
  readonly fogDensity: number;
  readonly fogColor: string;
  readonly clearColor: readonly [number, number, number, number];
  /** 0–1 baked face darkening bias (no shadow map). */
  readonly shadowStrength: number;
  readonly detailLevel: AtlasDioramaDetailLevel;
  readonly maxInstancesPerBatch: number;
};

export type AtlasDioramaHouseVariant = 'timber' | 'plaster' | 'stone';
export type AtlasDioramaTreeVariant = 'oak' | 'birch' | 'pine';
export type AtlasDioramaRockVariant = 'boulder' | 'outcrop';

export type AtlasDioramaStampKind =
  | 'house'
  | 'tower'
  | 'tree'
  | 'rock'
  | 'street'
  | 'prop';

export type AtlasDioramaMeshRecipe = {
  readonly stamp: string;
  readonly kind: AtlasDioramaStampKind;
  readonly variant: string;
  readonly authority: AtlasDioramaLookAuthority;
  readonly wall: AtlasDioramaMaterialToken;
  readonly roof: AtlasDioramaMaterialToken | null;
  readonly foliage: AtlasDioramaMaterialToken | null;
  readonly trunk: AtlasDioramaMaterialToken | null;
  readonly windowAlbedo: string | null;
  readonly doorAlbedo: string | null;
  /** When false, skip windows/door trim (lite / far detail). */
  readonly includeFacades: boolean;
};

export type AtlasDioramaInstanceBatch = {
  readonly batchKey: string;
  readonly stamp: string;
  readonly variant: string;
  readonly kind: AtlasDioramaStampKind;
  readonly authority: AtlasDioramaLookAuthority;
  readonly instanceIds: readonly string[];
  readonly recipe: AtlasDioramaMeshRecipe;
};

export type AtlasDioramaLookPlan = {
  readonly format: typeof ATLAS_DIORAMA_LOOK_FORMAT;
  readonly light: AtlasDioramaLightProfile;
  readonly batches: readonly AtlasDioramaInstanceBatch[];
  readonly materials: readonly AtlasDioramaMaterialToken[];
  readonly counts: {
    readonly houses: number;
    readonly trees: number;
    readonly rocks: number;
    readonly streets: number;
    readonly props: number;
    readonly batches: number;
    readonly instances: number;
  };
  readonly contentFingerprint: string;
};

export const ATLAS_DIORAMA_MATERIALS: Readonly<Record<string, AtlasDioramaMaterialToken>> = {
  plaster: { id: 'plaster', albedo: '#d7c6a5', roughness: 0.72, metalness: 0.02 },
  timber: { id: 'timber', albedo: '#ae774c', roughness: 0.78, metalness: 0.01 },
  stone: { id: 'stone', albedo: '#adb2a4', roughness: 0.85, metalness: 0.04 },
  roofTile: { id: 'roofTile', albedo: '#794c3c', roughness: 0.68, metalness: 0.03 },
  roofDark: { id: 'roofDark', albedo: '#6f4f45', roughness: 0.7, metalness: 0.03 },
  roofMoss: { id: 'roofMoss', albedo: '#5a6b4a', roughness: 0.88, metalness: 0.01 },
  oakLeaf: { id: 'oakLeaf', albedo: '#527b55', roughness: 0.9, metalness: 0 },
  birchLeaf: { id: 'birchLeaf', albedo: '#6a9a62', roughness: 0.88, metalness: 0 },
  pineNeedle: { id: 'pineNeedle', albedo: '#376456', roughness: 0.92, metalness: 0 },
  bark: { id: 'bark', albedo: '#66584a', roughness: 0.95, metalness: 0 },
  birchBark: { id: 'birchBark', albedo: '#cfc6b4', roughness: 0.82, metalness: 0 },
  rock: { id: 'rock', albedo: '#82928a', roughness: 0.94, metalness: 0.05 },
  paving: { id: 'paving', albedo: '#9a9180', roughness: 0.8, metalness: 0.02 },
  dirt: { id: 'dirt', albedo: '#7a6548', roughness: 0.95, metalness: 0 },
  window: { id: 'window', albedo: '#2a3a48', roughness: 0.25, metalness: 0.35 },
  door: { id: 'door', albedo: '#493f3a', roughness: 0.75, metalness: 0.02 },
} as const;

const LIGHT_PROFILES: Readonly<Record<AtlasGraphicsPresetId, AtlasDioramaLightProfile>> = {
  high: {
    presetId: 'high',
    labelDe: 'Tageslicht — volle Fassadendetails',
    daylightDir: [-0.45, 1, -0.48],
    ambient: 0.3,
    fogDensity: 0.00035,
    fogColor: '#6a9aaa',
    clearColor: [0.0706, 0.2431, 0.2902, 1],
    shadowStrength: 0.55,
    detailLevel: 'full',
    maxInstancesPerBatch: 512,
  },
  balanced: {
    presetId: 'balanced',
    labelDe: 'Tageslicht — ausgewogene Details',
    daylightDir: [-0.4, 1, -0.5],
    ambient: 0.34,
    fogDensity: 0.00045,
    fogColor: '#5f8f9c',
    clearColor: [0.065, 0.22, 0.27, 1],
    shadowStrength: 0.42,
    detailLevel: 'reduced',
    maxInstancesPerBatch: 256,
  },
  lite: {
    presetId: 'lite',
    labelDe: 'Gedämpft — minimale Details / Fallback',
    daylightDir: [-0.3, 1, -0.4],
    ambient: 0.45,
    fogDensity: 0,
    fogColor: '#4a7078',
    clearColor: [0.055, 0.18, 0.22, 1],
    shadowStrength: 0.2,
    detailLevel: 'minimal',
    maxInstancesPerBatch: 96,
  },
};

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function resolveAtlasDioramaLightProfile(
  presetId: AtlasGraphicsPresetId,
): AtlasDioramaLightProfile {
  return LIGHT_PROFILES[presetId] ?? LIGHT_PROFILES.balanced;
}

export function atlasDioramaStampKind(stamp: string): AtlasDioramaStampKind {
  if (stamp === 'haus') return 'house';
  if (stamp === 'turm') return 'tower';
  if (stamp === 'baum' || stamp === 'tanne') return 'tree';
  if (stamp === 'fels') return 'rock';
  return 'prop';
}

export function atlasDioramaHouseVariant(id: string): AtlasDioramaHouseVariant {
  const n = hashId(id) % 3;
  if (n === 0) return 'timber';
  if (n === 1) return 'plaster';
  return 'stone';
}

export function atlasDioramaTreeVariant(id: string, stamp: string): AtlasDioramaTreeVariant {
  if (stamp === 'tanne') return 'pine';
  return hashId(id) % 2 === 0 ? 'oak' : 'birch';
}

export function atlasDioramaRockVariant(id: string): AtlasDioramaRockVariant {
  return hashId(id) % 2 === 0 ? 'boulder' : 'outcrop';
}

function material(id: keyof typeof ATLAS_DIORAMA_MATERIALS): AtlasDioramaMaterialToken {
  return ATLAS_DIORAMA_MATERIALS[id]!;
}

export function buildAtlasDioramaMeshRecipe(
  stamp: string,
  objectId: string,
  detail: AtlasDioramaDetailLevel,
): AtlasDioramaMeshRecipe {
  const kind = atlasDioramaStampKind(stamp);
  const includeFacades = detail === 'full' || detail === 'reduced';

  if (kind === 'house') {
    const variant = atlasDioramaHouseVariant(objectId);
    const wall =
      variant === 'timber'
        ? material('timber')
        : variant === 'stone'
          ? material('stone')
          : material('plaster');
    const roof =
      variant === 'timber'
        ? material('roofMoss')
        : variant === 'stone'
          ? material('roofDark')
          : material('roofTile');
    return {
      stamp,
      kind,
      variant,
      authority: 'canonical',
      wall,
      roof,
      foliage: null,
      trunk: null,
      windowAlbedo: includeFacades ? material('window').albedo : null,
      doorAlbedo: includeFacades ? material('door').albedo : null,
      includeFacades: detail === 'full',
    };
  }

  if (kind === 'tower') {
    return {
      stamp,
      kind,
      variant: 'keep',
      authority: 'canonical',
      wall: material('stone'),
      roof: material('roofDark'),
      foliage: null,
      trunk: null,
      windowAlbedo: includeFacades ? material('window').albedo : null,
      doorAlbedo: includeFacades ? material('door').albedo : null,
      includeFacades: detail === 'full',
    };
  }

  if (kind === 'tree') {
    const variant = atlasDioramaTreeVariant(objectId, stamp);
    const foliage =
      variant === 'pine'
        ? material('pineNeedle')
        : variant === 'birch'
          ? material('birchLeaf')
          : material('oakLeaf');
    const trunk = variant === 'birch' ? material('birchBark') : material('bark');
    return {
      stamp,
      kind,
      variant,
      authority: 'canonical',
      wall: trunk,
      roof: null,
      foliage,
      trunk,
      windowAlbedo: null,
      doorAlbedo: null,
      includeFacades: false,
    };
  }

  if (kind === 'rock') {
    const variant = atlasDioramaRockVariant(objectId);
    return {
      stamp,
      kind,
      variant,
      authority: 'canonical',
      wall: material('rock'),
      roof: null,
      foliage: null,
      trunk: null,
      windowAlbedo: null,
      doorAlbedo: null,
      includeFacades: false,
    };
  }

  return {
    stamp,
    kind: 'prop',
    variant: stamp || 'prop',
    authority: 'canonical',
    wall: material('timber'),
    roof: null,
    foliage: null,
    trunk: null,
    windowAlbedo: null,
    doorAlbedo: null,
    includeFacades: false,
  };
}

function objectStamp(obj: UnifiedCanvasObject): string {
  return typeof obj.type === 'string' && obj.type.length > 0 ? obj.type : 'prop';
}

/**
 * Build look plan: instance batches + materials + light for a graphics preset.
 * Empty docs yield zero batches (no invented village).
 */
export function buildAtlasDioramaLookPlan(
  doc: UnifiedCanvasDoc,
  options?: { readonly graphicsPresetId?: AtlasGraphicsPresetId },
): AtlasDioramaLookPlan {
  const presetId = options?.graphicsPresetId ?? 'balanced';
  const light = resolveAtlasDioramaLightProfile(presetId);
  const batchMap = new Map<string, AtlasDioramaInstanceBatch>();
  const materialsById = new Map<string, AtlasDioramaMaterialToken>();

  const remember = (token: AtlasDioramaMaterialToken | null): void => {
    if (!token) return;
    materialsById.set(token.id, token);
  };

  let houses = 0;
  let trees = 0;
  let rocks = 0;
  let props = 0;

  for (const obj of doc.objects) {
    const stamp = objectStamp(obj);
    const recipe = buildAtlasDioramaMeshRecipe(stamp, obj.id, light.detailLevel);
    remember(recipe.wall);
    remember(recipe.roof);
    remember(recipe.foliage);
    remember(recipe.trunk);
    if (recipe.windowAlbedo) remember(material('window'));
    if (recipe.doorAlbedo) remember(material('door'));

    if (recipe.kind === 'house' || recipe.kind === 'tower') houses += 1;
    else if (recipe.kind === 'tree') trees += 1;
    else if (recipe.kind === 'rock') rocks += 1;
    else props += 1;

    const batchKey = `${recipe.stamp}:${recipe.variant}:${recipe.kind}`;
    const existing = batchMap.get(batchKey);
    if (existing) {
      if (existing.instanceIds.length >= light.maxInstancesPerBatch) continue;
      batchMap.set(batchKey, {
        ...existing,
        instanceIds: [...existing.instanceIds, obj.id],
      });
    } else {
      batchMap.set(batchKey, {
        batchKey,
        stamp: recipe.stamp,
        variant: recipe.variant,
        kind: recipe.kind,
        authority: recipe.authority,
        instanceIds: [obj.id],
        recipe,
      });
    }
  }

  let streets = 0;
  for (const stroke of doc.strokes) {
    const matKey =
      stroke.material === 'pflaster' || stroke.material === 'stein' ? 'paving' : 'dirt';
    const token = material(matKey);
    remember(token);
    streets += 1;
    const batchKey = `street:${matKey}`;
    const existing = batchMap.get(batchKey);
    const recipe: AtlasDioramaMeshRecipe = {
      stamp: 'street',
      kind: 'street',
      variant: matKey,
      authority: 'canonical',
      wall: token,
      roof: null,
      foliage: null,
      trunk: null,
      windowAlbedo: null,
      doorAlbedo: null,
      includeFacades: false,
    };
    if (existing) {
      batchMap.set(batchKey, {
        ...existing,
        instanceIds: [...existing.instanceIds, stroke.id],
      });
    } else {
      batchMap.set(batchKey, {
        batchKey,
        stamp: 'street',
        variant: matKey,
        kind: 'street',
        authority: 'canonical',
        instanceIds: [stroke.id],
        recipe,
      });
    }
  }

  const batches = [...batchMap.values()];
  const instances = batches.reduce((n, b) => n + b.instanceIds.length, 0);
  const contentFingerprint = [
    `preset:${light.presetId}`,
    `detail:${light.detailLevel}`,
    `o${doc.objects.length}`,
    `s${doc.strokes.length}`,
    ...batches.map((b) => `${b.batchKey}×${b.instanceIds.length}`),
  ].join('|');

  return {
    format: ATLAS_DIORAMA_LOOK_FORMAT,
    light,
    batches,
    materials: [...materialsById.values()],
    counts: {
      houses,
      trees,
      rocks,
      streets,
      props,
      batches: batches.length,
      instances,
    },
    contentFingerprint,
  };
}

/** True when every batch authority is canonical (no atmospheric mesh invent). */
export function atlasDioramaLookPlanIsCanonicalOnly(plan: AtlasDioramaLookPlan): boolean {
  return plan.batches.every((b) => b.authority === 'canonical');
}
