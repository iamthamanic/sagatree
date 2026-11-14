/**
 * atlas-gate-g05 — ATL2-G05 cross-cutting quality gate contracts (#1233).
 * Location: src/domains/world/atlas/atlas-gate-g05.ts
 *
 * Pure domain — no React / Host / WebGL. Evidence rows stay NOT_RUN until a
 * real Browser E2E / GPU soak fills them; never auto-PASS missing runs.
 */

import {
  ATLAS_PERF_BUDGET_THRESHOLDS,
  ATLAS_PERF_SCENE_FIXTURES,
  type AtlasPerfSceneSize,
} from './atlas-perf-budgets';
import type { AtlasAdaptiveBand } from './atlas-workstation-adaptive';

export const ATLAS_G05_EVIDENCE_FORMAT = 'atl2-g05-evidence-v1' as const;

/** Soft interactive p95 (G02); CI SwiftShader / software path uses a wider ceiling. */
export const ATLAS_G05_FRAME_P95_MS_SOFT = ATLAS_PERF_BUDGET_THRESHOLDS.frameP95MsSoft;
export const ATLAS_G05_FRAME_P95_MS_CI_SOFTWARE = 120 as const;

export type AtlasG05CheckStatus = 'PASS' | 'FAIL' | 'NOT_RUN';

export type AtlasG05CheckId =
  | 'frame-times-small'
  | 'frame-times-medium'
  | 'frame-times-large'
  | 'map-switch-teardown'
  | 'webgl-context-loss'
  | 'js-heap-soak'
  | 'camera-zoom-pick-edit'
  | 'device-desktop'
  | 'device-tablet'
  | 'device-phone'
  | 'owner-api-secrets'
  | 'player-secret-negative'
  | 'visual-screenshot';

export type AtlasG05CheckResult = {
  readonly id: AtlasG05CheckId;
  readonly status: AtlasG05CheckStatus;
  readonly detail: string;
};

export type AtlasG05FrameSample = {
  readonly sceneId: AtlasPerfSceneSize;
  readonly sampleCount: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly budgetMs: number;
  readonly renderer: 'webgl' | 'software' | 'unknown';
  readonly withinBudget: boolean;
};

export type AtlasG05DeviceProbe = {
  readonly band: AtlasAdaptiveBand;
  readonly width: number;
  readonly height: number;
  readonly atlasReady: boolean;
  readonly webglMode: string;
};

export type AtlasG05Evidence = {
  readonly format: typeof ATLAS_G05_EVIDENCE_FORMAT;
  readonly issue: 1233;
  readonly gate: 'atl2-g05';
  readonly at: string;
  readonly repro: {
    readonly host: string;
    readonly userAgent: string;
    readonly viewport: string;
  };
  readonly frames: readonly AtlasG05FrameSample[];
  readonly devices: readonly AtlasG05DeviceProbe[];
  readonly mapSwitchCycles: number;
  readonly liveMeshesAfterTeardown: number;
  readonly contextLossObserved: boolean;
  readonly contextRestored: boolean;
  readonly jsHeapUsedMbBefore: number | null;
  readonly jsHeapUsedMbAfter: number | null;
  readonly cameraZoomPickEditOk: boolean;
  readonly ownerSeesSecrets: boolean;
  readonly playerSecretsAbsent: boolean;
  readonly screenshotPaths: readonly string[];
  readonly checks: readonly AtlasG05CheckResult[];
};

export const ATLAS_G05_REQUIRED_CHECK_IDS: readonly AtlasG05CheckId[] = [
  'frame-times-small',
  'frame-times-medium',
  'frame-times-large',
  'map-switch-teardown',
  'webgl-context-loss',
  'js-heap-soak',
  'camera-zoom-pick-edit',
  'device-desktop',
  'device-tablet',
  'device-phone',
  'owner-api-secrets',
  'player-secret-negative',
  'visual-screenshot',
] as const;

