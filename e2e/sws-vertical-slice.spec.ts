/**
 * SWS-04 G6 — Shared World Space Vertical Slice Host Browser E2E + Golden Visual + Perf.
 * Location: e2e/sws-vertical-slice.spec.ts
 *
 * Maps directly to `.qa/design/sws-vertical-slice-and-testing.md` (VS-01…VS-15):
 *   - Test 1: VS-01/02/03/05/06/13/14/15 (continuous zoom, clearRoot=0, 2D↔3D continuity, heap & perf trace)
 *   - Test 2: VS-04/12 (4-level Golden Visual pixel-diff baselines via toHaveScreenshot, fail-closed)
 *   - Test 3: VS-08/09/10/11 (Multi-Map raycast pick on table, 3D move, Undo/Redo, Host upsertMap + reload)
 *   - VS-07 (MacBook Trackpad hardware pinch/orbit): explicitly NOT automated here (Playwright boundary);
 *     documented as manual verification in `.qa/design/sws-macbook-input-verification.md`.
 *
 * Run via:
 *   npm run test:e2e -- e2e/sws-vertical-slice.spec.ts --project=chromium
 *   PLAYWRIGHT_HARDWARE_WEBGL=1 npm run test:e2e -- e2e/sws-vertical-slice.spec.ts --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { openDornhainAtlas3d, waitAtlas3dReady } from './helpers/atlas-host';

const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';
const ROOT = process.cwd();
const EVIDENCE_DIR = join(ROOT, '.qa/evidence/sws-vertical-slice');

const jiti = createJiti(import.meta.url, { esmResolve: true });

const defaultWorldMod = jiti(
  join(ROOT, 'src/domains/world/atlas/atlas-default-world.ts'),
) as {
  buildCalibratedDefaultWorld: () => {
    readonly rootSeedKey: string;
    readonly maps: ReadonlyArray<{
      readonly seedKey: string;
      readonly title: string;
      readonly buildCanvas: () => {
        readonly objects: ReadonlyArray<{
          readonly id: string;
          readonly type: string;
          readonly x: number;
          readonly y: number;
        }>;
      };
    }>;
    readonly worldNodes: Readonly<Record<string, unknown>>;
  };
};

const worldSpaceMod = jiti(
  join(ROOT, 'src/domains/world/atlas/atlas-world-space.ts'),
) as {
  localToWorld: (
    nodes: Readonly<Record<string, unknown>>,
    mapId: string,
    point: { readonly x: number; readonly y: number },
  ) =>
    | { readonly ok: true; readonly value: { readonly x: number; readonly y: number }; readonly depth: number }
    | { readonly ok: false; readonly error: string; readonly atMapId: string };
};

const goldenVisualMod = jiti(
  join(ROOT, 'src/domains/world/atlas/atlas-golden-visual.ts'),
) as {
  ATLAS_GOLDEN_VISUAL_TOLERANCE: { readonly maxDiffPixelRatio: number };
};

const PIXEL_RATIO = goldenVisualMod.ATLAS_GOLDEN_VISUAL_TOLERANCE.maxDiffPixelRatio;
const CAPTURE_SIZE = { width: 992, height: 600 } as const;

type SwsBridgeState = {
  readonly mode: 'webgl';
  readonly renderer: 'three-js';
  readonly camera: {
    readonly mode: 'diorama-oblique' | 'ortho-topdown' | 'perspective';
    readonly x: number;
    readonly z: number;
    readonly span: number;
    readonly yawRad: number;
    readonly pitchRad: number;
  };
  readonly worldCamera: {
    readonly focusWorld: { readonly x: number; readonly y: number; readonly z: number };
    readonly span: number;
    readonly yawRad: number;
    readonly pitchRad: number;
    readonly projection: 'diorama-oblique' | 'ortho-topdown' | 'perspective';
  };
  readonly calls: number;
  readonly triangles: number;
  readonly clearRootCount: number;
  readonly activeMapCount: number;
  readonly multiMap: {
    readonly activeMapIds: readonly string[];
    readonly activeEditorMapId: string | null;
    readonly groupCount: number;
    readonly liveGeometryCount: number;
    readonly clearRootCount: number;
    readonly incrementalSyncCount: number;
  };
  readonly portalTransitionVisible: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly ids: readonly string[];
};

type SwsAtlasBridge = {
  readonly getState: () => SwsBridgeState;
  readonly setCameraMode: (m: 'diorama-oblique' | 'ortho-topdown' | 'perspective') => void;
  readonly setYaw: (rad: number) => void;
  readonly setView: (
    next: Partial<{
      mode: 'diorama-oblique' | 'ortho-topdown' | 'perspective';
      x: number;
      z: number;
      span: number;
      yawRad: number;
      pitchRad: number;
    }>,
    animate?: boolean,
  ) => void;
  readonly projectWorldToScreen: (
    x: number,
    z: number,
    y?: number,
  ) => { readonly px: number; readonly py: number; readonly visible: boolean };
  readonly pickAt: (px: number, py: number) => string | null;
  readonly getRendererInfo: () => {
    readonly webglRenderer: string;
    readonly webglVendor: string;
    readonly isSoftwareWebgl: boolean;
  };
  readonly getDocObject: (
    id: string,
  ) => {
    readonly id: string;
    readonly type: string;
    readonly x: number;
    readonly y: number;
    readonly size: number;
    readonly angle?: number;
  } | null;
};

/** Resolve exact World-Space coordinates along the 6-level Dornhain reference chain. */
function computeReferenceChainWorldPoints() {
  const bundle = defaultWorldMod.buildCalibratedDefaultWorld();
  const findMap = (title: string) => {
    const m = bundle.maps.find((entry) => entry.title === title);
    if (!m) throw new Error(`Default world map not found: ${title}`);
    return m;
  };
  const project = (seedKey: string, pt: { x: number; y: number }) => {
    const res = worldSpaceMod.localToWorld(bundle.worldNodes, seedKey, pt);
    if (!res.ok) throw new Error(`localToWorld failed for ${seedKey}: ${res.error}`);
    return res.value;
  };

  const westmark = findMap('Kontinent Westmark');
  const nordreich = findMap('Nordreich');
  const dornhain = findMap('Dornhain');
  const taverne = findMap('Taverne Zum Flüstern');
  const schankraum = findMap('Schankraum');
  const tableLocal = schankraum.buildCanvas().objects.find((o) => o.id === 'g.tav.table');
  if (!tableLocal) throw new Error('g.tav.table missing from Schankraum default world');

  return {
    world: { x: 500, y: 500 },
    westmark: project(westmark.seedKey, { x: 500, y: 500 }),
    nordreich: project(nordreich.seedKey, { x: 500, y: 500 }),
    dornhain: project(dornhain.seedKey, { x: 500, y: 500 }),
    taverne: project(taverne.seedKey, { x: 500, y: 500 }),
    schankraum: project(schankraum.seedKey, { x: 500, y: 500 }),
    tableWorld: project(schankraum.seedKey, { x: tableLocal.x, y: tableLocal.y }),
    tableLocal: { x: tableLocal.x, y: tableLocal.y },
  };
}

