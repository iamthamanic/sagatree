/**
 * atlas-perf-budgets — ATL2-G02 documented scene fixtures + plan-cost budgets.
 * Location: src/domains/world/atlas/atlas-perf-budgets.ts
 *
 * Pure domain — no React / Host / WebGL. Budgets are fail-closed for CI
 * synthetic plan costs (not a 60 FPS GPU guarantee). Productive 3D remains
 * custom-webgl (R01 NO-GO for Three.js product switch).
 */

import {
  buildAtlasDungeonLookPlan,
  resolveAtlasDungeonQualityBudget,
  type AtlasDungeonLookPlan,
} from './atlas-dungeon-look';
import { buildAtlasProductGeometryPlan } from './atlas-product-geometry-plan';
import type { AtlasGraphicsPresetId } from './atlas-renderer-target';
import type { UnifiedCanvasDoc } from './unified-canvas-doc';

export const ATLAS_PERF_BUDGET_FORMAT = 'atl2-perf-budget-v1' as const;

export type AtlasPerfSceneSize = 'small' | 'medium' | 'large';

export type AtlasPerfSceneFixture = {
  readonly id: AtlasPerfSceneSize;
  readonly labelDe: string;
  /** Reference hardware band for acceptance docs (CI runs headless Node). */
  readonly referenceHardware: string;
  readonly dungeonRoomCount: number;
  readonly dungeonSeed: number;
  readonly themeKey: 'ancient' | 'molten' | 'frost' | 'grim' | 'verdant';
  readonly graphicsPresetId: AtlasGraphicsPresetId;
};

/** Documented fixtures — large ≈ dense city/dungeon edit target. */
export const ATLAS_PERF_SCENE_FIXTURES: readonly AtlasPerfSceneFixture[] = [
  {
    id: 'small',
    labelDe: 'Kleiner Innenraum',
    referenceHardware: 'CI Node · Apple Silicon / GitHub linux-x64',
    dungeonRoomCount: 6,
    dungeonSeed: 101,
    themeKey: 'ancient',
    graphicsPresetId: 'high',
  },
  {
    id: 'medium',
    labelDe: 'Gebäude / Stadtblock',
    referenceHardware: 'CI Node · Apple Silicon / GitHub linux-x64',
    dungeonRoomCount: 16,
    dungeonSeed: 4242,
    themeKey: 'grim',
    graphicsPresetId: 'balanced',
  },
  {
    id: 'large',
    labelDe: 'Großes Dungeon / Stadt-Szenario',
    referenceHardware: 'CI Node · Apple Silicon / GitHub linux-x64',
    dungeonRoomCount: 40,
    dungeonSeed: 9001,
    themeKey: 'molten',
    graphicsPresetId: 'balanced',
  },
] as const;

export type AtlasPerfBudgetThresholds = {
  readonly format: typeof ATLAS_PERF_BUDGET_FORMAT;
  /** Soft frame target for interactive hardware soak (documented, not CI GPU). */
  readonly frameP95MsSoft: number;
  /** Cold plan build (domain) must stay under this on CI. */
  readonly coldPlanMsMax: number;
  /** Product geometry + look plan instances must respect preset budget. */
  readonly maxInstancesHigh: number;
  readonly maxInstancesBalanced: number;
  readonly maxInstancesLite: number;
  /** Estimated draw batches (one per look batch + geometry kinds present). */
  readonly maxDrawBatchesLarge: number;
  /** After N map-switch / context-loss cycles, live GPU resource counter must be 0. */
  readonly mapSwitchCycles: number;
  readonly maxLiveGpuHandlesAfterTeardown: number;
};

export const ATLAS_PERF_BUDGET_THRESHOLDS: AtlasPerfBudgetThresholds = {
  format: ATLAS_PERF_BUDGET_FORMAT,
  frameP95MsSoft: 33.3,
  coldPlanMsMax: 250,
  maxInstancesHigh: 2048,
  maxInstancesBalanced: 1024,
  maxInstancesLite: 256,
  maxDrawBatchesLarge: 48,
  mapSwitchCycles: 8,
  maxLiveGpuHandlesAfterTeardown: 0,
};

export type AtlasPerfPlanMeasurement = {
  readonly sceneId: AtlasPerfSceneSize;
  readonly coldPlanMs: number;
  readonly lookInstances: number;
  readonly lookBatches: number;
  readonly lookTruncated: number;
  readonly geometryPrimitives: number;
  readonly geometryFingerprint: string;
  readonly lookFingerprint: string;
  readonly budgetMaxInstances: number;
  readonly withinBudget: boolean;
};

