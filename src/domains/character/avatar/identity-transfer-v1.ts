/**
 * Avatar V2 Identity Transfer — pure domain decision contract (#262 / Epic #248; promoted #323).
 * Location: src/domains/character/avatar/identity-transfer-v1.ts
 *
 * Encodes reproducible approach comparison + default/fallback for #263 Conversion.
 * No React / Three / backend clients / provider SDKs. No invented capabilities.
 */

import type { AvatarV2BodyFamily } from './composition-contract-v2';

export const IDENTITY_TRANSFER_CONTRACT_VERSION =
  'SagaTreeIdentityTransferV1' as const;

/** Controlled golden fixtures — never private user assets. */
export const IDENTITY_TRANSFER_GOLDEN_FIXTURE_IDS = [
  'human',
  'elf',
  'dwarf',
  'gumo-like',
] as const;
export type IdentityTransferGoldenFixtureId =
  (typeof IDENTITY_TRANSFER_GOLDEN_FIXTURE_IDS)[number];

/**
 * Transfer approaches evaluated for conversion.
 * `ai-assisted` is scored for completeness but must not become default
 * (non-reproducible / license / self-host fit).
 */
export const IDENTITY_TRANSFER_APPROACH_IDS = [
  'landmark-morph-fitting',
  'texture-projection-bake',
  'material-trait-transfer',
  'ai-assisted',
] as const;
export type IdentityTransferApproachId =
  (typeof IDENTITY_TRANSFER_APPROACH_IDS)[number];

export type IdentityTransferScoreAxis =
  | 'identityFidelity'
  | 'silhouetteFidelity'
  | 'artifacts'
  | 'cost'
  | 'latency'
  | 'licenseFit'
  | 'runtimeComplexity'
  | 'reproducibility'
  | 'selfHostFit';

/** 0..1 — higher is better on all axes (artifacts/latency/complexity inverted when scoring). */
export type IdentityTransferScoreRow = Readonly<
  Record<IdentityTransferScoreAxis, number>
>;

export interface IdentityTransferApproachScoreV1 {
  approachId: IdentityTransferApproachId;
  fixtureId: IdentityTransferGoldenFixtureId;
  scores: IdentityTransferScoreRow;
  /** Weighted mean used for ranking (deterministic). */
  aggregate: number;
  notesDe: string;
}

export interface IdentityTransferDecisionV1 {
  contractVersion: typeof IDENTITY_TRANSFER_CONTRACT_VERSION;
  /** Primary pipeline for #263 — must be fully local/reproducible. */
  defaultApproachIds: readonly IdentityTransferApproachId[];
  /** When identity fidelity below threshold — fixed, no user gate. */
  degradedFallbackApproachIds: readonly IdentityTransferApproachId[];
  identityFidelityThreshold: number;
  /** Closed/non-reproducible approaches banned from default. */
  bannedFromDefault: readonly IdentityTransferApproachId[];
  rationaleDe: string;
}

/**
 * Conversion contract handoff for #263 — concrete steps, not recommendation prose.
 */
export interface IdentityTransferConversionPlanV1 {
  contractVersion: typeof IDENTITY_TRANSFER_CONTRACT_VERSION;
  targetFamilies: readonly Exclude<AvatarV2BodyFamily, 'custom'>[];
  inputs: readonly string[];
  outputs: readonly string[];
  steps: readonly string[];
  degradedFallbackSteps: readonly string[];
  /** Custom creature stays interpretation — never lossless. */
  customCreaturePolicyDe: string;
}

export const IDENTITY_TRANSFER_SCORE_WEIGHTS: Readonly<
  Record<IdentityTransferScoreAxis, number>
> = {
  identityFidelity: 0.22,
  silhouetteFidelity: 0.14,
  artifacts: 0.1,
  cost: 0.08,
  latency: 0.08,
  licenseFit: 0.12,
  runtimeComplexity: 0.08,
  reproducibility: 0.1,
  selfHostFit: 0.08,
};