async function readBridgeState(page: Page): Promise<SwsBridgeState> {
  const state = await page.evaluate(() => {
    const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
    return b?.getState() ?? null;
  });
  expect(state, '__sagatreeAtlas.getState()').toBeTruthy();
  return state!;
}

/** Wait until WorldAtlasWorkbench has hydrated located child maps into the Multi-Map Scene Graph. */
async function waitMultiMapHydrated(page: Page): Promise<SwsBridgeState> {
  await expect
    .poll(
      async () => {
        const s = await page.evaluate(() => {
          const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
          return b?.getState()?.multiMap?.groupCount ?? 0;
        });
        return s;
      },
      { timeout: 30_000, message: 'Multi-Map Scene Graph child map hydration' },
    )
    .toBeGreaterThanOrEqual(2);
  return readBridgeState(page);
}

async function waitRafFrames(page: Page, count = 3): Promise<void> {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let left = n;
        const tick = () => {
          left -= 1;
          if (left <= 0) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count,
  );
}

/** Hide floating chrome over the Three.js stage for deterministic WebGL pixel-diff captures. */
async function hideStageChromeForCapture(page: Page): Promise<void> {
  await page.evaluate((size) => {
    const markHidden = (el: Element | null) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.dataset.swsCaptureHide === '1') return;
      el.dataset.swsCaptureHide = '1';
      el.dataset.swsPrevVisibility = el.style.visibility;
      el.dataset.swsPrevDisplay = el.style.display;
      el.style.visibility = 'hidden';
      el.style.display = 'none';
    };

    const ws = document.querySelector('[data-atlas-three-workstation]') as HTMLElement | null;
    if (ws) {
      // Hide every floating HUD sibling after the full-bleed canvas container (first child).
      Array.from(ws.children).forEach((child, idx) => {
        if (idx > 0) markHidden(child);
      });
      ws.dataset.swsPrevW = ws.style.width;
      ws.dataset.swsPrevH = ws.style.height;
      ws.style.width = `${size.width}px`;
      ws.style.height = `${size.height}px`;
      const canvas = ws.querySelector('canvas');
      if (canvas) {
        canvas.style.width = `${size.width}px`;
        canvas.style.height = `${size.height}px`;
      }
      window.dispatchEvent(new Event('resize'));
    }

    document
      .querySelectorAll(
        [
          '[data-atlas-prototype-bar]',
          '[data-atlas-surface-actions]',
          '[data-atlas-surface-bar]',
          '[data-atlas-dungeon-forge-3d]',
          '[data-atlas-dungeon-forge]',
          '[data-atlas-surface-toggle]',
          '[data-atlas-missing-detail]',
          '[data-atlas-pin-tier]',
        ].join(', '),
      )
      .forEach((el) => markHidden(el));
  }, CAPTURE_SIZE);
  await waitRafFrames(page, 4);
  await page.waitForTimeout(300);
}