export function resolveAtlasPerfSceneFixture(id: AtlasPerfSceneSize): AtlasPerfSceneFixture {
  const hit = ATLAS_PERF_SCENE_FIXTURES.find((f) => f.id === id);
  if (!hit) return ATLAS_PERF_SCENE_FIXTURES[0]!;
  return hit;
}

/**
 * Measure domain plan cost for a UnifiedCanvasDoc already filled with dungeon geometry.
 * Callers supply the doc (from generateDungeon → rasterize) so this stays pure.
 */
export function measureAtlasPerfPlan(
  doc: UnifiedCanvasDoc,
  fixture: AtlasPerfSceneFixture,
  nowMs: () => number = () => performance.now(),
): AtlasPerfPlanMeasurement {
  const t0 = nowMs();
  const look = buildAtlasDungeonLookPlan(doc, {
    themeKey: fixture.themeKey,
    graphicsPresetId: fixture.graphicsPresetId,
  });
  const geometry = buildAtlasProductGeometryPlan(doc);
  const coldPlanMs = nowMs() - t0;
  const budget = resolveAtlasDungeonQualityBudget(fixture.graphicsPresetId);
  const withinBudget =
    look.counts.instances <= budget.maxInstances &&
    coldPlanMs <= ATLAS_PERF_BUDGET_THRESHOLDS.coldPlanMsMax &&
    (fixture.id !== 'large' ||
      look.counts.batches <= ATLAS_PERF_BUDGET_THRESHOLDS.maxDrawBatchesLarge);

  return {
    sceneId: fixture.id,
    coldPlanMs,
    lookInstances: look.counts.instances,
    lookBatches: look.counts.batches,
    lookTruncated: look.counts.truncated,
    geometryPrimitives: geometry.primitives.length,
    geometryFingerprint: geometry.contentFingerprint,
    lookFingerprint: look.lookFingerprint,
    budgetMaxInstances: budget.maxInstances,
    withinBudget,
  };
}

export function summarizeAtlasLookAgainstBudget(
  look: AtlasDungeonLookPlan,
): { readonly ok: boolean; readonly reason: string | null } {
  if (look.counts.instances > look.budget.maxInstances) {
    return {
      ok: false,
      reason: `instances ${look.counts.instances} > budget ${look.budget.maxInstances}`,
    };
  }
  if (look.counts.torches > look.budget.maxTorchInstances) {
    return {
      ok: false,
      reason: `torches ${look.counts.torches} > budget ${look.budget.maxTorchInstances}`,
    };
  }
  return { ok: true, reason: null };
}

/**
 * Tracks synthetic GPU handle ownership across map switches / context-loss.
 * Runtime should acquire on mount/rebuild and release on dispose/contextlost.
 */
export type AtlasGpuResourceSession = {
  readonly generation: number;
  readonly liveHandles: number;
  readonly lostCount: number;
  readonly restoreCount: number;
  readonly mapSwitchCount: number;
};

export function createAtlasGpuResourceSession(): AtlasGpuResourceSession {
  return {
    generation: 0,
    liveHandles: 0,
    lostCount: 0,
    restoreCount: 0,
    mapSwitchCount: 0,
  };
}

export function atlasGpuAcquire(
  session: AtlasGpuResourceSession,
  handles: number,
): AtlasGpuResourceSession {
  const n = Math.max(0, Math.floor(handles));
  return {
    ...session,
    generation: session.generation + 1,
    liveHandles: session.liveHandles + n,
  };
}

export function atlasGpuReleaseAll(session: AtlasGpuResourceSession): AtlasGpuResourceSession {
  return { ...session, liveHandles: 0 };
}

export function atlasGpuContextLost(session: AtlasGpuResourceSession): AtlasGpuResourceSession {
  return {
    ...session,
    lostCount: session.lostCount + 1,
    liveHandles: 0,
  };
}

export function atlasGpuContextRestored(
  session: AtlasGpuResourceSession,
  handles: number,
): AtlasGpuResourceSession {
  const n = Math.max(0, Math.floor(handles));
  return {
    ...session,
    restoreCount: session.restoreCount + 1,
    generation: session.generation + 1,
    liveHandles: n,
  };
}

export function atlasGpuMapSwitch(
  session: AtlasGpuResourceSession,
  nextHandles: number,
): AtlasGpuResourceSession {
  const n = Math.max(0, Math.floor(nextHandles));
  return {
    ...session,
    mapSwitchCount: session.mapSwitchCount + 1,
    generation: session.generation + 1,
    liveHandles: n,
  };
}

export function atlasGpuSessionWithinTeardownBudget(
  session: AtlasGpuResourceSession,
): boolean {
  return (
    session.liveHandles <= ATLAS_PERF_BUDGET_THRESHOLDS.maxLiveGpuHandlesAfterTeardown &&
    session.mapSwitchCount >= 0
  );
}
