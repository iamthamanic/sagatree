/**
 * Avatar V2 Modular Generate Decomposition — pure domain (#268 / Epic #248; promoted #323).
 * Location: src/domains/character/avatar/modular-generate-decomposition-v1.ts
 *
 * Encodes approach comparison + default/degraded pipeline for #269.
 * Provider part-split is adapter-only — never a domain capability claim.
 * No React / Three / backend clients / live provider calls.
 */

export const MODULAR_GENERATE_DECOMPOSITION_VERSION =
  'SagaTreeModularGenerateDecompositionV1' as const;

export const MODULAR_GENERATE_GOLDEN_FIXTURE_IDS = [
  'human',
  'elf',
  'dwarf',
  'gumo-like',
  'outfit-shirt-pants-boots-prop',
] as const;
export type ModularGenerateGoldenFixtureId =
  (typeof MODULAR_GENERATE_GOLDEN_FIXTURE_IDS)[number];

/**
 * Evaluated orchestration approaches.
 * `provider-part-split` may be used by adapters but is banned from domain default.
 * `full-mesh-autosplit` is scored but never marks blob as full modular.
 */
export const MODULAR_GENERATE_APPROACH_IDS = [
  'vision-parse-library-body-catalog-wearables',
  'generate-body-only-catalog-wearables',
  'full-mesh-autosplit',
  'provider-part-split',
  'free-form-blob',
] as const;
export type ModularGenerateApproachId =
  (typeof MODULAR_GENERATE_APPROACH_IDS)[number];

export type ModularGenerateScoreAxis =
  | 'editability'
  | 'wardrobeSeparability'
  | 'identityFidelity'
  | 'cost'
  | 'latency'
  | 'licenseFit'
  | 'reproducibility'
  | 'selfHostFit'
  | 'complexity';

export type ModularGenerateScoreRow = Readonly<
  Record<ModularGenerateScoreAxis, number>
>;

export interface ModularGenerateMatrixCellV1 {
  approachId: ModularGenerateApproachId;
  fixtureId: ModularGenerateGoldenFixtureId;
  scores: ModularGenerateScoreRow;
  aggregate: number;
  outcome: 'viable' | 'limited' | 'unsuitable';
  notesDe: string;
}

export type ModularGenerateRoleId =
  | 'base-body'
  | 'identity'
  | 'traits'
  | 'skinned-wearable'
  | 'rigid-prop';

export type ModularGenerateRoleSource =
  | 'library-preset'
  | 'generate'
  | 'identity-transfer'
  | 'catalog'
  | 'skip';

export interface ModularGenerateRolePlanV1 {
  role: ModularGenerateRoleId;
  source: ModularGenerateRoleSource;
  required: boolean;
  notesDe: string;
}

export interface ModularGenerateJobGraphV1 {
  contractVersion: typeof MODULAR_GENERATE_DECOMPOSITION_VERSION;
  /** Ordered job stages for #269 — concrete, not open R&D. */
  stages: readonly {
    stageId: string;
    role: ModularGenerateRoleId | 'orchestrate' | 'analyze';
    retryable: boolean;
    failureMode: 'abort' | 'degrade' | 'skip-role';
  }[];
  /** Cost/retry semantics: no automatic paid retry storm. */
  maxPaidRetriesPerStage: 0 | 1;
  costConfirmRequired: true;
}

export interface ModularGenerateDecompositionDecisionV1 {
  contractVersion: typeof MODULAR_GENERATE_DECOMPOSITION_VERSION;
  defaultApproachId: ModularGenerateApproachId;
  degradedFallbackApproachId: ModularGenerateApproachId;
  bannedFromDefault: readonly ModularGenerateApproachId[];
  /** Never mark a clothed blob as full modular. */
  forbidFullModularFromBlob: true;
  unusualAnatomyDegradesTo: 'free-form';
  propsSeparatedFromSkinnedWearables: true;
  rolePlan: readonly ModularGenerateRolePlanV1[];
  jobGraph: ModularGenerateJobGraphV1;
  rationaleDe: string;
}

const SCORE_WEIGHTS: Readonly<Record<ModularGenerateScoreAxis, number>> = {
  editability: 0.18,
  wardrobeSeparability: 0.16,
  identityFidelity: 0.14,
  cost: 0.1,
  latency: 0.08,
  licenseFit: 0.1,
  reproducibility: 0.12,
  selfHostFit: 0.08,
  complexity: 0.04,
};