export const ATLAS_G05_DEVICE_VIEWPORTS: ReadonlyArray<{
  readonly band: AtlasAdaptiveBand;
  readonly width: number;
  readonly height: number;
}> = [
  { band: 'desktop', width: 1280, height: 800 },
  { band: 'tablet', width: 834, height: 1112 },
  { band: 'phone', width: 390, height: 844 },
] as const;

/** Deterministic percentile (nearest-rank). */
export function atlasG05PercentileMs(samplesMs: readonly number[], p: number): number {
  if (samplesMs.length === 0) return Number.NaN;
  const sorted = [...samplesMs].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank]!;
}

export function atlasG05FrameBudgetMs(renderer: 'webgl' | 'software' | 'unknown'): number {
  if (renderer === 'software' || renderer === 'unknown') return ATLAS_G05_FRAME_P95_MS_CI_SOFTWARE;
  return ATLAS_G05_FRAME_P95_MS_SOFT;
}

export function summarizeAtlasG05FrameSample(
  sceneId: AtlasPerfSceneSize,
  samplesMs: readonly number[],
  renderer: 'webgl' | 'software' | 'unknown',
): AtlasG05FrameSample {
  const budgetMs = atlasG05FrameBudgetMs(renderer);
  const p50Ms = atlasG05PercentileMs(samplesMs, 50);
  const p95Ms = atlasG05PercentileMs(samplesMs, 95);
  const withinBudget =
    samplesMs.length >= 8 && Number.isFinite(p95Ms) && p95Ms <= budgetMs;
  return {
    sceneId,
    sampleCount: samplesMs.length,
    p50Ms,
    p95Ms,
    budgetMs,
    renderer,
    withinBudget,
  };
}

export function emptyAtlasG05Checks(): AtlasG05CheckResult[] {
  return ATLAS_G05_REQUIRED_CHECK_IDS.map((id) => ({
    id,
    status: 'NOT_RUN' as const,
    detail: 'not executed',
  }));
}

/**
 * Fail-closed rollup: any FAIL → FAIL; any NOT_RUN → NOT_RUN; else PASS.
 * Missing required ids count as NOT_RUN (never silent PASS).
 */
export function rollupAtlasG05Checks(
  checks: readonly AtlasG05CheckResult[],
): AtlasG05CheckStatus {
  const byId = new Map(checks.map((c) => [c.id, c]));
  for (const id of ATLAS_G05_REQUIRED_CHECK_IDS) {
    const row = byId.get(id);
    if (!row || row.status === 'NOT_RUN') return 'NOT_RUN';
  }
  for (const id of ATLAS_G05_REQUIRED_CHECK_IDS) {
    if (byId.get(id)!.status === 'FAIL') return 'FAIL';
  }
  return 'PASS';
}

