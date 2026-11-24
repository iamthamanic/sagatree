/**
 * Avatar V2 Body Profile + Family Compatibility — pure domain (#253 / Epic #248).
 * Location: src/domains/character/avatar/body-profile-contract-v1.ts
 *
 * Classifies humanoid artifacts by normalized proportions against
 * Standard / Compact / Heavy references. Never invents a family under threshold.
 * Species/lore is orthogonal and unused here. No React / Three / backend clients.
 */

import type { AvatarV2Anatomy, AvatarV2BodyFamily } from './composition-contract-v2';

export const BODY_PROFILE_CONTRACT_VERSION = 'SagaTreeBodyProfileV1' as const;

/** Canonical clothing/fit families — not species. */
export const BODY_PROFILE_FAMILY_IDS = ['standard', 'compact', 'heavy'] as const;
export type BodyProfileFamilyId = (typeof BODY_PROFILE_FAMILY_IDS)[number];

export const BODY_PROFILE_VALIDATION_STATUSES = [
  'valid',
  'insufficient-evidence',
  'skipped-non-humanoid',
] as const;
export type BodyProfileValidationStatus =
  (typeof BODY_PROFILE_VALIDATION_STATUSES)[number];

export const FAMILY_COMPATIBILITY_STATUSES = [
  'family-compatible',
  'custom',
  'insufficient-evidence',
] as const;
export type FamilyCompatibilityStatus =
  (typeof FAMILY_COMPATIBILITY_STATUSES)[number];

/**
 * Normalized humanoid proportions (unitless ratios).
 * All lengths relative to overall height (hips→head + hips→foot approx).
 */
export interface BodyProfileProportionsV1 {
  /** (shoulder width) / height */
  shoulderToHeight: number;
  /** (hip width) / height */
  hipToHeight: number;
  /** (torso length hips→neck) / height */
  torsoToHeight: number;
  /** (leg length hips→foot) / height */
  legToHeight: number;
  /** (arm span proxy) / height */
  armToHeight: number;
  /** head height / overall height */
  headToHeight: number;
}

export interface BodyProfileV1 {
  contractVersion: typeof BODY_PROFILE_CONTRACT_VERSION;
  proportions: BodyProfileProportionsV1;
  /** Measurement unit before normalization (informational). */
  sourceUnit: 'meter';
  /** Scale applied so height ≈ 1.0 before ratios. */
  normalizeScale: number;
  validationStatus: BodyProfileValidationStatus;
  limitations: readonly string[];
}

export interface BodyFamilyReferenceProfileV1 {
  familyId: BodyProfileFamilyId;
  labelDe: string;
  proportions: BodyProfileProportionsV1;
}

export interface FamilyScoreV1 {
  familyId: BodyProfileFamilyId;
  /** 0..1 similarity (1 = identical proportions). */
  score: number;
}

export interface FamilyCompatibilityResultV1 {
  contractVersion: typeof BODY_PROFILE_CONTRACT_VERSION;
  status: FamilyCompatibilityStatus;
  /** Winning clothing family when status=family-compatible; else custom. */
  recommendedFamily: AvatarV2BodyFamily;
  scores: readonly FamilyScoreV1[];
  /** Minimum score required for family-compatible. */
  threshold: number;
  confidence: number;
  validationStatus: BodyProfileValidationStatus;
  limitations: readonly string[];
}

/** Versioned threshold — fail closed below this (no forced best match). */
export const BODY_FAMILY_COMPATIBILITY_THRESHOLD = 0.82;