function weightedAggregate(scores: ModularGenerateScoreRow): number {
  let sum = 0;
  for (const axis of Object.keys(SCORE_WEIGHTS) as ModularGenerateScoreAxis[]) {
    sum += scores[axis] * SCORE_WEIGHTS[axis];
  }
  return Math.round(sum * 1000) / 1000;
}

function cell(
  approachId: ModularGenerateApproachId,
  fixtureId: ModularGenerateGoldenFixtureId,
  scores: ModularGenerateScoreRow,
  outcome: ModularGenerateMatrixCellV1['outcome'],
  notesDe: string,
): ModularGenerateMatrixCellV1 {
  return {
    approachId,
    fixtureId,
    scores,
    aggregate: weightedAggregate(scores),
    outcome,
    notesDe,
  };
}

/** Deterministic golden matrix — controlled fixtures only. */
export const MODULAR_GENERATE_DECOMPOSITION_MATRIX_V1: readonly ModularGenerateMatrixCellV1[] =
  [
    cell(
      'vision-parse-library-body-catalog-wearables',
      'human',
      {
        editability: 0.92,
        wardrobeSeparability: 0.9,
        identityFidelity: 0.78,
        cost: 0.75,
        latency: 0.7,
        licenseFit: 0.95,
        reproducibility: 0.92,
        selfHostFit: 0.85,
        complexity: 0.7,
      },
      'viable',
      'Vision/semantic → kanonischer Body + Katalog-Wearables.',
    ),
    cell(
      'vision-parse-library-body-catalog-wearables',
      'elf',
      {
        editability: 0.9,
        wardrobeSeparability: 0.88,
        identityFidelity: 0.76,
        cost: 0.74,
        latency: 0.68,
        licenseFit: 0.95,
        reproducibility: 0.9,
        selfHostFit: 0.85,
        complexity: 0.68,
      },
      'viable',
      'Species-Preset + Identity-Transfer; Wearables katalogisch.',
    ),
    cell(
      'vision-parse-library-body-catalog-wearables',
      'dwarf',
      {
        editability: 0.88,
        wardrobeSeparability: 0.86,
        identityFidelity: 0.74,
        cost: 0.74,
        latency: 0.68,
        licenseFit: 0.95,
        reproducibility: 0.9,
        selfHostFit: 0.85,
        complexity: 0.66,
      },
      'viable',
      'Compact family path; Props getrennt.',
    ),
    cell(
      'vision-parse-library-body-catalog-wearables',
      'gumo-like',
      {
        editability: 0.35,
        wardrobeSeparability: 0.4,
        identityFidelity: 0.55,
        cost: 0.7,
        latency: 0.7,
        licenseFit: 0.95,
        reproducibility: 0.88,
        selfHostFit: 0.85,
        complexity: 0.6,
      },
      'limited',
      'Ungewöhnliche Anatomie → Freie Form, nicht falsche Family.',
    ),
    cell(
      'vision-parse-library-body-catalog-wearables',
      'outfit-shirt-pants-boots-prop',
      {
        editability: 0.9,
        wardrobeSeparability: 0.92,
        identityFidelity: 0.72,
        cost: 0.72,
        latency: 0.65,
        licenseFit: 0.95,
        reproducibility: 0.9,
        selfHostFit: 0.85,
        complexity: 0.65,
      },
      'viable',
      'Shirt/Pants/Boots aus Katalog; Prop rigid separat.',
    ),
    cell(
      'generate-body-only-catalog-wearables',
      'human',
      {
        editability: 0.8,
        wardrobeSeparability: 0.88,
        identityFidelity: 0.7,
        cost: 0.55,
        latency: 0.55,
        licenseFit: 0.8,
        reproducibility: 0.75,
        selfHostFit: 0.6,
        complexity: 0.55,
      },
      'viable',
      'Body generieren + Katalog-Kleidung — teurer, brauchbar.',
    ),
    cell(
      'generate-body-only-catalog-wearables',
      'outfit-shirt-pants-boots-prop',
      {
        editability: 0.78,
        wardrobeSeparability: 0.9,
        identityFidelity: 0.68,
        cost: 0.5,
        latency: 0.5,
        licenseFit: 0.8,
        reproducibility: 0.72,
        selfHostFit: 0.58,
        complexity: 0.52,
      },
      'viable',
      'Outfit bleibt katalogisch — gute Separabilität.',
    ),
    cell(
      'full-mesh-autosplit',
      'outfit-shirt-pants-boots-prop',
      {
        editability: 0.4,
        wardrobeSeparability: 0.35,
        identityFidelity: 0.65,
        cost: 0.45,
        latency: 0.5,
        licenseFit: 0.7,
        reproducibility: 0.4,
        selfHostFit: 0.45,
        complexity: 0.25,
      },
      'unsuitable',
      'Auto-Split allein unzuverlässig — nie full modular markieren.',
    ),
    cell(
      'full-mesh-autosplit',
      'human',
      {
        editability: 0.42,
        wardrobeSeparability: 0.38,
        identityFidelity: 0.62,
        cost: 0.48,
        latency: 0.52,
        licenseFit: 0.7,
        reproducibility: 0.42,
        selfHostFit: 0.45,
        complexity: 0.28,
      },
      'unsuitable',
      'Bekleideter Blob bleibt limited/monolithic bis validiert.',
    ),
    cell(
      'provider-part-split',
      'human',
      {
        editability: 0.7,
        wardrobeSeparability: 0.75,
        identityFidelity: 0.7,
        cost: 0.5,
        latency: 0.55,
        licenseFit: 0.55,
        reproducibility: 0.5,
        selfHostFit: 0.35,
        complexity: 0.45,
      },
      'limited',
      'Adapter-Capability nur — kein Domain-Contract.',
    ),
    cell(
      'provider-part-split',
      'outfit-shirt-pants-boots-prop',
      {
        editability: 0.68,
        wardrobeSeparability: 0.72,
        identityFidelity: 0.68,
        cost: 0.48,
        latency: 0.52,
        licenseFit: 0.55,
        reproducibility: 0.48,
        selfHostFit: 0.35,
        complexity: 0.42,
      },
      'limited',
      'Vendor-Split darf Rollen nicht autoritativ setzen.',
    ),
    cell(
      'free-form-blob',
      'gumo-like',
      {
        editability: 0.2,
        wardrobeSeparability: 0.15,
        identityFidelity: 0.8,
        cost: 0.7,
        latency: 0.75,
        licenseFit: 0.8,
        reproducibility: 0.85,
        selfHostFit: 0.7,
        complexity: 0.85,
      },
      'viable',
      'Ehrliche Freie Form — Custom Creature Original Pfad.',
    ),
    cell(
      'free-form-blob',
      'human',
      {
        editability: 0.25,
        wardrobeSeparability: 0.2,
        identityFidelity: 0.82,
        cost: 0.72,
        latency: 0.78,
        licenseFit: 0.8,
        reproducibility: 0.85,
        selfHostFit: 0.7,
        complexity: 0.88,
      },
      'limited',
      'Für kanonisch editierbar ungeeignet — nur Degrade-Pfad.',
    ),
  ];