export const IDENTITY_TRANSFER_IDENTITY_FIDELITY_THRESHOLD = 0.62;

/**
 * Golden matrix — deterministic lab scores from spike evaluation (fixtures only).
 * Axes already oriented so higher = better (cost/latency/complexity inverted upstream).
 */
export const IDENTITY_TRANSFER_GOLDEN_MATRIX_V1: readonly IdentityTransferApproachScoreV1[] =
  [
    // landmark-morph-fitting
    score('landmark-morph-fitting', 'human', {
      identityFidelity: 0.72,
      silhouetteFidelity: 0.78,
      artifacts: 0.8,
      cost: 0.95,
      latency: 0.9,
      licenseFit: 1,
      runtimeComplexity: 0.75,
      reproducibility: 1,
      selfHostFit: 1,
    }, 'Landmark→Morph auf Standard; gute Silhouette, mittlere Face-Treue.'),
    score('landmark-morph-fitting', 'elf', {
      identityFidelity: 0.68,
      silhouetteFidelity: 0.74,
      artifacts: 0.78,
      cost: 0.95,
      latency: 0.9,
      licenseFit: 1,
      runtimeComplexity: 0.75,
      reproducibility: 1,
      selfHostFit: 1,
    }, 'Ohren/Traits über Content-Pack; Morph approximiert Schlankheit.'),
    score('landmark-morph-fitting', 'dwarf', {
      identityFidelity: 0.7,
      silhouetteFidelity: 0.82,
      artifacts: 0.8,
      cost: 0.95,
      latency: 0.9,
      licenseFit: 1,
      runtimeComplexity: 0.75,
      reproducibility: 1,
      selfHostFit: 1,
    }, 'Compact Family + Build Morph; starke Silhouette.'),
    score('landmark-morph-fitting', 'gumo-like', {
      identityFidelity: 0.48,
      silhouetteFidelity: 0.55,
      artifacts: 0.7,
      cost: 0.95,
      latency: 0.9,
      licenseFit: 1,
      runtimeComplexity: 0.75,
      reproducibility: 1,
      selfHostFit: 1,
    }, 'Stark stilisiert: Morph allein unter Threshold → Fallback nötig.'),

    // texture-projection-bake
    score('texture-projection-bake', 'human', {
      identityFidelity: 0.8,
      silhouetteFidelity: 0.7,
      artifacts: 0.55,
      cost: 0.7,
      latency: 0.55,
      licenseFit: 1,
      runtimeComplexity: 0.45,
      reproducibility: 0.85,
      selfHostFit: 0.9,
    }, 'Höhere Look-Treue; Stretch/Seam-Artefakte an Ohren/Hals.'),
    score('texture-projection-bake', 'elf', {
      identityFidelity: 0.78,
      silhouetteFidelity: 0.68,
      artifacts: 0.5,
      cost: 0.7,
      latency: 0.55,
      licenseFit: 1,
      runtimeComplexity: 0.45,
      reproducibility: 0.85,
      selfHostFit: 0.9,
    }, 'Skin/Hair Projection gut; spitze Ohren brauchen Trait-Mesh.'),
    score('texture-projection-bake', 'dwarf', {
      identityFidelity: 0.76,
      silhouetteFidelity: 0.72,
      artifacts: 0.52,
      cost: 0.7,
      latency: 0.55,
      licenseFit: 1,
      runtimeComplexity: 0.45,
      reproducibility: 0.85,
      selfHostFit: 0.9,
    }, 'Bart/Haut Projection ok; Silhouette weiter Family-Morph.'),
    score('texture-projection-bake', 'gumo-like', {
      identityFidelity: 0.58,
      silhouetteFidelity: 0.5,
      artifacts: 0.4,
      cost: 0.7,
      latency: 0.55,
      licenseFit: 1,
      runtimeComplexity: 0.45,
      reproducibility: 0.85,
      selfHostFit: 0.9,
    }, 'Stil-Farben übertragbar; Form bleibt Family-Approximation.'),

    // material-trait-transfer
    score('material-trait-transfer', 'human', {
      identityFidelity: 0.55,
      silhouetteFidelity: 0.65,
      artifacts: 0.9,
      cost: 0.98,
      latency: 0.95,
      licenseFit: 1,
      runtimeComplexity: 0.9,
      reproducibility: 1,
      selfHostFit: 1,
    }, 'Colors/Traits/Materials schnell; wenig Face-Identität allein.'),
    score('material-trait-transfer', 'elf', {
      identityFidelity: 0.6,
      silhouetteFidelity: 0.7,
      artifacts: 0.9,
      cost: 0.98,
      latency: 0.95,
      licenseFit: 1,
      runtimeComplexity: 0.9,
      reproducibility: 1,
      selfHostFit: 1,
    }, 'Elf-Ohren/Haare als Traits = hohe Produktnähe.'),
    score('material-trait-transfer', 'dwarf', {
      identityFidelity: 0.58,
      silhouetteFidelity: 0.75,
      artifacts: 0.9,
      cost: 0.98,
      latency: 0.95,
      licenseFit: 1,
      runtimeComplexity: 0.9,
      reproducibility: 1,
      selfHostFit: 1,
    }, 'Bart/Outfit Traits + Compact Family.'),
    score('material-trait-transfer', 'gumo-like', {
      identityFidelity: 0.42,
      silhouetteFidelity: 0.45,
      artifacts: 0.88,
      cost: 0.98,
      latency: 0.95,
      licenseFit: 1,
      runtimeComplexity: 0.9,
      reproducibility: 1,
      selfHostFit: 1,
    }, 'Palette/Traits retten Look-Idee; Form nicht gumo-treu.'),

    // ai-assisted (must not be default)
    score('ai-assisted', 'human', {
      identityFidelity: 0.88,
      silhouetteFidelity: 0.85,
      artifacts: 0.7,
      cost: 0.25,
      latency: 0.2,
      licenseFit: 0.35,
      runtimeComplexity: 0.3,
      reproducibility: 0.25,
      selfHostFit: 0.2,
    }, 'Hohe Treue, aber Credits/ToS/Non-Determinismus — nicht Default.'),
    score('ai-assisted', 'elf', {
      identityFidelity: 0.86,
      silhouetteFidelity: 0.84,
      artifacts: 0.68,
      cost: 0.25,
      latency: 0.2,
      licenseFit: 0.35,
      runtimeComplexity: 0.3,
      reproducibility: 0.25,
      selfHostFit: 0.2,
    }, 'Provider-Look; Self-Host/Lizenz unfit für Default.'),
    score('ai-assisted', 'dwarf', {
      identityFidelity: 0.85,
      silhouetteFidelity: 0.83,
      artifacts: 0.68,
      cost: 0.25,
      latency: 0.2,
      licenseFit: 0.35,
      runtimeComplexity: 0.3,
      reproducibility: 0.25,
      selfHostFit: 0.2,
    }, 'Gleicher Ban: closed/non-repro.'),
    score('ai-assisted', 'gumo-like', {
      identityFidelity: 0.82,
      silhouetteFidelity: 0.8,
      artifacts: 0.65,
      cost: 0.25,
      latency: 0.2,
      licenseFit: 0.35,
      runtimeComplexity: 0.3,
      reproducibility: 0.25,
      selfHostFit: 0.2,
    }, 'Beste stilistische Treue — trotzdem nicht Default.'),
  ];