export const BODY_FAMILY_REFERENCE_PROFILES_V1: readonly BodyFamilyReferenceProfileV1[] =
  [
    {
      familyId: 'standard',
      labelDe: 'Standard',
      proportions: {
        shoulderToHeight: 0.26,
        hipToHeight: 0.2,
        torsoToHeight: 0.3,
        legToHeight: 0.48,
        armToHeight: 0.44,
        headToHeight: 0.13,
      },
    },
    {
      familyId: 'compact',
      labelDe: 'Compact',
      proportions: {
        shoulderToHeight: 0.28,
        hipToHeight: 0.24,
        torsoToHeight: 0.34,
        legToHeight: 0.42,
        armToHeight: 0.4,
        headToHeight: 0.15,
      },
    },
    {
      familyId: 'heavy',
      labelDe: 'Heavy',
      proportions: {
        shoulderToHeight: 0.32,
        hipToHeight: 0.26,
        torsoToHeight: 0.32,
        legToHeight: 0.46,
        armToHeight: 0.46,
        headToHeight: 0.12,
      },
    },
  ] as const;

const PROPORTION_KEYS = [
  'shoulderToHeight',
  'hipToHeight',
  'torsoToHeight',
  'legToHeight',
  'armToHeight',
  'headToHeight',
] as const satisfies readonly (keyof BodyProfileProportionsV1)[];

export function isBodyProfileFamilyId(value: unknown): value is BodyProfileFamilyId {
  return (
    typeof value === 'string' &&
    (BODY_PROFILE_FAMILY_IDS as readonly string[]).includes(value)
  );
}