function buildDefaultRolePlan(): readonly ModularGenerateRolePlanV1[] {
  return [
    {
      role: 'base-body',
      source: 'library-preset',
      required: true,
      notesDe: 'SagaTree Base Body der gewählten Family.',
    },
    {
      role: 'identity',
      source: 'identity-transfer',
      required: true,
      notesDe: 'Look via #262/#263 Transfer auf kanonischen Body.',
    },
    {
      role: 'traits',
      source: 'library-preset',
      required: false,
      notesDe: 'Species-/Trait-Slots aus Katalog wo möglich.',
    },
    {
      role: 'skinned-wearable',
      source: 'catalog',
      required: false,
      notesDe: 'Shirt/Pants/Boots etc. separat — nie aus Blob erfinden.',
    },
    {
      role: 'rigid-prop',
      source: 'catalog',
      required: false,
      notesDe: 'Props getrennt von skinned Wearables.',
    },
  ];
}

function buildJobGraph(): ModularGenerateJobGraphV1 {
  return {
    contractVersion: MODULAR_GENERATE_DECOMPOSITION_VERSION,
    stages: [
      {
        stageId: 'parse-intent',
        role: 'orchestrate',
        retryable: true,
        failureMode: 'abort',
      },
      {
        stageId: 'resolve-body-family',
        role: 'base-body',
        retryable: false,
        failureMode: 'degrade',
      },
      {
        stageId: 'materialize-base-body',
        role: 'base-body',
        retryable: false,
        failureMode: 'abort',
      },
      {
        stageId: 'transfer-identity',
        role: 'identity',
        retryable: true,
        failureMode: 'degrade',
      },
      {
        stageId: 'apply-traits',
        role: 'traits',
        retryable: false,
        failureMode: 'skip-role',
      },
      {
        stageId: 'attach-wearables',
        role: 'skinned-wearable',
        retryable: false,
        failureMode: 'skip-role',
      },
      {
        stageId: 'attach-props',
        role: 'rigid-prop',
        retryable: false,
        failureMode: 'skip-role',
      },
      {
        stageId: 'structure-analyze',
        role: 'analyze',
        retryable: true,
        failureMode: 'degrade',
      },
    ],
    maxPaidRetriesPerStage: 1,
    costConfirmRequired: true,
  };
}