function score(
  approachId: IdentityTransferApproachId,
  fixtureId: IdentityTransferGoldenFixtureId,
  scores: IdentityTransferScoreRow,
  notesDe: string,
): IdentityTransferApproachScoreV1 {
  return {
    approachId,
    fixtureId,
    scores,
    aggregate: weightedAggregate(scores),
    notesDe,
  };
}

export function weightedAggregate(scores: IdentityTransferScoreRow): number {
  let sum = 0;
  let w = 0;
  for (const axis of Object.keys(IDENTITY_TRANSFER_SCORE_WEIGHTS) as IdentityTransferScoreAxis[]) {
    const weight = IDENTITY_TRANSFER_SCORE_WEIGHTS[axis];
    sum += scores[axis] * weight;
    w += weight;
  }
  return w > 0 ? Number((sum / w).toFixed(4)) : 0;
}

export function listScoresForApproach(
  approachId: IdentityTransferApproachId,
): readonly IdentityTransferApproachScoreV1[] {
  return IDENTITY_TRANSFER_GOLDEN_MATRIX_V1.filter((row) => row.approachId === approachId);
}

export function meanIdentityFidelity(
  approachId: IdentityTransferApproachId,
): number {
  const rows = listScoresForApproach(approachId);
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, row) => acc + row.scores.identityFidelity, 0);
  return Number((sum / rows.length).toFixed(4));
}

