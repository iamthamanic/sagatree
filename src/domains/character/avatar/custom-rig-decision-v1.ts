/**
 * Avatar V2 Custom Rig Decision — pure domain path matrix (#265 / Epic #248; promoted #323).
 * Location: src/domains/character/avatar/custom-rig-decision-v1.ts
 *
 * Reproducible provider/path comparison for Humanoid vs Custom Creature.
 * Provider success never elevates capabilities — Analyzer/Revalidation owns that.
 * No React / Three / backend clients / live GPU calls.
 */

import type { AvatarRigProfileKindV2 } from './rig-capability-contract-v2';
import type { AvatarRiggingProviderId } from './rigging-provider-contract';

export const CUSTOM_RIG_BENCHMARK_CONTRACT_VERSION =
  'SagaTreeCustomRigBenchmarkV1' as const;

/** Golden fixtures for the rigging decision matrix (controlled assets only). */
export const CUSTOM_RIG_BENCHMARK_FIXTURE_IDS = [
  'human',
  'dwarf',
  'gumo-like',
  'faruk-like',
  'alien',
] as const;
export type CustomRigBenchmarkFixtureId =
  (typeof CUSTOM_RIG_BENCHMARK_FIXTURE_IDS)[number];

/**
 * Evaluated paths.
 * `unirig-prior-art` = researched prior art (not a SagaTree adapter yet).
 * `import-existing-rig` = keep imported skeleton (no auto-rig).
 * `generate-rig` = provider-specific Meshy remesh+auto-rig infrastructure capability.
 */
export const CUSTOM_RIG_BENCHMARK_PATH_IDS = [
  'meshy-full-rig',
  'meshy-generate-rig',
  'skintokens-full-rig',
  'skintokens-existing-skeleton',
  'unirig-prior-art',
  'import-existing-rig',
] as const;
export type CustomRigBenchmarkPathId =
  (typeof CUSTOM_RIG_BENCHMARK_PATH_IDS)[number];

export type CustomRigBenchmarkScoreAxis =
  | 'skeletonSemantics'
  | 'skinWeights'
  | 'animationStability'
  | 'runtimeCost'
  | 'hardwareFit'
  | 'licenseFit'
  | 'reproducibility'
  | 'selfHostFit'
  | 'failureModeClarity';

/** Higher is better on all axes (runtime/hardware inverted upstream). */
export type CustomRigBenchmarkScoreRow = Readonly<
  Record<CustomRigBenchmarkScoreAxis, number>
>;

export interface CustomRigBenchmarkCellV1 {
  pathId: CustomRigBenchmarkPathId;
  fixtureId: CustomRigBenchmarkFixtureId;
  profileKind: AvatarRigProfileKindV2;
  scores: CustomRigBenchmarkScoreRow;
  aggregate: number;
  /** Product outcome if this path were chosen alone. */
  outcome: 'viable' | 'limited' | 'unavailable' | 'unsuitable';
  notesDe: string;
}

export interface CustomRigProfileStrategyV1 {
  profileKind: AvatarRigProfileKindV2;
  defaultPathId: CustomRigBenchmarkPathId;
  fallbackPathIds: readonly CustomRigBenchmarkPathId[];
  /** Auto-rig may stay optional when quality is insufficient. */
  autoRigOptional: boolean;
  rationaleDe: string;
}

export interface CustomRigBenchmarkDecisionV1 {
  contractVersion: typeof CUSTOM_RIG_BENCHMARK_CONTRACT_VERSION;
  strategies: readonly CustomRigProfileStrategyV1[];
  /** Paths that must never set capabilities from provider success alone. */
  capabilitiesAlwaysPending: true;
  /** SkinTokens self-host worker status for this spike. */
  skintokensWorkerStatus: 'unavailable' | 'optional-adapter';
  skintokensWorkerNotesDe: string;
}

export const CUSTOM_RIG_BENCHMARK_SCORE_WEIGHTS: Readonly<
  Record<CustomRigBenchmarkScoreAxis, number>
> = {
  skeletonSemantics: 0.16,
  skinWeights: 0.16,
  animationStability: 0.14,
  runtimeCost: 0.1,
  hardwareFit: 0.08,
  licenseFit: 0.1,
  reproducibility: 0.1,
  selfHostFit: 0.08,
  failureModeClarity: 0.08,
};

const FIXTURE_PROFILE: Record<
  CustomRigBenchmarkFixtureId,
  AvatarRigProfileKindV2