export function resolveModularGenerateDecompositionDecision(): ModularGenerateDecompositionDecisionV1 {
  return {
    contractVersion: MODULAR_GENERATE_DECOMPOSITION_VERSION,
    defaultApproachId: 'vision-parse-library-body-catalog-wearables',
    degradedFallbackApproachId: 'generate-body-only-catalog-wearables',
    bannedFromDefault: ['provider-part-split', 'full-mesh-autosplit', 'free-form-blob'],
    forbidFullModularFromBlob: true,
    unusualAnatomyDegradesTo: 'free-form',
    propsSeparatedFromSkinnedWearables: true,
    rolePlan: buildDefaultRolePlan(),
    jobGraph: buildJobGraph(),
    rationaleDe:
      'Default: Vision/semantic Parse → kanonischer Library-Body → Identity-Transfer → ' +
      'Katalog-Wearables/Props. Auto-Split und Provider-Part-Split sind kein Domain-Default. ' +
      'Bekleideter Blob darf nie als full modular markiert werden; ungewöhnliche Anatomie → Freie Form.',
  };
}

/** Handoff contract for #269 — closed decisions only. */
export function buildModularGenerateHandoffFor269(): {
  defaultApproachId: ModularGenerateApproachId;
  degradedFallbackApproachId: ModularGenerateApproachId;
  rolePlan: readonly ModularGenerateRolePlanV1[];
  jobGraph: ModularGenerateJobGraphV1;
  forbidFullModularFromBlob: true;
} {
  const d = resolveModularGenerateDecompositionDecision();
  return {
    defaultApproachId: d.defaultApproachId,
    degradedFallbackApproachId: d.degradedFallbackApproachId,
    rolePlan: d.rolePlan,
    jobGraph: d.jobGraph,
    forbidFullModularFromBlob: true,
  };
}

export function assertModularGenerateDecompositionInvariants(): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const d = resolveModularGenerateDecompositionDecision();
  if (d.defaultApproachId !== 'vision-parse-library-body-catalog-wearables') {
    issues.push('default approach');
  }
  if (d.degradedFallbackApproachId !== 'generate-body-only-catalog-wearables') {
    issues.push('degraded fallback');
  }
  if (!d.forbidFullModularFromBlob) issues.push('forbid blob modular');
  if (d.unusualAnatomyDegradesTo !== 'free-form') issues.push('unusual→free-form');
  if (!d.propsSeparatedFromSkinnedWearables) issues.push('props separated');
  if (d.bannedFromDefault.includes(d.defaultApproachId)) {
    issues.push('default banned');
  }
  if (d.rolePlan.length < 4) issues.push('role plan thin');
  if (d.jobGraph.stages.length < 6) issues.push('job graph thin');
  if (d.jobGraph.costConfirmRequired !== true) issues.push('cost confirm');

  const fixtures = new Set(MODULAR_GENERATE_DECOMPOSITION_MATRIX_V1.map((c) => c.fixtureId));
  for (const id of MODULAR_GENERATE_GOLDEN_FIXTURE_IDS) {
    if (!fixtures.has(id)) issues.push(`missing fixture ${id}`);
  }
  const approaches = new Set(MODULAR_GENERATE_DECOMPOSITION_MATRIX_V1.map((c) => c.approachId));
  if (approaches.size < 4) issues.push('need ≥4 approaches');

  const autosplit = MODULAR_GENERATE_DECOMPOSITION_MATRIX_V1.filter(
    (c) => c.approachId === 'full-mesh-autosplit',
  );
  if (autosplit.some((c) => c.outcome === 'viable')) {
    issues.push('autosplit must not be viable default');
  }

  const handoff = buildModularGenerateHandoffFor269();
  if (handoff.defaultApproachId !== d.defaultApproachId) issues.push('handoff mismatch');

  return { ok: issues.length === 0, issues };
}