export function meanAggregate(
  approachId: IdentityTransferApproachId,
): number {
  const rows = listScoresForApproach(approachId);
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, row) => acc + row.aggregate, 0);
  return Number((sum / rows.length).toFixed(4));
}

/**
 * Canonical spike decision — default is composable local pipeline;
 * AI-assisted banned from default despite high fidelity.
 */
export function resolveIdentityTransferDecision(): IdentityTransferDecisionV1 {
  return {
    contractVersion: IDENTITY_TRANSFER_CONTRACT_VERSION,
    defaultApproachIds: [
      'landmark-morph-fitting',
      'material-trait-transfer',
      'texture-projection-bake',
    ],
    degradedFallbackApproachIds: [
      'landmark-morph-fitting',
      'material-trait-transfer',
    ],
    identityFidelityThreshold: IDENTITY_TRANSFER_IDENTITY_FIDELITY_THRESHOLD,
    bannedFromDefault: ['ai-assisted'],
    rationaleDe:
      'Default = Family-Morph-Fitting + Trait/Material Transfer, optional Texture Projection wenn Seam-Budget ok. ' +
      'AI-assisted bleibt optionaler Provider-Pfad (Credits/Lizenz/Non-Determinismus) und nie Default. ' +
      'Unter Identity-Threshold: Projection weglassen — nur Morph/Proportion + Colors/Materials/Traits.',
  };
}

/**
 * Concrete conversion plan for #263 — implement without further product decisions.
 */
export function buildIdentityTransferConversionPlan(): IdentityTransferConversionPlanV1 {
  const decision = resolveIdentityTransferDecision();
  return {
    contractVersion: IDENTITY_TRANSFER_CONTRACT_VERSION,
    targetFamilies: ['standard', 'compact', 'heavy'],
    inputs: [
      'sourceArtifactId (owner-scoped import/generate)',
      'structureAnalysisV2 (anatomy, modularity, bones)',
      'familyCompatibilityV1.recommendedFamily (or explicit targetFamily)',
      'source color/trait hints when present',
      'optional source albedo for projection',
    ],
    outputs: [
      'target bodyFamily ∈ {standard,compact,heavy}',
      'morphState approximation (SagaTreeAvatarMorphV1)',
      'traits + colors on CharacterAvatarDto',
      'optional projected albedo asset (owner-scoped) with bakeStatus',
      'conversionStatus: ready | degraded | failed',
      'capabilities remain empty until authoritative rig analysis',
    ],
    steps: [
      '1. Resolve targetFamily from compatibility (never invent; fail-closed custom → skip conversion UI path).',
      '2. Load canonical base body for targetFamily.',
      '3. landmark-morph-fitting: map source proportions/landmarks → morph sliders (bounded).',
      '4. material-trait-transfer: apply palette + nearest content-pack traits (ears/hair/clothing).',
      '5. If mean projected identity estimate ≥ threshold and albedo present: texture-projection-bake onto family UVs; else skip bake.',
      '6. Persist composition axes + morph/traits; do not write capabilities.',
      '7. Hand off to shared capability editor (same as Import Original).',
    ],
    degradedFallbackSteps: [
      '1. Keep targetFamily from step 1 (or compact/standard heuristic only when humanoid proportions exist).',
      '2. Apply landmark-morph-fitting with wider clamps (silhouette over face identity).',
      '3. Apply material-trait-transfer only (no texture bake).',
      '4. Set conversionStatus=degraded + DE limitation copy; never prompt the user.',
      '5. Custom creature sources: mark anatomy humanoid-interpretation; never claim lossless.',
    ],
    customCreaturePolicyDe:
      'Custom Creature Conversion ist eine humanoide Interpretation auf Standard/Compact/Heavy — ' +
      'keine verlustfreie Normalisierung. Ohne ausreichende Landmark-Evidenz → degraded Fallback.',
  };
}

