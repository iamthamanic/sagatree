/**
 * Avatar V2 Starter Wardrobe — Wearable Manifest v2 (#257 / Epic #248).
 * Location: src/domains/character/avatar/starter-wardrobe-manifest-v1.ts
 *
 * Six logical wearables × Standard/Compact/Heavy family fits. One logical id;
 * body family resolves the variant — never species-duplicated contracts.
 * Pure domain: no React / Three / backend clients.
 */

import {
  CANONICAL_BODY_ASSET_IDS,
  CANONICAL_BODY_FAMILY_IDS,
  type CanonicalBodyFamilyId,
} from './canonical-body-families-v1';
import {
  EQUIPMENT_HIDE_REGIONS,
  type EquipmentAttachmentKind,
  type EquipmentHideRegion,
} from './equipment-visual-contract';
import {
  FIT_RANGE_CONTRACT_VERSION,
  resolveAvatarFitCompatibility,
  type AvatarFitMorphBound,
  type AvatarFitRangeV1,
  type AvatarFitStatus,
} from './fit-range-contract';
import { MORPH_CONTRACT_VERSION, type SagaTreeAvatarMorphStateV1 } from './morph-contract';
import { RIG_CONTRACT_VERSION } from './rig-contract';
import { BASE_BODY_ASSET_VERSION } from './base-body-contract';
import type { AssetAuthoringProvenanceV1 } from './asset-authoring-contract-v1';
import { SPECIES_DEFAULT_BODY_FAMILY } from './species-template-pack-v1';
import type { BaseBodySpeciesId } from './base-body-contract';

export const STARTER_WARDROBE_CONTRACT_VERSION =
  'SagaTreeStarterWardrobeManifestV1' as const;

export const STARTER_WARDROBE_PACK_VERSION = '1.0.0' as const;

/** Logical wearable ids — one id across all body families. */
export const STARTER_WEARABLE_IDS = [
  'underwear',
  'basic-shirt',
  'basic-pants',
  'basic-boots',
  'basic-robe',
  'leather-armor',
] as const;

export type StarterWearableId = (typeof STARTER_WEARABLE_IDS)[number];

/**
 * Wearable clothing slots (region layering) — not inventory EquipmentSlot.
 * Inventory mapping stays in equipment-visual; wardrobe owns fit/hide metadata.
 */
export const STARTER_WEARABLE_SLOTS = [
  'underwear',
  'torso',
  'legs',
  'feet',
  'outer',
  'armor',
] as const;

export type StarterWearableSlot = (typeof STARTER_WEARABLE_SLOTS)[number];

export type StarterWearableFitStatus =
  | AvatarFitStatus
  | 'missing-variant';

export interface StarterWearableHideRule {
  hideRegions: readonly EquipmentHideRegion[];
  /** Body mesh regions masked while equipped — must reverse on unequip. */
  bodyMaskRegions: readonly EquipmentHideRegion[];
  reversible: true;
}

export interface StarterWearableFamilyVariantV1 {
  familyId: CanonicalBodyFamilyId;
  /** Self-hosted relative asset path (allowlisted). */
  assetPath: string;
  assetVersion: string;
  format: 'glb' | 'vrm';
  fitRange: AvatarFitRangeV1;
  goldenFitRef: string;
  /** Neutral + authorized morph-extreme fixture refs. */
  goldenExtremeRefs: readonly string[];
}

export interface StarterWearableManifestV1 {
  contractVersion: typeof STARTER_WARDROBE_CONTRACT_VERSION;
  packVersion: typeof STARTER_WARDROBE_PACK_VERSION;
  wearableId: StarterWearableId;
  labelDe: string;
  slot: StarterWearableSlot;
  attachment: EquipmentAttachmentKind;
  /** Underwear is the default baselayer — not baked into species templates. */
  isDefaultBaseLayer: boolean;
  hideRule: StarterWearableHideRule;
  rigVersion: typeof RIG_CONTRACT_VERSION;
  morphContractVersion: typeof MORPH_CONTRACT_VERSION;
  variants: readonly StarterWearableFamilyVariantV1[];
  provenance: AssetAuthoringProvenanceV1;
}

export interface ResolvedStarterWearableFitV1 {
  wearableId: StarterWearableId;
  familyId: CanonicalBodyFamilyId;
  status: StarterWearableFitStatus;
  messageDe: string | null;
  variant: StarterWearableFamilyVariantV1 | null;
  fitStatus: AvatarFitStatus | null;
  hideRule: StarterWearableHideRule;
}

