/**
 * atlas-perf-budgets — ATL2-G02 atlas rendering / memory / load budgets (pure domain).
 * Location: src/domains/world/atlas/atlas-perf-budgets.ts
 *
 * Documents reference scene fixtures + measurable budgets. Runtime adapters
 * report observations; this module decides pass/fail and tracks resource
 * sessions so context-loss / map switches cannot grow unbounded.
 */

import type { AtlasGraphicsPresetId } from './atlas-renderer-target';
import { resolveAtlasGraphicsPreset } from './atlas-renderer-target';

/** Canonical fixture sizes for G02 benchmarks (not FPS guarantees). */
export type AtlasPerfSceneSize = 'small' | 'medium' | 'large';

export type AtlasPerfSceneFixture = {
  readonly id: AtlasPerfSceneSize;
  readonly labelDe: string;
  /** Approximate place/room feature count for the fixture. */
  readonly featureCount: number;
  /** Approximate instanced mesh count (dungeon / diorama). */
  readonly instanceCount: number;
  /** Approximate terrain cells (heightfield / mesh). */
  readonly terrainCells: number;
  /** Scenario tag used in evidence. */
  readonly scenario: 'settlement' | 'dungeon' | 'world';
};

/**
 * Reference fixtures — large = Stadt + Dungeon combined stress.
 * Counts are planning envelopes for budgets, not live GPU probes.
 */
export const ATLAS_PERF_SCENE_FIXTURES: readonly AtlasPerfSceneFixture[] = [
  {
    id: 'small',
    labelDe: 'Klein — einzelner Raum / Gebäude',
    featureCount: 48,
    instanceCount: 128,
    terrainCells: 64 * 64,
    scenario: 'dungeon',
  },
  {
    id: 'medium',
    labelDe: 'Mittel — Siedlung / mittelgroßer Dungeon',
    featureCount: 320,
    instanceCount: 768,
    terrainCells: 128 * 128,
    scenario: 'settlement',
  },
  {
    id: 'large',
    labelDe: 'Groß — Stadt + Dungeon-Stress',
    featureCount: 1400,
    instanceCount: 2048,
    terrainCells: 256 * 256,
    scenario: 'world',
  },
] as const;

export function atlasPerfSceneFixture(id: AtlasPerfSceneSize): AtlasPerfSceneFixture {
  const found = ATLAS_PERF_SCENE_FIXTURES.find((f) => f.id === id);
  if (!found) return ATLAS_PERF_SCENE_FIXTURES[1]!;
  return found;
}

/** Documented reference class for budget interpretation (not a CI GPU gate). */
export const ATLAS_PERF_REFERENCE_HARDWARE_DE =
  'Referenzklasse: Desktop Chromium, integrierte GPU oder Einstiegs-Diskrete, ' +
  '1080p Hauptfenster, Power-Save aus. Keine 60-FPS-Garantie auf jeder GPU.';

export type AtlasPerfBudget = {
  readonly sceneSize: AtlasPerfSceneSize;
  readonly presetId: AtlasGraphicsPresetId;
  /** Frame time p95 upper bound (ms). */
  readonly frameP95MsMax: number;
  /** Cold map load upper bound (ms) — host+parse+first paint proxy. */
  readonly coldLoadMsMax: number;
  /** Draw-call upper bound after instancing. */
  readonly drawCallsMax: number;
  /** JS heap delta upper bound across a map switch cycle (bytes). */
  readonly heapDeltaBytesMax: number;
  /** Max retained GPU resource handles after dispose / context-loss. */
  readonly retainedHandlesMax: number;
};

/** Budgets per scene × preset — large/lite is the release gate stress cell. */
export function atlasPerfBudgetFor(
  sceneSize: AtlasPerfSceneSize,
  presetId: AtlasGraphicsPresetId,
): AtlasPerfBudget {
  const preset = resolveAtlasGraphicsPreset(presetId);
  const scale =
    sceneSize === 'small' ? 1 : sceneSize === 'medium' ? 1.6 : 2.4;
  const presetScale =
    preset.id === 'high' ? 1 : preset.id === 'balanced' ? 0.85 : 0.65;
  return {
    sceneSize,
    presetId: preset.id,
    frameP95MsMax: Math.round(22 * scale * (preset.id === 'lite' ? 1.15 : 1)),
    coldLoadMsMax: Math.round(1800 * scale * presetScale),
    drawCallsMax: Math.round(
      (sceneSize === 'small' ? 120 : sceneSize === 'medium' ? 280 : 480) *
        presetScale,
    ),
    heapDeltaBytesMax: Math.round(
      (sceneSize === 'small' ? 8 : sceneSize === 'medium' ? 24 : 48) *
        1024 *
        1024 *
        presetScale,
    ),
    retainedHandlesMax: 0,
  };
}

export type AtlasPerfObservation = {
  readonly frameP95Ms: number;
  readonly coldLoadMs: number;
  readonly drawCalls: number;
  readonly heapDeltaBytes: number;
  readonly retainedHandles: number;
};

export type AtlasPerfBudgetVerdict = {
  readonly ok: boolean;
  readonly budget: AtlasPerfBudget;
  readonly observation: AtlasPerfObservation;
  readonly violations: readonly string[];
};