/** Select pipeline for a fixture based on measured identity fidelity of morph fitting. */
export function selectTransferPipelineForFixture(
  fixtureId: IdentityTransferGoldenFixtureId,
): {
  mode: 'default' | 'degraded';
  approachIds: readonly IdentityTransferApproachId[];
} {
  const decision = resolveIdentityTransferDecision();
  const morphRow = IDENTITY_TRANSFER_GOLDEN_MATRIX_V1.find(
    (row) =>
      row.approachId === 'landmark-morph-fitting' && row.fixtureId === fixtureId,
  );
  const fidelity = morphRow?.scores.identityFidelity ?? 0;
  if (fidelity >= decision.identityFidelityThreshold) {
    return { mode: 'default', approachIds: decision.defaultApproachIds };
  }
  return { mode: 'degraded', approachIds: decision.degradedFallbackApproachIds };
}

export function assertIdentityTransferInvariants(): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const decision = resolveIdentityTransferDecision();
  const plan = buildIdentityTransferConversionPlan();

  if (IDENTITY_TRANSFER_GOLDEN_FIXTURE_IDS.length < 4) {
    issues.push('need ≥4 golden fixtures');
  }
  const approaches = new Set(
    IDENTITY_TRANSFER_GOLDEN_MATRIX_V1.map((r) => r.approachId),
  );
  if (approaches.size < 3) {
    issues.push('need ≥3 approaches in matrix');
  }
  for (const approachId of IDENTITY_TRANSFER_APPROACH_IDS) {
    for (const fixtureId of IDENTITY_TRANSFER_GOLDEN_FIXTURE_IDS) {
      const hit = IDENTITY_TRANSFER_GOLDEN_MATRIX_V1.find(
        (r) => r.approachId === approachId && r.fixtureId === fixtureId,
      );
      if (!hit) issues.push(`missing matrix cell ${approachId}/${fixtureId}`);
    }
  }
  if (decision.bannedFromDefault.includes('ai-assisted') === false) {
    issues.push('ai-assisted must be banned from default');
  }
  if (decision.defaultApproachIds.includes('ai-assisted')) {
    issues.push('ai-assisted must not be in defaultApproachIds');
  }
  if (!decision.defaultApproachIds.includes('landmark-morph-fitting')) {
    issues.push('default must include landmark-morph-fitting');
  }
  if (!decision.defaultApproachIds.includes('material-trait-transfer')) {
    issues.push('default must include material-trait-transfer');
  }
  if (plan.steps.length < 5) {
    issues.push('conversion plan needs concrete steps');
  }
  if (plan.degradedFallbackSteps.length < 3) {
    issues.push('degraded fallback steps required');
  }
  const gumo = selectTransferPipelineForFixture('gumo-like');
  if (gumo.mode !== 'degraded') {
    issues.push('gumo-like must select degraded pipeline');
  }
  const human = selectTransferPipelineForFixture('human');
  if (human.mode !== 'default') {
    issues.push('human must select default pipeline');
  }
  // Weight sum sanity
  const wSum = Object.values(IDENTITY_TRANSFER_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
  if (Math.abs(wSum - 1) > 0.001) {
    issues.push(`weights must sum to 1, got ${wSum}`);
  }

  return { ok: issues.length === 0, issues };
}