async function restoreStageChrome(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('[data-sws-capture-hide="1"]').forEach((el) => {
      el.style.visibility = el.dataset.swsPrevVisibility ?? '';
      el.style.display = el.dataset.swsPrevDisplay ?? '';
      delete el.dataset.swsPrevVisibility;
      delete el.dataset.swsPrevDisplay;
      delete el.dataset.swsCaptureHide;
    });
    const ws = document.querySelector('[data-atlas-three-workstation]') as HTMLElement | null;
    if (ws) {
      ws.style.width = ws.dataset.swsPrevW ?? '';
      ws.style.height = ws.dataset.swsPrevH ?? '';
      delete ws.dataset.swsPrevW;
      delete ws.dataset.swsPrevH;
      const canvas = ws.querySelector('canvas');
      if (canvas) {
        canvas.style.width = '';
        canvas.style.height = '';
      }
      window.dispatchEvent(new Event('resize'));
    }
  });
}

async function openLayersAndSelectMap(page: Page, mapLabel: string): Promise<void> {
  const layersBtn = page.locator('[data-atlas-panel-fold="layers"]').first();
  await expect(layersBtn).toBeVisible({ timeout: 20_000 });
  const expanded = await layersBtn.getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await layersBtn.click();
  }
  const aside = page.locator('aside[aria-label="Welthierarchie und Ebenen"]').first();
  await expect(aside).toBeVisible({ timeout: 15_000 });

  const search = aside.locator('input[aria-label="Ebenen durchsuchen"]').first();
  await search.fill(mapLabel);
  await page.waitForTimeout(200);

  const rowBtn = aside.getByRole('button', { name: new RegExp(mapLabel, 'i') }).first();
  await expect(rowBtn, `layers row for ${mapLabel}`).toBeVisible({ timeout: 15_000 });
  await rowBtn.click();

  await search.fill('');
  await waitAtlas3dReady(page);
  await waitRafFrames(page, 4);
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