> = {
  human: 'humanoid',
  dwarf: 'humanoid',
  alien: 'humanoid',
  'gumo-like': 'custom-creature',
  'faruk-like': 'custom-creature',
};

export function weightedRigAggregate(scores: CustomRigBenchmarkScoreRow): number {
  let sum = 0;
  let w = 0;
  for (const axis of Object.keys(
    CUSTOM_RIG_BENCHMARK_SCORE_WEIGHTS,
  ) as CustomRigBenchmarkScoreAxis[]) {
    const weight = CUSTOM_RIG_BENCHMARK_SCORE_WEIGHTS[axis];
    sum += scores[axis] * weight;
    w += weight;
  }
  return w > 0 ? Number((sum / w).toFixed(4)) : 0;
}

function cell(
  pathId: CustomRigBenchmarkPathId,
  fixtureId: CustomRigBenchmarkFixtureId,
  scores: CustomRigBenchmarkScoreRow,
  outcome: CustomRigBenchmarkCellV1['outcome'],
  notesDe: string,
): CustomRigBenchmarkCellV1 {
  return {
    pathId,
    fixtureId,
    profileKind: FIXTURE_PROFILE[fixtureId],
    scores,
    aggregate: weightedRigAggregate(scores),
    outcome,
    notesDe,
  };
}

/**
 * Deterministic lab matrix — no live provider calls in CI.
 * Scores reflect spike evaluation of available adapters + prior-art research.
 */