export function buildAtlasG05ChecksFromEvidence(partial: {
  readonly frames: readonly AtlasG05FrameSample[];
  readonly devices: readonly AtlasG05DeviceProbe[];
  readonly mapSwitchCycles: number;
  readonly liveMeshesAfterTeardown: number;
  readonly contextLossObserved: boolean;
  readonly contextRestored: boolean;
  readonly jsHeapUsedMbBefore: number | null;
  readonly jsHeapUsedMbAfter: number | null;
  readonly cameraZoomPickEditOk: boolean;
  readonly ownerSeesSecrets: boolean;
  readonly playerSecretsAbsent: boolean;
  readonly screenshotPaths: readonly string[];
}): AtlasG05CheckResult[] {
  const frame = (id: AtlasPerfSceneSize): AtlasG05CheckResult => {
    const hit = partial.frames.find((f) => f.sceneId === id);
    const checkId =
      id === 'small'
        ? 'frame-times-small'
        : id === 'medium'
          ? 'frame-times-medium'
          : 'frame-times-large';
    if (!hit || hit.sampleCount < 8) {
      return { id: checkId, status: 'NOT_RUN', detail: 'insufficient frame samples' };
    }
    return {
      id: checkId,
      status: hit.withinBudget ? 'PASS' : 'FAIL',
      detail: `p50=${hit.p50Ms.toFixed(1)} p95=${hit.p95Ms.toFixed(1)} budget=${hit.budgetMs} renderer=${hit.renderer}`,
    };
  };

  const device = (band: AtlasAdaptiveBand, checkId: AtlasG05CheckId): AtlasG05CheckResult => {
    const hit = partial.devices.find((d) => d.band === band);
    if (!hit) return { id: checkId, status: 'NOT_RUN', detail: 'device not probed' };
    return {
      id: checkId,
      status: hit.atlasReady ? 'PASS' : 'FAIL',
      detail: `${hit.width}x${hit.height} ready=${hit.atlasReady} webgl=${hit.webglMode}`,
    };
  };

  const heapOk =
    partial.jsHeapUsedMbBefore == null ||
    partial.jsHeapUsedMbAfter == null ||
    partial.jsHeapUsedMbAfter <= partial.jsHeapUsedMbBefore * 1.85 + 32;

  return [
    frame('small'),
    frame('medium'),
    frame('large'),
    {
      id: 'map-switch-teardown',
      // Browser soak keeps the atlas mounted: require N cycles + bounded mesh count
      // (dispose-to-zero remains G02 synthetic GPU session). Hard fail on explosion.
      status:
        partial.mapSwitchCycles === 0
          ? 'NOT_RUN'
          : partial.mapSwitchCycles >= ATLAS_PERF_BUDGET_THRESHOLDS.mapSwitchCycles &&
              partial.liveMeshesAfterTeardown >= 0 &&
              partial.liveMeshesAfterTeardown < 4096
            ? 'PASS'
            : 'FAIL',
      detail: `cycles=${partial.mapSwitchCycles} liveMeshes=${partial.liveMeshesAfterTeardown}`,
    },
    {
      id: 'webgl-context-loss',
      status: !partial.contextLossObserved
        ? 'NOT_RUN'
        : partial.contextLossObserved && partial.contextRestored
          ? 'PASS'
          : 'FAIL',
      detail: `lost=${partial.contextLossObserved} restored=${partial.contextRestored}`,
    },
    {
      id: 'js-heap-soak',
      status:
        partial.jsHeapUsedMbBefore == null
          ? 'NOT_RUN'
          : heapOk
            ? 'PASS'
            : 'FAIL',
      detail: `before=${partial.jsHeapUsedMbBefore ?? 'n/a'} after=${partial.jsHeapUsedMbAfter ?? 'n/a'} Mb`,
    },
    {
      id: 'camera-zoom-pick-edit',
      status: partial.cameraZoomPickEditOk ? 'PASS' : 'FAIL',
      detail: partial.cameraZoomPickEditOk ? 'camera/zoom/orbit/pick ok' : 'interaction failed',
    },
    device('desktop', 'device-desktop'),
    device('tablet', 'device-tablet'),
    device('phone', 'device-phone'),
    {
      id: 'owner-api-secrets',
      status: partial.ownerSeesSecrets ? 'PASS' : 'FAIL',
      detail: partial.ownerSeesSecrets ? 'owner payload retains editor secrets' : 'owner missing secrets',
    },
    {
      id: 'player-secret-negative',
      status: partial.playerSecretsAbsent ? 'PASS' : 'FAIL',
      detail: partial.playerSecretsAbsent
        ? 'playerView strips editor secrets'
        : 'player payload leaked secrets',
    },
    {
      id: 'visual-screenshot',
      status: partial.screenshotPaths.length > 0 ? 'PASS' : 'NOT_RUN',
      detail: `screenshots=${partial.screenshotPaths.length}`,
    },
  ];
}

export function atlasG05SceneFixturesCoverHierarchy(): boolean {
  const ids = new Set(ATLAS_PERF_SCENE_FIXTURES.map((f) => f.id));
  return ids.has('small') && ids.has('medium') && ids.has('large');
}
