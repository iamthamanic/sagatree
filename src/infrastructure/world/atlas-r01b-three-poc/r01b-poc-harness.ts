/**
 * r01b-poc-harness — ATL3-R01B (#1296) test-only entry for the isolated Three.js PoC.
 * Location: src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-harness.ts
 *
 * Bundled at test time (esbuild IIFE) by e2e/atl3-r01b-three-poc.spec.ts and injected
 * into a blank page — there is NO product route, switch or mount (issue non-goal:
 * no second productive renderer). Input is the stored `generatorMeta.unifiedCanvas`
 * fetched from the host API, parsed with the domain parser (same SoT as the product).
 */
import { parseUnifiedCanvasDoc } from '../../../domains/world/atlas/unified-canvas-doc';
import type { R01bView } from './r01b-poc-camera';
import { R01bThreePoc, type R01bPbrAtlas, type R01bQuality, type R01bRenderInfo } from './r01b-poc-runtime';
import type { R01bLook, R01bMapScale } from './r01b-poc-scene';

export type R01bHarnessFrameStats = {
  readonly p50: number;
  readonly p95: number;
  readonly frames: number;
  /** Raw rAF deltas (ms) so callers can use the same percentile rule as ATL3-V01. */
  readonly deltas: readonly number[];
};

export type R01bHarnessApi = {
  readonly create: (opts: {
    readonly canvasId: string;
    readonly quality: R01bQuality;
    readonly atlas: R01bPbrAtlas;
  }) => Promise<{ readonly coldLoadMs: number; readonly textureDecodeMs: number }>;
  readonly setDoc: (raw: unknown, mapScale: R01bMapScale, look: R01bLook) => { readonly ok: boolean; readonly ids: number };
  readonly first: (view: R01bView) => { readonly shaderCompileMs: number; readonly firstFrameMs: number; readonly sceneBuildMs: number };
  readonly render: (view: R01bView) => R01bRenderInfo;
  readonly frames: (view: R01bView, count: number) => Promise<R01bHarnessFrameStats>;
  readonly ids: () => string[];
  readonly centroidOf: (id: string) => [number, number, number] | null;
  readonly pick: (px: number, py: number) => string | null;
  readonly project: (x: number, y: number, z: number) => [number, number];
  readonly contextLossRoundTrip: (view: R01bView) => Promise<{ readonly lost: boolean; readonly restored: boolean; readonly restoreMs: number; readonly info: R01bRenderInfo }>;
  readonly heapMb: () => number | null;
  /** Edge case "Ladefehler": a corrupt PBR texture must reject (no hang, no partial scene). */
  readonly loadErrorProbe: (atlas: R01bPbrAtlas) => Promise<{ readonly rejected: boolean; readonly ms: number; readonly message: string }>;
  readonly dispose: () => void;
};

declare global {
  interface Window {
    __r01bThreePoc?: R01bHarnessApi;
  }
  interface Performance {
    readonly memory?: { readonly usedJSHeapSize: number };
  }
}

let poc: R01bThreePoc | null = null;

function need(): R01bThreePoc {
  if (!poc) throw new Error('R01B PoC not created');
  return poc;
}

function pct(sorted: readonly number[], q: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
}

function waitEvent(target: HTMLCanvasElement, name: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    target.addEventListener(name, () => { window.clearTimeout(timer); resolve(true); }, { once: true });
  });
}

window.__r01bThreePoc = {
  async create({ canvasId, quality, atlas }) {
    const t0 = performance.now();
    const canvas = document.getElementById(canvasId);
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error(`canvas #${canvasId} missing`);
    poc?.dispose();
    poc = new R01bThreePoc(canvas, quality);
    await poc.loadAtlas(atlas);
    return { coldLoadMs: performance.now() - t0, textureDecodeMs: poc.timings.textureDecodeMs };
  },
  setDoc(raw, mapScale, look) {
    const doc = parseUnifiedCanvasDoc(raw);
    if (!doc) return { ok: false, ids: 0 };
    need().setDoc(doc, mapScale, look);
    return { ok: true, ids: doc.rooms.length + doc.strokes.length + doc.walls.length + (doc.doors ?? []).length + doc.objects.length };
  },
  first(view) {
    const p = need();
    p.firstRender(view);
    return { shaderCompileMs: p.timings.shaderCompileMs, firstFrameMs: p.timings.firstFrameMs, sceneBuildMs: p.timings.sceneBuildMs };
  },
  render(view) {
    const p = need();
    p.render(view);
    return p.info();
  },
  frames(view, count) {
    const p = need();
    return new Promise((resolve) => {
      const deltas: number[] = [];
      let last = 0;
      const step = (now: number): void => {
        p.render(view, now / 1000);
        if (last) deltas.push(now - last);
        last = now;
        if (deltas.length >= count) {
          const sorted = [...deltas].sort((a, b) => a - b);
          resolve({ p50: pct(sorted, 0.5), p95: pct(sorted, 0.95), frames: deltas.length, deltas });
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  },
  ids: () => need().ids(),
  centroidOf: (id) => need().centroidOf(id),
  pick: (px, py) => need().pick(px, py),
  project: (x, y, z) => need().project(x, y, z),
  async contextLossRoundTrip(view) {
    const p = need();
    const lostP = waitEvent(p.canvas, 'webglcontextlost', 5000);
    p.forceContextLoss();
    const lost = await lostP;
    // Yield a macrotask: restore is only allowed once the lost-event dispatch has fully unwound.
    await new Promise<void>((r) => { window.setTimeout(r, 50); });
    const t0 = performance.now();
    const restoredP = waitEvent(p.canvas, 'webglcontextrestored', 5000);
    p.forceContextRestore();
    const restored = await restoredP;
    p.render(view);
    p.renderer.getContext().finish();
    return { lost, restored, restoreMs: performance.now() - t0, info: p.info() };
  },
  async loadErrorProbe(atlas) {
    const t0 = performance.now();
    const probe = new R01bThreePoc(document.createElement('canvas'), 'balanced');
    try {
      await probe.loadAtlas({ ...atlas, grass: { ...atlas.grass, map: 'data:image/webp;base64,AAAA' } });
      return { rejected: false, ms: performance.now() - t0, message: '' };
    } catch (e) {
      return { rejected: true, ms: performance.now() - t0, message: e instanceof Error ? e.message : String(e) };
    } finally {
      probe.dispose();
    }
  },
  heapMb: () => (performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : null),
  dispose() {
    poc?.dispose();
    poc = null;
  },
};