const SHARED_PROVENANCE: AssetAuthoringProvenanceV1 = {
  license: 'first-party',
  attributionDe: 'SagaTree Starter Wardrobe v1',
};

const PRIMARY_BOUNDS: readonly AvatarFitMorphBound[] = [
  { key: 'height', min: -0.85, max: 0.85 },
  { key: 'shoulderWidth', min: -0.85, max: 0.85 },
  { key: 'chest', min: -0.85, max: 0.85 },
  { key: 'waist', min: -0.85, max: 0.85 },
  { key: 'hips', min: -0.85, max: 0.85 },
  { key: 'build', min: -0.85, max: 0.85 },
] as const;

function assertHideRegion(value: string): EquipmentHideRegion {
  if (!(EQUIPMENT_HIDE_REGIONS as readonly string[]).includes(value)) {
    throw new Error(`Invalid hide region: ${value}`);
  }
  return value as EquipmentHideRegion;
}

function hideRule(
  hide: readonly string[],
  mask: readonly string[],
): StarterWearableHideRule {
  return {
    hideRegions: hide.map(assertHideRegion),
    bodyMaskRegions: mask.map(assertHideRegion),
    reversible: true,
  };
}

function fitRangeFor(assetId: string, assetVersion: string): AvatarFitRangeV1 {
  return {
    contractVersion: FIT_RANGE_CONTRACT_VERSION,
    assetId,
    socket: 'wearable',
    assetVersion,
    rigVersion: RIG_CONTRACT_VERSION,
    morphContractVersion: MORPH_CONTRACT_VERSION,
    bounds: PRIMARY_BOUNDS,
    allowClamp: false,
  };
}

function variant(
  wearableId: StarterWearableId,
  familyId: CanonicalBodyFamilyId,
): StarterWearableFamilyVariantV1 {
  const assetPath = `wearables/${wearableId}/${familyId}.glb`;
  const assetVersion = `sd_wearable_${wearableId}_${familyId}_v1.0.0`;
  const goldenFitRef = `fixtures/avatar-v2/golden/wearable-${wearableId}-${familyId}.json`;
  return {
    familyId,
    assetPath,
    assetVersion,
    format: 'glb',
    fitRange: fitRangeFor(`wearable:${wearableId}:${familyId}`, assetVersion),
    goldenFitRef,
    goldenExtremeRefs: [
      `fixtures/avatar-v2/golden/wearable-${wearableId}-${familyId}-neutral.json`,
      `fixtures/avatar-v2/golden/wearable-${wearableId}-${familyId}-extreme.json`,
    ],
  };
}

const WEARABLE_META: Record<
  StarterWearableId,
  {
    labelDe: string;
    slot: StarterWearableSlot;
    isDefaultBaseLayer: boolean;
    hide: readonly string[];
    mask: readonly string[];
  }
> = {
  underwear: {
    labelDe: 'Unterwäsche',
    slot: 'underwear',
    isDefaultBaseLayer: true,
    hide: ['none'],
    mask: ['none'],
  },
  'basic-shirt': {
    labelDe: 'Basic Hemd',
    slot: 'torso',
    isDefaultBaseLayer: false,
    hide: ['torso'],
    mask: ['torso'],
  },
  'basic-pants': {
    labelDe: 'Basic Hose',
    slot: 'legs',
    isDefaultBaseLayer: false,
    hide: ['legs'],
    mask: ['legs'],
  },
  'basic-boots': {
    labelDe: 'Basic Stiefel',
    slot: 'feet',
    isDefaultBaseLayer: false,
    hide: ['feet'],
    mask: ['feet'],
  },
  'basic-robe': {
    labelDe: 'Basic Robe',
    slot: 'outer',
    isDefaultBaseLayer: false,
    hide: ['torso', 'arms', 'legs'],
    mask: ['torso', 'arms', 'legs'],
  },
  'leather-armor': {
    labelDe: 'Lederrüstung',
    slot: 'armor',
    isDefaultBaseLayer: false,
    hide: ['torso', 'arms'],
    mask: ['torso', 'arms'],
  },
};

export function isStarterWearableId(value: unknown): value is StarterWearableId {
  return (
    typeof value === 'string' &&
    (STARTER_WEARABLE_IDS as readonly string[]).includes(value)
  );
}