test.describe('SWS-04 G6 — Shared World Space Vertical Slice (Host Browser E2E)', () => {
  test.skip(!HOST, 'requires SAGATREE_BROWSER_E2E_HOST=1 (run via npm run test:e2e)');

  test('VS-01/02/03/05/06/13/14/15: continuous zoom without clearRoot, 2D↔3D continuity & perf trace', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const ref = computeReferenceChainWorldPoints();

    await page.setViewportSize({ width: 1280, height: 800 });
    await openDornhainAtlas3d(page);
    const initial = await waitMultiMapHydrated(page);

    expect(initial.clearRootCount, 'initial clearRootCount').toBe(0);
    expect(initial.portalTransitionVisible, 'initial portalTransitionVisible').toBe(false);

    // 1. Continuous 6-level zoom ladder (Welt → Westmark → Nordreich → Dornhain → Taverne → Schankraum)
    const checkpoints = [
      { id: 'welt', x: ref.world.x, z: ref.world.y, span: 500 },
      { id: 'westmark', x: ref.westmark.x, z: ref.westmark.y, span: 160 },
      { id: 'nordreich', x: ref.nordreich.x, z: ref.nordreich.y, span: 40 },
      { id: 'dornhain', x: ref.dornhain.x, z: ref.dornhain.y, span: 2.5 },
      { id: 'taverne', x: ref.taverne.x, z: ref.taverne.y, span: 0.25 },
      { id: 'schankraum', x: ref.tableWorld.x, z: ref.tableWorld.y, span: 0.06 },
    ] as const;

    const fixedYaw = 0.58;
    const zoomTrace = await page.evaluate(
      async ({ stops, yawRad }) => {
        const bridge = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
        if (!bridge) throw new Error('__sagatreeAtlas missing');

        const nextFrame = () =>
          new Promise<number>((resolve) => requestAnimationFrame((ts) => resolve(ts)));

        const readHeapMb = (): number | null => {
          const mem = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory;
          return mem && typeof mem.usedJSHeapSize === 'number'
            ? Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 100) / 100
            : null;
        };

        const frameDeltasMs: number[] = [];
        const checkpointSnapshots: Array<{
          id: string;
          span: number;
          focusX: number;
          focusY: number;
          yawRad: number;
          clearRootCount: number;
          portalTransitionVisible: boolean;
          activeMapIds: readonly string[];
          activeEditorMapId: string | null;
          activeMapCount: number;
          groupCount: number;
          calls: number;
          triangles: number;
        }> = [];

        let maxClearRoot = 0;
        let sawPortalOverlay = false;
        let maxActiveMaps = 0;
        let maxYawDrift = 0;
        let maxFocusJump = 0;

        // Position at start stop before measuring continuous zoom frames.
        bridge.setView(
          {
            mode: 'diorama-oblique',
            x: stops[0]!.x,
            z: stops[0]!.z,
            span: stops[0]!.span,
            yawRad,
            pitchRad: 0.94,
          },
          false,
        );
        await nextFrame();
        let prevTs = await nextFrame();
        let prevFocus = bridge.getState().worldCamera.focusWorld;

        // Smooth logarithmic span interpolation between consecutive stops (10 frames/segment = 50 zoom frames).
        for (let s = 0; s < stops.length; s += 1) {
          const from = stops[Math.max(0, s - 1)]!;
          const to = stops[s]!;
          const steps = s === 0 ? 1 : 10;
          for (let step = 1; step <= steps; step += 1) {
            const t = step / steps;
            const x = from.x + (to.x - from.x) * t;
            const z = from.z + (to.z - from.z) * t;
            const span = from.span * Math.pow(to.span / from.span, t);
            bridge.setView({ x, z, span, yawRad }, false);
            const ts = await nextFrame();
            const dt = ts - prevTs;
            if (dt > 0 && dt < 2000) frameDeltasMs.push(Math.round(dt * 100) / 100);
            prevTs = ts;

            const st = bridge.getState();
            maxClearRoot = Math.max(maxClearRoot, st.clearRootCount, st.multiMap.clearRootCount);
            if (st.portalTransitionVisible) sawPortalOverlay = true;
            maxActiveMaps = Math.max(maxActiveMaps, st.multiMap.activeMapIds.length);
            maxYawDrift = Math.max(maxYawDrift, Math.abs(st.worldCamera.yawRad - yawRad));
            const focusJump = Math.hypot(
              st.worldCamera.focusWorld.x - x,
              st.worldCamera.focusWorld.y - z,
            );
            maxFocusJump = Math.max(maxFocusJump, focusJump);
            prevFocus = st.worldCamera.focusWorld;
          }

          const cp = bridge.getState();
          checkpointSnapshots.push({
            id: to.id,
            span: Math.round(cp.worldCamera.span * 10000) / 10000,
            focusX: Math.round(cp.worldCamera.focusWorld.x * 10000) / 10000,
            focusY: Math.round(cp.worldCamera.focusWorld.y * 10000) / 10000,
            yawRad: Math.round(cp.worldCamera.yawRad * 10000) / 10000,
            clearRootCount: cp.clearRootCount,
            portalTransitionVisible: cp.portalTransitionVisible,
            activeMapIds: cp.multiMap.activeMapIds,
            activeEditorMapId: cp.multiMap.activeEditorMapId,
            activeMapCount: cp.activeMapCount,
            groupCount: cp.multiMap.groupCount,
            calls: cp.calls,
            triangles: cp.triangles,
          });
        }

        // VS-14: 5× Welt → Raum → Welt cycle heap stability check
        const heapSamplesMb: number[] = [];
        const h0 = readHeapMb();
        if (h0 !== null) heapSamplesMb.push(h0);
        for (let cycle = 0; cycle < 5; cycle += 1) {
          for (const stop of [...stops, ...[...stops].reverse()]) {
            bridge.setView({ x: stop.x, z: stop.z, span: stop.span, yawRad }, false);
            await nextFrame();
            const st = bridge.getState();
            maxClearRoot = Math.max(maxClearRoot, st.clearRootCount, st.multiMap.clearRootCount);
            if (st.portalTransitionVisible) sawPortalOverlay = true;
            maxActiveMaps = Math.max(maxActiveMaps, st.multiMap.activeMapIds.length);
          }
          const hc = readHeapMb();
          if (hc !== null) heapSamplesMb.push(hc);
        }

        return {
          rendererInfo: bridge.getRendererInfo(),
          frameDeltasMs,
          checkpointSnapshots,
          maxClearRoot,
          sawPortalOverlay,
          maxActiveMaps,
          maxYawDrift,
          maxFocusJump,
          lastFocus: prevFocus,
          heapSamplesMb,
        };
      },
      { stops: checkpoints, yawRad: fixedYaw },
    );

    // VS-01 / VS-13: Zero clearRoot across entire zoom + 5 cycles
    expect(zoomTrace.maxClearRoot, 'VS-01/13 clearRootCount === 0').toBe(0);
    // VS-03: Zero portal transition overlay during spatial zoom
    expect(zoomTrace.sawPortalOverlay, 'VS-03 portalTransitionVisible === false').toBe(false);
    // VS-02 / VS-05: Continuous focus & preserved yaw without resets
    expect(zoomTrace.maxYawDrift, 'VS-05 yaw preserved').toBeLessThan(1e-3);
    expect(zoomTrace.maxFocusJump, 'VS-02 continuous focusWorld').toBeLessThan(1e-2);
    // A.2: Active simultaneously rendered maps bounded (<= 6) & changes incrementally along depth
    expect(zoomTrace.maxActiveMaps, 'A.2 simultaneously active maps <= 6').toBeLessThanOrEqual(6);
    const weltCp = zoomTrace.checkpointSnapshots[0]!;
    const schankraumCp = zoomTrace.checkpointSnapshots[zoomTrace.checkpointSnapshots.length - 1]!;
    expect(weltCp.activeEditorMapId, 'Welt active editor map id').toBeTruthy();
    expect(schankraumCp.activeEditorMapId, 'Schankraum active editor map id').toBeTruthy();
    expect(
      schankraumCp.activeEditorMapId,
      'VS-01 deep zoom switches active editor map context without clearRoot',
    ).not.toBe(weltCp.activeEditorMapId);
    expect(
      schankraumCp.activeMapIds.length,
      'VS-01 multi-map keeps active map groups mounted',
    ).toBeGreaterThanOrEqual(2);

    // 2. VS-06: 2D ↔ 3D projection mode switch preserves focusWorld, yawRad, and span
    const modeTestYaw = 1.12;
    const modeTestFocus = { x: ref.dornhain.x, z: ref.dornhain.y, span: 2.4 };
    const modeSwitchResult = await page.evaluate(
      async ({ target, yaw }) => {
        const bridge = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
        if (!bridge) throw new Error('__sagatreeAtlas missing');
        const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

        bridge.setView(
          { mode: 'diorama-oblique', x: target.x, z: target.z, span: target.span, yawRad: yaw },
          false,
        );
        await nextFrame();
        const before = bridge.getState().worldCamera;

        bridge.setCameraMode('ortho-topdown');
        await nextFrame();
        const after2d = bridge.getState().worldCamera;

        bridge.setCameraMode('perspective');
        await nextFrame();
        const afterPersp = bridge.getState().worldCamera;

        bridge.setCameraMode('diorama-oblique');
        await nextFrame();
        const afterBack = bridge.getState().worldCamera;

        return {
          before,
          after2d,
          afterPersp,
          afterBack,
          clearRootCount: bridge.getState().clearRootCount,
        };
      },
      { target: modeTestFocus, yaw: modeTestYaw },
    );

    for (const snap of [modeSwitchResult.after2d, modeSwitchResult.afterPersp, modeSwitchResult.afterBack]) {
      expect(Math.abs(snap.focusWorld.x - modeSwitchResult.before.focusWorld.x)).toBeLessThan(1e-3);
      expect(Math.abs(snap.focusWorld.y - modeSwitchResult.before.focusWorld.y)).toBeLessThan(1e-3);
      expect(Math.abs(snap.yawRad - modeTestYaw)).toBeLessThan(1e-3);
      expect(Math.abs(snap.span - modeTestFocus.span)).toBeLessThan(1e-3);
    }
    expect(modeSwitchResult.after2d.projection).toBe('ortho-topdown');
    expect(modeSwitchResult.afterPersp.projection).toBe('perspective');
    expect(modeSwitchResult.afterBack.projection).toBe('diorama-oblique');
    expect(modeSwitchResult.clearRootCount).toBe(0);

    // 3. VS-15: Write real performance metrics to `.qa/evidence/sws-vertical-slice/perf.json`
    const sortedDeltas = [...zoomTrace.frameDeltasMs].sort((a, b) => a - b);
    const p50Ms = percentile(sortedDeltas, 50);
    const p95Ms = percentile(sortedDeltas, 95);
    const maxMs = sortedDeltas.length > 0 ? sortedDeltas[sortedDeltas.length - 1]! : 0;
    const avgMs =
      sortedDeltas.length > 0
        ? sortedDeltas.reduce((acc, v) => acc + v, 0) / sortedDeltas.length
        : 0;
    const avgFps = avgMs > 0 ? Math.round((1000 / avgMs) * 10) / 10 : 0;
    const p95Fps = p95Ms > 0 ? Math.round((1000 / p95Ms) * 10) / 10 : 0;

    let heapDriftPct: number | null = null;
    if (zoomTrace.heapSamplesMb.length >= 2) {
      const first = zoomTrace.heapSamplesMb[0]!;
      const last = zoomTrace.heapSamplesMb[zoomTrace.heapSamplesMb.length - 1]!;
      heapDriftPct = first > 0 ? Math.round(((last - first) / first) * 10000) / 100 : 0;
    }

    const profileLabel = zoomTrace.rendererInfo.isSoftwareWebgl ? 'software-ci' : 'target-desktop';
    const perfEvidence = {
      capturedAt: new Date().toISOString(),
      spec: 'e2e/sws-vertical-slice.spec.ts',
      hardwareProfile: profileLabel,
      rendererInfo: zoomTrace.rendererInfo,
      hardwareVerified: !zoomTrace.rendererInfo.isSoftwareWebgl,
      budgetsA2: {
        maxSimultaneousActiveMaps: 6,
        frameP95MsSoft: 33.3,
        frameP95MsTarget: 16.7,
        clearRootCountTarget: 0,
        maxHeapDriftPct: 10,
      },
      measured: {
        frameSamples: sortedDeltas.length,
        frameP50Ms: p50Ms,
        frameP95Ms: p95Ms,
        frameMaxMs: maxMs,
        frameAvgMs: Math.round(avgMs * 100) / 100,
        avgFps,
        p95Fps,
        clearRootCount: zoomTrace.maxClearRoot,
        portalOverlayTriggered: zoomTrace.sawPortalOverlay,
        maxSimultaneousActiveMaps: zoomTrace.maxActiveMaps,
        maxYawDriftRad: zoomTrace.maxYawDrift,
        maxFocusJumpWorldUnits: zoomTrace.maxFocusJump,
        heapSamplesMb: zoomTrace.heapSamplesMb,
        heapDriftPct,
      },
      budgetChecks: {
        activeMapsWithinBudget: zoomTrace.maxActiveMaps <= 6,
        clearRootZero: zoomTrace.maxClearRoot === 0,
        portalOverlayZero: !zoomTrace.sawPortalOverlay,
        frameP95Within30FpsSoft: p95Ms <= 33.3,
        frameP95Within60FpsTarget: p95Ms <= 16.7,
        heapWithin10PctDrift: heapDriftPct === null ? null : heapDriftPct <= 10,
      },
      checkpoints: zoomTrace.checkpointSnapshots,
      modeSwitch2d3d: {
        yawPreserved: Math.abs(modeSwitchResult.after2d.yawRad - modeTestYaw) < 1e-3,
        focusPreserved:
          Math.abs(modeSwitchResult.after2d.focusWorld.x - modeSwitchResult.before.focusWorld.x) <
          1e-3,
        spanPreserved: Math.abs(modeSwitchResult.after2d.span - modeTestFocus.span) < 1e-3,
      },
    };
    writeFileSync(join(EVIDENCE_DIR, 'perf.json'), `${JSON.stringify(perfEvidence, null, 2)}\n`);
  });

  test('VS-04/12: Golden Visual multi-level screenshot baselines (geometry consistency, no Z-fighting)', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const ref = computeReferenceChainWorldPoints();

    await page.setViewportSize({ width: 1280, height: 800 });
    await openDornhainAtlas3d(page);
    await waitMultiMapHydrated(page);

    const cameras = [
      {
        id: 'sws-01-world',
        snapshot: 'sws-01-world.png',
        view: { mode: 'diorama-oblique' as const, x: ref.world.x, z: ref.world.y, span: 430, yawRad: 0.42, pitchRad: 0.94 },
      },
      {
        id: 'sws-02-land-nordreich',
        snapshot: 'sws-02-land-nordreich.png',
        view: { mode: 'diorama-oblique' as const, x: ref.nordreich.x, z: ref.nordreich.y, span: 42, yawRad: 0.42, pitchRad: 0.92 },
      },
      {
        id: 'sws-03-ort-dornhain',
        snapshot: 'sws-03-ort-dornhain.png',
        view: { mode: 'diorama-oblique' as const, x: ref.dornhain.x, z: ref.dornhain.y, span: 2.2, yawRad: 0.42, pitchRad: 0.88 },
      },
      {
        id: 'sws-04-raum-schankraum',
        snapshot: 'sws-04-raum-schankraum.png',
        view: { mode: 'diorama-oblique' as const, x: ref.tableWorld.x, z: ref.tableWorld.y, span: 0.09, yawRad: 0.42, pitchRad: 1.02 },
      },
    ];

    await hideStageChromeForCapture(page);
    const captureMeta: Array<{
      id: string;
      snapshot: string;
      clearRootCount: number;
      activeMapIds: readonly string[];
      activeEditorMapId: string | null;
      triangles: number;
    }> = [];

    try {
      const canvas = page.locator('[data-atlas-three-workstation] canvas').first();
      await expect(canvas).toBeVisible({ timeout: 20_000 });
      const box = await canvas.boundingBox();
      expect(box, 'Three.js canvas boundingBox').toBeTruthy();
      const clip = {
        x: box!.x,
        y: box!.y,
        width: Math.min(CAPTURE_SIZE.width, Math.round(box!.width)),
        height: Math.min(CAPTURE_SIZE.height, Math.round(box!.height)),
      };
      expect(clip.width).toBe(CAPTURE_SIZE.width);
      expect(clip.height).toBe(CAPTURE_SIZE.height);

      for (const cam of cameras) {
        await page.evaluate((v) => {
          const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
          if (!b) throw new Error('__sagatreeAtlas missing');
          b.setView(v, false);
        }, cam.view);
        await waitRafFrames(page, 6);
        await page.waitForTimeout(250);

        const st = await readBridgeState(page);
        expect(st.clearRootCount, `${cam.id} clearRootCount`).toBe(0);
        expect(st.triangles, `${cam.id} rendered triangles > 0`).toBeGreaterThan(0);

        const rawPath = join(EVIDENCE_DIR, cam.snapshot);
        await page.screenshot({ path: rawPath, clip, animations: 'disabled' });
        await expect(page).toHaveScreenshot(cam.snapshot, {
          clip,
          maxDiffPixelRatio: PIXEL_RATIO,
          animations: 'disabled',
        });

        captureMeta.push({
          id: cam.id,
          snapshot: cam.snapshot,
          clearRootCount: st.clearRootCount,
          activeMapIds: st.multiMap.activeMapIds,
          activeEditorMapId: st.multiMap.activeEditorMapId,
          triangles: st.triangles,
        });
      }
    } finally {
      await restoreStageChrome(page);
    }

    writeFileSync(
      join(EVIDENCE_DIR, 'golden-captures.json'),
      `${JSON.stringify({ capturedAt: new Date().toISOString(), maxDiffPixelRatio: PIXEL_RATIO, captures: captureMeta }, null, 2)}\n`,
    );
  });

  test('VS-08/09/10/11: Multi-Map raycast pick, 3D move, Undo/Redo, Host upsertMap persist & reload', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const ref = computeReferenceChainWorldPoints();

    await page.setViewportSize({ width: 1280, height: 800 });
    await openDornhainAtlas3d(page);
    await waitMultiMapHydrated(page);

    // 1. VS-08: Multi-Map raycast directly on World root hits `g.tav.table` inside Schankraum!
    await page.evaluate((pt) => {
      const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
      if (!b) throw new Error('__sagatreeAtlas missing');
      b.setView(
        { mode: 'diorama-oblique', x: pt.x, z: pt.y, span: 0.08, yawRad: 0.42, pitchRad: 1.05 },
        false,
      );
    }, ref.tableWorld);
    await waitRafFrames(page, 6);

    const multiMapPick = await page.evaluate((pt) => {
      const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
      if (!b) throw new Error('__sagatreeAtlas missing');
      const proj = b.projectWorldToScreen(pt.x, pt.y);
      const offsets = [
        [0, 0],
        [0, -4],
        [0, -8],
        [4, 0],
        [-4, 0],
        [0, 4],
        [6, -6],
        [-6, -6],
      ] as const;
      let hit: string | null = null;
      let hitOffset: readonly [number, number] = [0, 0];
      for (const [dx, dy] of offsets) {
        const cand = b.pickAt(proj.px + dx, proj.py + dy);
        if (cand === 'g.tav.table') {
          hit = cand;
          hitOffset = [dx, dy];
          break;
        }
        if (!hit && cand) {
          hit = cand;
          hitOffset = [dx, dy];
        }
      }
      return {
        proj,
        hit,
        hitOffset,
        clearRootCount: b.getState().clearRootCount,
        activeEditorMapId: b.getState().multiMap.activeEditorMapId,
        activeMapIds: b.getState().multiMap.activeMapIds,
      };
    }, ref.tableWorld);

    expect(multiMapPick.clearRootCount, 'VS-08 clearRootCount === 0 during multi-map pick').toBe(0);
    expect(multiMapPick.proj.visible, 'table projects inside viewport').toBe(true);
    expect(multiMapPick.hit, 'VS-08 multi-map raycast hits g.tav.table').toBe('g.tav.table');

    // 2. VS-09 / VS-11 / VS-10: Edit g.tav.table in Schankraum, Undo/Redo, Persist via Host upsertMap, Reload
    await openLayersAndSelectMap(page, 'Schankraum');

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
            return b?.getDocObject('g.tav.table') ? 1 : 0;
          }),
        { timeout: 20_000, message: 'Schankraum doc loaded with g.tav.table' },
      )
      .toBe(1);
    await waitRafFrames(page, 6);

    const origObj = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
      return b?.getDocObject('g.tav.table') ?? null;
    });
    expect(origObj, 'g.tav.table exists in Schankraum doc').toBeTruthy();

    // Frame directly over the table in Schankraum for a clean 3D pointer drag.
    await page.evaluate((obj) => {
      const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
      b?.setView(
        { mode: 'ortho-topdown', x: obj.x, z: obj.y, span: 260, yawRad: 0, pitchRad: Math.PI / 2 },
        false,
      );
    }, origObj!);
    await waitRafFrames(page, 6);

    // Open Werkzeuge, activate Move tool (`move`)
    const toolsBtn = page.locator('[data-atlas-panel-fold="tools"]').first();
    await expect(toolsBtn).toBeVisible({ timeout: 15_000 });
    if ((await toolsBtn.getAttribute('aria-expanded')) !== 'true') {
      await toolsBtn.click();
    }
    const moveToolBtn = page.locator('[data-atlas-3d-tool="move"]').first();
    await expect(moveToolBtn).toBeVisible({ timeout: 10_000 });
    await moveToolBtn.click();
    await expect(moveToolBtn).toHaveAttribute('aria-pressed', 'true');

    // Project table center on canvas and verify pickAt before dragging
    const canvas = page.locator('[data-atlas-three-workstation] canvas').first();
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox, 'canvas box for drag').toBeTruthy();

    const dragStart = await page.evaluate((obj) => {
      const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
      if (!b) throw new Error('__sagatreeAtlas missing');
      const proj = b.projectWorldToScreen(obj.x, obj.y);
      const picked = b.pickAt(proj.px, proj.py);
      return { proj, picked };
    }, origObj!);
    expect(dragStart.picked, 'table raycast hit in Schankraum editor').toBe('g.tav.table');

    const startClientX = canvasBox!.x + dragStart.proj.px;
    const startClientY = canvasBox!.y + dragStart.proj.py;
    const endClientX = startClientX + 90;
    const endClientY = startClientY + 55;

    // Watch for Host upsertMap network response (PUT/POST on atlas maps endpoint)
    let savedResponseSeen = false;
    page.on('response', (res) => {
      if (
        (res.request().method() === 'PUT' || res.request().method() === 'POST') &&
        res.url().includes('/atlas/maps') &&
        res.ok()
      ) {
        savedResponseSeen = true;
      }
    });

    // Perform smooth 3D Move drag (batched into ONE undoable history entry — SWS-08!)
    await page.mouse.move(startClientX, startClientY);
    await page.mouse.down();
    await page.mouse.move(endClientX, endClientY, { steps: 8 });
    await page.mouse.up();
    await waitRafFrames(page, 4);

    const movedObj = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
      return b?.getDocObject('g.tav.table') ?? null;
    });
    expect(movedObj, 'moved g.tav.table exists').toBeTruthy();
    const movedDist = Math.hypot(movedObj!.x - origObj!.x, movedObj!.y - origObj!.y);
    expect(movedDist, 'VS-09 table moved significantly in local coordinates').toBeGreaterThan(15);

    // VS-11: Undo restores exact original coordinates; Redo restores exact moved coordinates
    const undoBtn = page.locator('button[aria-label="Rückgängig"]').first();
    const redoBtn = page.locator('button[aria-label="Wiederholen"]').first();
    await expect(undoBtn).toBeEnabled({ timeout: 5_000 });
    await undoBtn.click();
    await waitRafFrames(page, 4);

    const afterUndoObj = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
      return b?.getDocObject('g.tav.table') ?? null;
    });
    expect(afterUndoObj, 'after Undo g.tav.table').toBeTruthy();
    expect(Math.abs(afterUndoObj!.x - origObj!.x), 'VS-11 Undo x restored').toBeLessThan(0.01);
    expect(Math.abs(afterUndoObj!.y - origObj!.y), 'VS-11 Undo y restored').toBeLessThan(0.01);

    await expect(redoBtn).toBeEnabled({ timeout: 5_000 });
    savedResponseSeen = false;
    await redoBtn.click();
    await waitRafFrames(page, 4);

    const afterRedoObj = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
      return b?.getDocObject('g.tav.table') ?? null;
    });
    expect(afterRedoObj, 'after Redo g.tav.table').toBeTruthy();
    expect(Math.abs(afterRedoObj!.x - movedObj!.x), 'VS-11 Redo x restored').toBeLessThan(0.01);
    expect(Math.abs(afterRedoObj!.y - movedObj!.y), 'VS-11 Redo y restored').toBeLessThan(0.01);

    // Wait for Host autosave (or trigger manual save if button is shown)
    const manualSaveBtn = page.getByRole('button', { name: /Speichern/i }).first();
    if ((await manualSaveBtn.count()) > 0 && (await manualSaveBtn.isEnabled().catch(() => false))) {
      await manualSaveBtn.click();
    }
    await expect
      .poll(() => (savedResponseSeen ? 1 : 0), {
        timeout: 20_000,
        message: 'Host upsertMap 200 OK after table move/redo',
      })
      .toBe(1);

    // VS-10: Reload page, re-open Schankraum, assert exact persisted position!
    await page.reload();
    await expect(page.locator('[data-world-atlas-workbench]').first()).toBeVisible({ timeout: 45_000 });
    await waitAtlas3dReady(page);
    await openLayersAndSelectMap(page, 'Schankraum');
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
            return b?.getDocObject('g.tav.table') ? 1 : 0;
          }),
        { timeout: 20_000, message: 'Reloaded Schankraum doc with g.tav.table' },
      )
      .toBe(1);

    const reloadedObj = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: SwsAtlasBridge }).__sagatreeAtlas;
      return b?.getDocObject('g.tav.table') ?? null;
    });
    expect(reloadedObj, 'reloaded g.tav.table exists').toBeTruthy();
    expect(Math.abs(reloadedObj!.x - movedObj!.x), 'VS-10 persisted x after reload').toBeLessThan(0.01);
    expect(Math.abs(reloadedObj!.y - movedObj!.y), 'VS-10 persisted y after reload').toBeLessThan(0.01);

    writeFileSync(
      join(EVIDENCE_DIR, 'edit-persist.json'),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          multiMapPick,
          origObj,
          movedObj,
          afterUndoObj,
          afterRedoObj,
          reloadedObj,
          movedDistanceLocalUnits: Math.round(movedDist * 100) / 100,
          hostUpsertMapPersisted: savedResponseSeen,
        },
        null,
        2,
      )}\n`,
    );
  });
});