export function getBodyFamilyReferenceProfile(
  familyId: BodyProfileFamilyId,
): BodyFamilyReferenceProfileV1 {
  const found = BODY_FAMILY_REFERENCE_PROFILES_V1.find((p) => p.familyId === familyId);
  if (!found) {
    return BODY_FAMILY_REFERENCE_PROFILES_V1[0];
  }
  return found;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function isFinitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

export function validateBodyProfileProportions(
  proportions: BodyProfileProportionsV1,
): readonly string[] {
  const limitations: string[] = [];
  for (const key of PROPORTION_KEYS) {
    const value = proportions[key];
    if (!isFinitePositive(value) || value > 1.5) {
      limitations.push(`Proportion ${key} ungültig oder außerhalb sinnvoller Bounds.`);
    }
  }
  return limitations;
}

/**
 * Build a BodyProfile from already-normalized proportions (Infrastructure measures).
 */
export function createBodyProfileV1(input: {
  proportions: BodyProfileProportionsV1;
  normalizeScale?: number;
  limitations?: readonly string[];
}): BodyProfileV1 {
  const propIssues = validateBodyProfileProportions(input.proportions);
  const limitations = [...(input.limitations ?? []), ...propIssues];
  const validationStatus: BodyProfileValidationStatus =
    limitations.length > 0 ? 'insufficient-evidence' : 'valid';
  return {
    contractVersion: BODY_PROFILE_CONTRACT_VERSION,
    proportions: input.proportions,
    sourceUnit: 'meter',
    normalizeScale: input.normalizeScale && input.normalizeScale > 0 ? input.normalizeScale : 1,
    validationStatus,
    limitations,
  };
}

/**
 * Cosine-like similarity on proportion vectors (bounded 0..1).
 * Equal vectors → 1; large relative deltas → lower score.
 */
export function scoreBodyProfileSimilarity(
  candidate: BodyProfileProportionsV1,
  reference: BodyProfileProportionsV1,
): number {
  let accum = 0;
  for (const key of PROPORTION_KEYS) {
    const a = candidate[key];
    const b = reference[key];
    if (!isFinitePositive(a) || !isFinitePositive(b)) {
      return 0;
    }
    const rel = Math.abs(a - b) / Math.max(b, 1e-6);
    // Map relative error: 0 → 1, 0.5 → ~0.37, 1+ → ~0
    accum += Math.exp(-2.2 * rel);
  }
  return clamp01(accum / PROPORTION_KEYS.length);
}

/**
 * Resolve family compatibility. Never forces a family under threshold.
 * Custom creatures / non-humanoid → skipped → custom.
 */
export function resolveFamilyCompatibility(input: {
  profile: BodyProfileV1;
  anatomy: AvatarV2Anatomy;
  threshold?: number;
}): FamilyCompatibilityResultV1 {
  const threshold = input.threshold ?? BODY_FAMILY_COMPATIBILITY_THRESHOLD;
  const limitations = [...input.profile.limitations];

  if (input.anatomy === 'custom-creature') {
    return {
      contractVersion: BODY_PROFILE_CONTRACT_VERSION,
      status: 'custom',
      recommendedFamily: 'custom',
      scores: [],
      threshold,
      confidence: 1,
      validationStatus: 'skipped-non-humanoid',
      limitations: [...limitations, 'Custom Creature überspringt Humanoid-Family-Matching.'],
    };
  }

  if (input.anatomy !== 'humanoid') {
    return {
      contractVersion: BODY_PROFILE_CONTRACT_VERSION,
      status: 'insufficient-evidence',
      recommendedFamily: 'custom',
      scores: [],
      threshold,
      confidence: 0,
      validationStatus: 'insufficient-evidence',
      limitations: [...limitations, 'Anatomy ist nicht humanoid — kein Family-Match.'],
    };
  }

  if (input.profile.validationStatus === 'insufficient-evidence') {
    return {
      contractVersion: BODY_PROFILE_CONTRACT_VERSION,
      status: 'insufficient-evidence',
      recommendedFamily: 'custom',
      scores: [],
      threshold,
      confidence: 0,
      validationStatus: 'insufficient-evidence',
      limitations,
    };
  }

  const scores: FamilyScoreV1[] = BODY_FAMILY_REFERENCE_PROFILES_V1.map((ref) => ({
    familyId: ref.familyId,
    score: scoreBodyProfileSimilarity(input.profile.proportions, ref.proportions),
  })).sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (!best || best.score < threshold) {
    return {
      contractVersion: BODY_PROFILE_CONTRACT_VERSION,
      status: 'custom',
      recommendedFamily: 'custom',
      scores,
      threshold,
      confidence: best ? clamp01(best.score) : 0,
      validationStatus: 'valid',
      limitations: [
        ...limitations,
        best
          ? `Bester Score ${best.score.toFixed(3)} unter Threshold ${threshold} — bleibt custom.`
          : 'Keine Scores — bleibt custom.',
      ],
    };
  }

  return {
    contractVersion: BODY_PROFILE_CONTRACT_VERSION,
    status: 'family-compatible',
    recommendedFamily: best.familyId,
    scores,
    threshold,
    confidence: clamp01(best.score),
    validationStatus: 'valid',
    limitations,
  };
}

/**
 * Raw bone-chain lengths in meters (Infrastructure). Domain normalizes + builds profile.
 * Missing required lengths → insufficient-evidence.
 */
export interface HumanoidMetricLengthsV1 {
  height: number;
  shoulderWidth: number;
  hipWidth: number;
  torsoLength: number;
  legLength: number;
  armLength: number;
  headHeight: number;
}

export function bodyProfileFromMetricLengths(
  metrics: HumanoidMetricLengthsV1,
): BodyProfileV1 {
  const limitations: string[] = [];
  if (!isFinitePositive(metrics.height)) {
    limitations.push('Höhe fehlt oder ungültig.');
    return createBodyProfileV1({
      proportions: {
        shoulderToHeight: 0,
        hipToHeight: 0,
        torsoToHeight: 0,
        legToHeight: 0,
        armToHeight: 0,
        headToHeight: 0,
      },
      normalizeScale: 1,
      limitations,
    });
  }

  const h = metrics.height;
  const normalizeScale = 1 / h;
  const proportions: BodyProfileProportionsV1 = {
    shoulderToHeight: metrics.shoulderWidth / h,
    hipToHeight: metrics.hipWidth / h,
    torsoToHeight: metrics.torsoLength / h,
    legToHeight: metrics.legLength / h,
    armToHeight: metrics.armLength / h,
    headToHeight: metrics.headHeight / h,
  };

  for (const [key, value] of Object.entries(metrics) as [string, number][]) {
    if (key === 'height') continue;
    if (!isFinitePositive(value)) {
      limitations.push(`Messwert ${key} fehlt — insufficient-evidence.`);
    }
  }

  return createBodyProfileV1({ proportions, normalizeScale, limitations });
}