export function evaluateAtlasPerfBudget(
  budget: AtlasPerfBudget,
  observation: AtlasPerfObservation,
): AtlasPerfBudgetVerdict {
  const violations: string[] = [];
  if (observation.frameP95Ms > budget.frameP95MsMax) {
    violations.push(
      `frameP95Ms ${observation.frameP95Ms} > ${budget.frameP95MsMax}`,
    );
  }
  if (observation.coldLoadMs > budget.coldLoadMsMax) {
    violations.push(
      `coldLoadMs ${observation.coldLoadMs} > ${budget.coldLoadMsMax}`,
    );
  }
  if (observation.drawCalls > budget.drawCallsMax) {
    violations.push(
      `drawCalls ${observation.drawCalls} > ${budget.drawCallsMax}`,
    );
  }
  if (observation.heapDeltaBytes > budget.heapDeltaBytesMax) {
    violations.push(
      `heapDeltaBytes ${observation.heapDeltaBytes} > ${budget.heapDeltaBytesMax}`,
    );
  }
  if (observation.retainedHandles > budget.retainedHandlesMax) {
    violations.push(
      `retainedHandles ${observation.retainedHandles} > ${budget.retainedHandlesMax}`,
    );
  }
  return {
    ok: violations.length === 0,
    budget,
    observation,
    violations,
  };
}

/**
 * Suggest degrade when an observation misses budget on the current preset.
 * high → balanced → lite; lite stays lite (software fallback preferred).
 */
export function suggestAtlasPerfDegrade(
  presetId: AtlasGraphicsPresetId,
  verdict: AtlasPerfBudgetVerdict,
): AtlasGraphicsPresetId {
  if (verdict.ok) return presetId;
  if (presetId === 'high') return 'balanced';
  if (presetId === 'balanced') return 'lite';
  return 'lite';
}

/** Synthetic GPU/JS handle ledger for map-switch + context-loss proofs. */
export type AtlasPerfResourceSession = {
  readonly generation: number;
  readonly allocatedHandles: number;
  readonly liveHandles: number;
  readonly mapSwitchCount: number;
  readonly contextLossCount: number;
};

export function createAtlasPerfResourceSession(): AtlasPerfResourceSession {
  return {
    generation: 0,
    allocatedHandles: 0,
    liveHandles: 0,
    mapSwitchCount: 0,
    contextLossCount: 0,
  };
}

/** Allocate N handles for a map mount (textures/buffers/programs proxy). */
export function atlasPerfAllocateHandles(
  session: AtlasPerfResourceSession,
  count: number,
): AtlasPerfResourceSession {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return {
    ...session,
    allocatedHandles: session.allocatedHandles + n,
    liveHandles: session.liveHandles + n,
  };
}

/** Dispose all live handles (map unmount / successful teardown). */
export function atlasPerfDisposeAll(
  session: AtlasPerfResourceSession,
): AtlasPerfResourceSession {
  return {
    ...session,
    generation: session.generation + 1,
    liveHandles: 0,
    mapSwitchCount: session.mapSwitchCount + 1,
  };
}

/**
 * WebGL context loss: drop live handles without bumping mapSwitchCount.
 * Re-init must allocate into a fresh generation; live must return to 0 after dispose.
 */
export function atlasPerfSimulateContextLoss(
  session: AtlasPerfResourceSession,
): AtlasPerfResourceSession {
  return {
    ...session,
    generation: session.generation + 1,
    liveHandles: 0,
    contextLossCount: session.contextLossCount + 1,
  };
}

/**
 * Run N map switches with allocate→dispose; liveHandles must stay 0 after each dispose
 * and must not grow with N (no unbounded retention).
 */
export function atlasPerfMapSwitchStress(
  handleCountPerMap: number,
  switches: number,
): {
  readonly session: AtlasPerfResourceSession;
  readonly unbounded: boolean;
  readonly peakLive: number;
} {
  let session = createAtlasPerfResourceSession();
  let peakLive = 0;
  const n = Math.max(0, Math.floor(switches));
  for (let i = 0; i < n; i++) {
    session = atlasPerfAllocateHandles(session, handleCountPerMap);
    peakLive = Math.max(peakLive, session.liveHandles);
    session = atlasPerfDisposeAll(session);
    if (session.liveHandles !== 0) {
      return { session, unbounded: true, peakLive };
    }
  }
  // Unbounded iff allocated grew without dispose reclaiming (live should be 0).
  const unbounded =
    session.liveHandles > 0 ||
    (n > 0 && session.allocatedHandles < handleCountPerMap * n);
  return {
    session,
    unbounded: unbounded || session.liveHandles !== 0,
    peakLive,
  };
}

/**
 * Estimate draw calls from fixture + preset (instancing collapses instanceCount).
 * Used as a deterministic CI observation — not a live GPU sample.
 */
export function estimateAtlasPerfDrawCalls(
  fixture: AtlasPerfSceneFixture,
  presetId: AtlasGraphicsPresetId,
): number {
  const preset = resolveAtlasGraphicsPreset(presetId);
  const instanceBatch =
    preset.id === 'high' ? 64 : preset.id === 'balanced' ? 96 : 128;
  const instancedDraws = Math.ceil(fixture.instanceCount / instanceBatch);
  const featureDraws = Math.ceil(fixture.featureCount / 16);
  const terrainDraws = preset.id === 'lite' ? 1 : 2;
  return instancedDraws + featureDraws + terrainDraws;
}