export const CUSTOM_RIG_BENCHMARK_MATRIX_V1: readonly CustomRigBenchmarkCellV1[] = [
  // meshy-full-rig
  cell('meshy-full-rig', 'human', {
    skeletonSemantics: 0.88, skinWeights: 0.82, animationStability: 0.8,
    runtimeCost: 0.45, hardwareFit: 0.55, licenseFit: 0.55,
    reproducibility: 0.55, selfHostFit: 0.2, failureModeClarity: 0.7,
  }, 'viable', 'Humanoide Meshy Auto-Rig gut; Credits/Cloud; Output immer re-analysieren.'),
  cell('meshy-full-rig', 'dwarf', {
    skeletonSemantics: 0.85, skinWeights: 0.78, animationStability: 0.78,
    runtimeCost: 0.45, hardwareFit: 0.55, licenseFit: 0.55,
    reproducibility: 0.55, selfHostFit: 0.2, failureModeClarity: 0.7,
  }, 'viable', 'Compact-Proportionen ok; Skinweights an Beinen gelegentlich limited.'),
  cell('meshy-full-rig', 'alien', {
    skeletonSemantics: 0.72, skinWeights: 0.7, animationStability: 0.68,
    runtimeCost: 0.45, hardwareFit: 0.55, licenseFit: 0.55,
    reproducibility: 0.55, selfHostFit: 0.2, failureModeClarity: 0.65,
  }, 'limited', 'Stilisiert humanoid — oft limited nach Analyzer.'),
  cell('meshy-full-rig', 'gumo-like', {
    skeletonSemantics: 0.35, skinWeights: 0.4, animationStability: 0.35,
    runtimeCost: 0.45, hardwareFit: 0.55, licenseFit: 0.55,
    reproducibility: 0.55, selfHostFit: 0.2, failureModeClarity: 0.75,
  }, 'unsuitable', 'Custom Form → falsche Humanoid-Bones; nicht Default.'),
  cell('meshy-full-rig', 'faruk-like', {
    skeletonSemantics: 0.3, skinWeights: 0.35, animationStability: 0.3,
    runtimeCost: 0.45, hardwareFit: 0.55, licenseFit: 0.55,
    reproducibility: 0.55, selfHostFit: 0.2, failureModeClarity: 0.75,
  }, 'unsuitable', 'Schnecken-/Faruk-Anatomie: Auto-Rig erfindet Humanoid — fail.'),

  // meshy-generate-rig (infra remesh+rig on generate path)
  cell('meshy-generate-rig', 'human', {
    skeletonSemantics: 0.86, skinWeights: 0.8, animationStability: 0.78,
    runtimeCost: 0.4, hardwareFit: 0.5, licenseFit: 0.55,
    reproducibility: 0.5, selfHostFit: 0.2, failureModeClarity: 0.68,
  }, 'viable', 'Generate-Pipeline Remesh+Rig; provider-spezifisch, nicht Domain-Begriff.'),
  cell('meshy-generate-rig', 'dwarf', {
    skeletonSemantics: 0.82, skinWeights: 0.76, animationStability: 0.75,
    runtimeCost: 0.4, hardwareFit: 0.5, licenseFit: 0.55,
    reproducibility: 0.5, selfHostFit: 0.2, failureModeClarity: 0.68,
  }, 'viable', 'Wie full-rig für humanoide Generate-Ergebnisse.'),
  cell('meshy-generate-rig', 'alien', {
    skeletonSemantics: 0.7, skinWeights: 0.68, animationStability: 0.65,
    runtimeCost: 0.4, hardwareFit: 0.5, licenseFit: 0.55,
    reproducibility: 0.5, selfHostFit: 0.2, failureModeClarity: 0.65,
  }, 'limited', 'Generate-Rig oft limited nach Revalidation.'),
  cell('meshy-generate-rig', 'gumo-like', {
    skeletonSemantics: 0.32, skinWeights: 0.38, animationStability: 0.32,
    runtimeCost: 0.4, hardwareFit: 0.5, licenseFit: 0.55,
    reproducibility: 0.5, selfHostFit: 0.2, failureModeClarity: 0.72,
  }, 'unsuitable', 'Generate-Rig erzwingt Humanoid — Custom bleibt Original-Rig.'),
  cell('meshy-generate-rig', 'faruk-like', {
    skeletonSemantics: 0.28, skinWeights: 0.32, animationStability: 0.28,
    runtimeCost: 0.4, hardwareFit: 0.5, licenseFit: 0.55,
    reproducibility: 0.5, selfHostFit: 0.2, failureModeClarity: 0.72,
  }, 'unsuitable', 'Nicht für Custom Creature Default.'),

  // skintokens-full-rig
  cell('skintokens-full-rig', 'human', {
    skeletonSemantics: 0.8, skinWeights: 0.78, animationStability: 0.75,
    runtimeCost: 0.7, hardwareFit: 0.45, licenseFit: 0.85,
    reproducibility: 0.7, selfHostFit: 0.75, failureModeClarity: 0.7,
  }, 'unavailable', 'Self-host Worker in diesem Spike unavailable — Adapter stub only.'),
  cell('skintokens-full-rig', 'dwarf', {
    skeletonSemantics: 0.78, skinWeights: 0.75, animationStability: 0.72,
    runtimeCost: 0.7, hardwareFit: 0.45, licenseFit: 0.85,
    reproducibility: 0.7, selfHostFit: 0.75, failureModeClarity: 0.7,
  }, 'unavailable', 'Gleicher Worker-Status.'),
  cell('skintokens-full-rig', 'alien', {
    skeletonSemantics: 0.65, skinWeights: 0.62, animationStability: 0.6,
    runtimeCost: 0.7, hardwareFit: 0.45, licenseFit: 0.85,
    reproducibility: 0.7, selfHostFit: 0.75, failureModeClarity: 0.68,
  }, 'unavailable', 'Worker unavailable.'),
  cell('skintokens-full-rig', 'gumo-like', {
    skeletonSemantics: 0.45, skinWeights: 0.42, animationStability: 0.4,
    runtimeCost: 0.7, hardwareFit: 0.45, licenseFit: 0.85,
    reproducibility: 0.7, selfHostFit: 0.75, failureModeClarity: 0.7,
  }, 'unavailable', 'Prior art hoffnungsvoll für Custom — Worker fehlt.'),
  cell('skintokens-full-rig', 'faruk-like', {
    skeletonSemantics: 0.42, skinWeights: 0.4, animationStability: 0.38,
    runtimeCost: 0.7, hardwareFit: 0.45, licenseFit: 0.85,
    reproducibility: 0.7, selfHostFit: 0.75, failureModeClarity: 0.7,
  }, 'unavailable', 'Nicht produktiv bis Worker optional-adapter.'),

  // skintokens-existing-skeleton
  cell('skintokens-existing-skeleton', 'human', {
    skeletonSemantics: 0.9, skinWeights: 0.85, animationStability: 0.82,
    runtimeCost: 0.8, hardwareFit: 0.5, licenseFit: 0.85,
    reproducibility: 0.75, selfHostFit: 0.75, failureModeClarity: 0.75,
  }, 'unavailable', 'Existing-skeleton mode: Worker unavailable unless enabled.'),
  cell('skintokens-existing-skeleton', 'dwarf', {
    skeletonSemantics: 0.88, skinWeights: 0.82, animationStability: 0.8,
    runtimeCost: 0.8, hardwareFit: 0.5, licenseFit: 0.85,
    reproducibility: 0.75, selfHostFit: 0.75, failureModeClarity: 0.75,
  }, 'unavailable', 'Worker unavailable.'),
  cell('skintokens-existing-skeleton', 'alien', {
    skeletonSemantics: 0.75, skinWeights: 0.7, animationStability: 0.68,
    runtimeCost: 0.8, hardwareFit: 0.5, licenseFit: 0.85,
    reproducibility: 0.75, selfHostFit: 0.75, failureModeClarity: 0.72,
  }, 'unavailable', 'Worker unavailable.'),
  cell('skintokens-existing-skeleton', 'gumo-like', {
    skeletonSemantics: 0.7, skinWeights: 0.65, animationStability: 0.62,
    runtimeCost: 0.8, hardwareFit: 0.5, licenseFit: 0.85,
    reproducibility: 0.75, selfHostFit: 0.75, failureModeClarity: 0.78,
  }, 'unavailable', 'Beste SkinTokens-Idee für Custom — blocked by unavailable.'),
  cell('skintokens-existing-skeleton', 'faruk-like', {
    skeletonSemantics: 0.68, skinWeights: 0.62, animationStability: 0.6,
    runtimeCost: 0.8, hardwareFit: 0.5, licenseFit: 0.85,
    reproducibility: 0.75, selfHostFit: 0.75, failureModeClarity: 0.78,
  }, 'unavailable', 'Worker unavailable → Fallback Import-Existing.'),

  // unirig-prior-art (research only)
  cell('unirig-prior-art', 'human', {
    skeletonSemantics: 0.75, skinWeights: 0.7, animationStability: 0.68,
    runtimeCost: 0.55, hardwareFit: 0.4, licenseFit: 0.5,
    reproducibility: 0.4, selfHostFit: 0.45, failureModeClarity: 0.55,
  }, 'unavailable', 'Prior art UniRig — kein SagaTree-Adapter; nicht Default.'),
  cell('unirig-prior-art', 'dwarf', {
    skeletonSemantics: 0.72, skinWeights: 0.68, animationStability: 0.65,
    runtimeCost: 0.55, hardwareFit: 0.4, licenseFit: 0.5,
    reproducibility: 0.4, selfHostFit: 0.45, failureModeClarity: 0.55,
  }, 'unavailable', 'Research only.'),
  cell('unirig-prior-art', 'alien', {
    skeletonSemantics: 0.6, skinWeights: 0.55, animationStability: 0.52,
    runtimeCost: 0.55, hardwareFit: 0.4, licenseFit: 0.5,
    reproducibility: 0.4, selfHostFit: 0.45, failureModeClarity: 0.55,
  }, 'unavailable', 'Research only.'),
  cell('unirig-prior-art', 'gumo-like', {
    skeletonSemantics: 0.55, skinWeights: 0.5, animationStability: 0.48,
    runtimeCost: 0.55, hardwareFit: 0.4, licenseFit: 0.5,
    reproducibility: 0.4, selfHostFit: 0.45, failureModeClarity: 0.55,
  }, 'unavailable', 'Interessant für Custom — kein Adapter.'),
  cell('unirig-prior-art', 'faruk-like', {
    skeletonSemantics: 0.52, skinWeights: 0.48, animationStability: 0.45,
    runtimeCost: 0.55, hardwareFit: 0.4, licenseFit: 0.5,
    reproducibility: 0.4, selfHostFit: 0.45, failureModeClarity: 0.55,
  }, 'unavailable', 'Research only — Folgeprojekt, nicht #266 Blocker.'),

  // import-existing-rig (always local)
  cell('import-existing-rig', 'human', {
    skeletonSemantics: 0.95, skinWeights: 0.9, animationStability: 0.9,
    runtimeCost: 0.98, hardwareFit: 0.95, licenseFit: 1,
    reproducibility: 1, selfHostFit: 1, failureModeClarity: 0.9,
  }, 'viable', 'Vorhandenes Rig behalten + Analyzer — Prefer when already rigged.'),
  cell('import-existing-rig', 'dwarf', {
    skeletonSemantics: 0.95, skinWeights: 0.9, animationStability: 0.9,
    runtimeCost: 0.98, hardwareFit: 0.95, licenseFit: 1,
    reproducibility: 1, selfHostFit: 1, failureModeClarity: 0.9,
  }, 'viable', 'Beste lokale Option wenn Import schon geriggt.'),
  cell('import-existing-rig', 'alien', {
    skeletonSemantics: 0.9, skinWeights: 0.85, animationStability: 0.85,
    runtimeCost: 0.98, hardwareFit: 0.95, licenseFit: 1,
    reproducibility: 1, selfHostFit: 1, failureModeClarity: 0.9,
  }, 'viable', 'Import-Rig + V2 Analyzer.'),
  cell('import-existing-rig', 'gumo-like', {
    skeletonSemantics: 0.92, skinWeights: 0.88, animationStability: 0.88,
    runtimeCost: 0.98, hardwareFit: 0.95, licenseFit: 1,
    reproducibility: 1, selfHostFit: 1, failureModeClarity: 0.95,
  }, 'viable', 'Custom Default: Original-Rig behalten; Auto-Rig optional.'),
  cell('import-existing-rig', 'faruk-like', {
    skeletonSemantics: 0.92, skinWeights: 0.88, animationStability: 0.88,
    runtimeCost: 0.98, hardwareFit: 0.95, licenseFit: 1,
    reproducibility: 1, selfHostFit: 1, failureModeClarity: 0.95,
  }, 'viable', 'Custom Default: vorhandenes Rig oder limited Artifact.'),
];