export function createStarterWearableManifest(
  wearableId: StarterWearableId,
): StarterWearableManifestV1 {
  const meta = WEARABLE_META[wearableId];
  return {
    contractVersion: STARTER_WARDROBE_CONTRACT_VERSION,
    packVersion: STARTER_WARDROBE_PACK_VERSION,
    wearableId,
    labelDe: meta.labelDe,
    slot: meta.slot,
    attachment: 'skinned',
    isDefaultBaseLayer: meta.isDefaultBaseLayer,
    hideRule: hideRule(meta.hide, meta.mask),
    rigVersion: RIG_CONTRACT_VERSION,
    morphContractVersion: MORPH_CONTRACT_VERSION,
    variants: CANONICAL_BODY_FAMILY_IDS.map((familyId) =>
      variant(wearableId, familyId),
    ),
    provenance: SHARED_PROVENANCE,
  };
}

export function listStarterWearableManifests(): readonly StarterWearableManifestV1[] {
  return STARTER_WEARABLE_IDS.map(createStarterWearableManifest);
}

export function getStarterWearableManifest(
  wearableId: StarterWearableId,
): StarterWearableManifestV1 {
  return createStarterWearableManifest(wearableId);
}

/** Resolve family fit for a logical wearable — never species-duplicated. */
export function resolveStarterWearableFit(input: {
  wearableId: StarterWearableId;
  bodyFamily: CanonicalBodyFamilyId;
  morph?: SagaTreeAvatarMorphStateV1;
  /** Optional incomplete catalog for fail-closed tests. */
  catalog?: readonly StarterWearableManifestV1[];
}): ResolvedStarterWearableFitV1 {
  const catalog = input.catalog ?? listStarterWearableManifests();
  const manifest = catalog.find((m) => m.wearableId === input.wearableId);
  if (!manifest) {
    return {
      wearableId: input.wearableId,
      familyId: input.bodyFamily,
      status: 'incompatible',
      messageDe: 'Wearable ist nicht im Starter-Wardrobe-Katalog.',
      variant: null,
      fitStatus: null,
      hideRule: hideRule(['none'], ['none']),
    };
  }

  const familyVariant = manifest.variants.find(
    (v) => v.familyId === input.bodyFamily,
  );
  if (!familyVariant) {
    return {
      wearableId: input.wearableId,
      familyId: input.bodyFamily,
      status: 'missing-variant',
      messageDe: `Kein ${input.bodyFamily}-Fit für ${manifest.labelDe} — nicht still falsch gerendert.`,
      variant: null,
      fitStatus: null,
      hideRule: manifest.hideRule,
    };
  }

  if (!input.morph) {
    return {
      wearableId: input.wearableId,
      familyId: input.bodyFamily,
      status: 'ready',
      messageDe: null,
      variant: familyVariant,
      fitStatus: 'ready',
      hideRule: manifest.hideRule,
    };
  }

  const fitResult = resolveAvatarFitCompatibility({
    morph: input.morph,
    fit: familyVariant.fitRange,
    expectedAssetVersion: familyVariant.assetVersion,
    expectedRigVersion: RIG_CONTRACT_VERSION,
    expectedMorphContractVersion: MORPH_CONTRACT_VERSION,
  });

  if (fitResult.status !== 'ready') {
    return {
      wearableId: input.wearableId,
      familyId: input.bodyFamily,
      status: fitResult.status,
      messageDe: fitResult.messageDe,
      variant: familyVariant,
      fitStatus: fitResult.status,
      hideRule: manifest.hideRule,
    };
  }

  return {
    wearableId: input.wearableId,
    familyId: input.bodyFamily,
    status: 'ready',
    messageDe: null,
    variant: familyVariant,
    fitStatus: 'ready',
    hideRule: manifest.hideRule,
  };
}

/**
 * Species → body family → wearable fit (same logical id for human and dwarf).
 */
export function resolveStarterWearableFitForSpecies(input: {
  wearableId: StarterWearableId;
  speciesId: BaseBodySpeciesId;
  morph?: SagaTreeAvatarMorphStateV1;
}): ResolvedStarterWearableFitV1 {
  const bodyFamily = SPECIES_DEFAULT_BODY_FAMILY[input.speciesId];
  return resolveStarterWearableFit({
    wearableId: input.wearableId,
    bodyFamily,
    morph: input.morph,
  });
}