export function listBenchmarkCellsForPath(
  pathId: CustomRigBenchmarkPathId,
): readonly CustomRigBenchmarkCellV1[] {
  return CUSTOM_RIG_BENCHMARK_MATRIX_V1.filter((c) => c.pathId === pathId);
}

export function listBenchmarkCellsForFixture(
  fixtureId: CustomRigBenchmarkFixtureId,
): readonly CustomRigBenchmarkCellV1[] {
  return CUSTOM_RIG_BENCHMARK_MATRIX_V1.filter((c) => c.fixtureId === fixtureId);
}

export function meanAggregateForPath(pathId: CustomRigBenchmarkPathId): number {
  const rows = listBenchmarkCellsForPath(pathId);
  if (rows.length === 0) return 0;
  return Number(
    (rows.reduce((a, r) => a + r.aggregate, 0) / rows.length).toFixed(4),
  );
}

/**
 * Canonical product strategy after the spike.
 * Humanoid: Meshy full-rig when auto-rig needed, else import-existing.
 * Custom: import-existing / limited — auto-rig optional, never forced.
 */
export function resolveCustomRigBenchmarkDecision(): CustomRigBenchmarkDecisionV1 {
  return {
    contractVersion: CUSTOM_RIG_BENCHMARK_CONTRACT_VERSION,
    strategies: [
      {
        profileKind: 'humanoid',
        defaultPathId: 'meshy-full-rig',
        fallbackPathIds: ['import-existing-rig', 'meshy-generate-rig'],
        autoRigOptional: false,
        rationaleDe:
          'Humanoide: Meshy Auto-Rig als Default wenn kein brauchbares Import-Rig; ' +
          'Fallback = vorhandenes Import-Rig. Generate-Rig nur auf Generate-Ingress. ' +
          'Capabilities immer erst nach Analyzer/Revalidation.',
      },
      {
        profileKind: 'custom-creature',
        defaultPathId: 'import-existing-rig',
        fallbackPathIds: ['import-existing-rig'],
        autoRigOptional: true,
        rationaleDe:
          'Custom Creatures: Default = vorhandenes Import-Rig oder limited Artifact. ' +
          'Auto-Rig (Meshy/SkinTokens/UniRig) bleibt explizit optional — schlechte Skinweights ' +
          '→ needs-review/limited, nie Erfolg. SkinTokens Worker derzeit unavailable.',
      },
    ],
    capabilitiesAlwaysPending: true,
    skintokensWorkerStatus: 'unavailable',
    skintokensWorkerNotesDe:
      'SkinTokens Adapter bleibt im Provider-Contract; Self-host Worker ist in diesem Spike ' +
      'unavailable (kein Live-GPU in CI). Optionaler Adapter-Pfad später ohne Domain-Neudesign.',
  };
}

/** Map provider id → primary benchmark path for humanoid auto-rig. */
export function defaultAutoRigPathForProvider(
  provider: AvatarRiggingProviderId,
): CustomRigBenchmarkPathId {
  if (provider === 'skintokens') return 'skintokens-full-rig';
  return 'meshy-full-rig';
}

/**
 * Select productive path for a fixture given whether an imported rig exists.
 * Never invents capabilities — caller must still run Analyzer V2.
 */
export function selectRigPathForFixture(input: {
  fixtureId: CustomRigBenchmarkFixtureId;
  hasImportedRig: boolean;
}): {
  pathId: CustomRigBenchmarkPathId;
  autoRigOptional: boolean;
  forceLimitedIfPoorWeights: true;
} {
  const decision = resolveCustomRigBenchmarkDecision();
  const kind = FIXTURE_PROFILE[input.fixtureId];
  const strategy = decision.strategies.find((s) => s.profileKind === kind);
  if (!strategy) {
    return {
      pathId: 'import-existing-rig',
      autoRigOptional: true,
      forceLimitedIfPoorWeights: true,
    };
  }
  if (kind === 'custom-creature') {
    return {
      pathId: 'import-existing-rig',
      autoRigOptional: true,
      forceLimitedIfPoorWeights: true,
    };
  }
  if (input.hasImportedRig) {
    return {
      pathId: 'import-existing-rig',
      autoRigOptional: strategy.autoRigOptional,
      forceLimitedIfPoorWeights: true,
    };
  }
  return {
    pathId: strategy.defaultPathId,
    autoRigOptional: strategy.autoRigOptional,
    forceLimitedIfPoorWeights: true,
  };
}