/** Unequip restores body regions previously masked by this wearable. */
export function restoreRegionsAfterUnequip(
  hideRule: StarterWearableHideRule,
): readonly EquipmentHideRegion[] {
  if (!hideRule.reversible) {
    throw new Error('Hide rule must be reversible');
  }
  return hideRule.bodyMaskRegions;
}

export function listAllowlistedStarterWearablePaths(
  manifests: readonly StarterWearableManifestV1[] = listStarterWearableManifests(),
): readonly string[] {
  const paths: string[] = [];
  for (const m of manifests) {
    for (const v of m.variants) {
      paths.push(v.assetPath);
    }
  }
  return paths;
}

export function assertStarterWardrobeComplete(
  manifests: readonly StarterWearableManifestV1[] = listStarterWearableManifests(),
): { ok: boolean; issues: readonly string[] } {
  const issues: string[] = [];
  const seen = new Set<string>();

  if (manifests.length !== STARTER_WEARABLE_IDS.length) {
    issues.push(
      `expected ${STARTER_WEARABLE_IDS.length} wearables, got ${manifests.length}`,
    );
  }

  for (const m of manifests) {
    if (seen.has(m.wearableId)) {
      issues.push(`duplicate wearable ${m.wearableId}`);
    }
    seen.add(m.wearableId);

    if (m.contractVersion !== STARTER_WARDROBE_CONTRACT_VERSION) {
      issues.push(`${m.wearableId}: bad contract version`);
    }
    if (m.attachment !== 'skinned') {
      issues.push(`${m.wearableId}: starter wardrobe requires skinned attachment`);
    }
    if (!m.hideRule.reversible) {
      issues.push(`${m.wearableId}: hide rule must be reversible`);
    }
    if (m.wearableId === 'underwear' && !m.isDefaultBaseLayer) {
      issues.push('underwear must be default baselayer');
    }
    if (m.wearableId !== 'underwear' && m.isDefaultBaseLayer) {
      issues.push(`${m.wearableId}: only underwear is default baselayer`);
    }
    if (m.variants.length !== CANONICAL_BODY_FAMILY_IDS.length) {
      issues.push(`${m.wearableId}: expected 3 family variants`);
    }
    for (const familyId of CANONICAL_BODY_FAMILY_IDS) {
      const v = m.variants.find((x) => x.familyId === familyId);
      if (!v) {
        issues.push(`${m.wearableId}: missing ${familyId} variant`);
        continue;
      }
      if (!v.assetPath.includes(m.wearableId) || !v.assetPath.includes(familyId)) {
        issues.push(`${m.wearableId}/${familyId}: asset path mismatch`);
      }
      if (v.fitRange.allowClamp) {
        issues.push(`${m.wearableId}/${familyId}: allowClamp must be false`);
      }
      if (v.fitRange.assetVersion !== v.assetVersion) {
        issues.push(`${m.wearableId}/${familyId}: fit assetVersion mismatch`);
      }
      // Species must never appear in wearable ids/paths (no species dup contracts).
      if (/human|elf|dwarf|halfling|orc|cyborg|alien/i.test(v.assetPath)) {
        issues.push(`${m.wearableId}/${familyId}: species leak in asset path`);
      }
    }
  }

  for (const id of STARTER_WEARABLE_IDS) {
    if (!seen.has(id)) issues.push(`missing wearable ${id}`);
  }

  // Sanity: canonical body assets exist for family resolution context.
  for (const familyId of CANONICAL_BODY_FAMILY_IDS) {
    if (!CANONICAL_BODY_ASSET_IDS[familyId]) {
      issues.push(`missing canonical body for ${familyId}`);
    }
  }

  // Guard unused legacy version stamp drift.
  if (!BASE_BODY_ASSET_VERSION) {
    issues.push('missing base body asset version');
  }

  return { ok: issues.length === 0, issues };
}

/** Golden fit matrix: 6 wearables × 3 families = 18. */
export function listGoldenFitMatrixEntries(
  manifests: readonly StarterWearableManifestV1[] = listStarterWearableManifests(),
): readonly {
  wearableId: StarterWearableId;
  familyId: CanonicalBodyFamilyId;
  goldenFitRef: string;
}[] {
  const entries: {
    wearableId: StarterWearableId;
    familyId: CanonicalBodyFamilyId;
    goldenFitRef: string;
  }[] = [];
  for (const m of manifests) {
    for (const v of m.variants) {
      entries.push({
        wearableId: m.wearableId,
        familyId: v.familyId,
        goldenFitRef: v.goldenFitRef,
      });
    }
  }
  return entries;
}