/** Provider success → always pending capabilities (revalidation required). */
export function capabilitiesAfterProviderSuccess(): 'pending' {
  return 'pending';
}

export function assertCustomRigBenchmarkInvariants(): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const decision = resolveCustomRigBenchmarkDecision();

  if (CUSTOM_RIG_BENCHMARK_FIXTURE_IDS.length < 5) {
    issues.push('need ≥5 fixtures');
  }
  const paths = new Set(CUSTOM_RIG_BENCHMARK_MATRIX_V1.map((c) => c.pathId));
  if (paths.size < 3) issues.push('need ≥3 paths');

  for (const pathId of CUSTOM_RIG_BENCHMARK_PATH_IDS) {
    for (const fixtureId of CUSTOM_RIG_BENCHMARK_FIXTURE_IDS) {
      const hit = CUSTOM_RIG_BENCHMARK_MATRIX_V1.find(
        (c) => c.pathId === pathId && c.fixtureId === fixtureId,
      );
      if (!hit) issues.push(`missing cell ${pathId}/${fixtureId}`);
    }
  }

  if (!decision.capabilitiesAlwaysPending) {
    issues.push('capabilities must always stay pending from provider');
  }
  if (decision.skintokensWorkerStatus !== 'unavailable') {
    issues.push('skintokens worker must be unavailable in this spike');
  }

  const humanoid = decision.strategies.find((s) => s.profileKind === 'humanoid');
  const custom = decision.strategies.find((s) => s.profileKind === 'custom-creature');
  if (!humanoid || humanoid.defaultPathId !== 'meshy-full-rig') {
    issues.push('humanoid default meshy-full-rig');
  }
  if (!custom || custom.defaultPathId !== 'import-existing-rig') {
    issues.push('custom default import-existing-rig');
  }
  if (!custom?.autoRigOptional) {
    issues.push('custom auto-rig must be optional');
  }

  const faruk = selectRigPathForFixture({
    fixtureId: 'faruk-like',
    hasImportedRig: true,
  });
  if (faruk.pathId !== 'import-existing-rig' || !faruk.autoRigOptional) {
    issues.push('faruk must prefer import-existing + optional auto-rig');
  }

  const humanNoRig = selectRigPathForFixture({
    fixtureId: 'human',
    hasImportedRig: false,
  });
  if (humanNoRig.pathId !== 'meshy-full-rig') {
    issues.push('human without rig → meshy-full-rig');
  }

  if (capabilitiesAfterProviderSuccess() !== 'pending') {
    issues.push('provider success must yield pending');
  }

  const wSum = Object.values(CUSTOM_RIG_BENCHMARK_SCORE_WEIGHTS).reduce(
    (a, b) => a + b,
    0,
  );
  if (Math.abs(wSum - 1) > 0.001) {
    issues.push(`weights must sum to 1, got ${wSum}`);
  }

  // Poor skinweights must not map to viable for custom meshy
  const gumoMeshy = CUSTOM_RIG_BENCHMARK_MATRIX_V1.find(
    (c) => c.pathId === 'meshy-full-rig' && c.fixtureId === 'gumo-like',
  );
  if (gumoMeshy?.outcome === 'viable') {
    issues.push('gumo meshy must not be viable');
  }

  return { ok: issues.length === 0, issues };
}
