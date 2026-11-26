/**
 * SCM-06 + Findings M-1 / M-2 / L-1 / L-2 — Spatial Containment Model Host Browser-E2E.
 * Location: e2e/scm-spatial-containment.spec.ts
 *
 * Reuses `e2e/helpers/atlas-host.ts` (`openDornhainAtlas3d`, `waitAtlas3dReady`) and the
 * ephemeral host runner (`npm run test:e2e -- e2e/scm-spatial-containment.spec.ts --project=chromium`).
 * Evidence written to `.qa/evidence/scm/`.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { openDornhainAtlas3d, waitAtlas3dReady } from './helpers/atlas-host';

const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';
const ROOT = process.cwd();
const EVIDENCE_DIR = join(ROOT, '.qa/evidence/scm');
const LOD_EVIDENCE_DIR = join(ROOT, '.qa/evidence/continuous-lod');

const jiti = createJiti(import.meta.url, { esmResolve: true });

const defaultWorldMod = jiti(
  join(ROOT, 'src/domains/world/atlas/atlas-default-world.ts'),
) as {
  buildCalibratedDefaultWorld: () => {
    readonly maps: ReadonlyArray<{
      readonly seedKey: string;
      readonly title: string;
      readonly buildCanvas: () => {
        readonly objects: ReadonlyArray<{
          readonly id: string;
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
    | { readonly ok: true; readonly value: { readonly x: number; readonly y: number } }
    | { readonly ok: false; readonly error: string };
};

type ScmBridge = {
  readonly getState: () => {
    readonly clearRootCount: number;
    readonly layersOpen: boolean;
    readonly multiMap: {
      readonly activeMapIds: readonly string[];
      readonly groupCount: number;
      readonly activeEditorMapId: string | null;
      readonly ownPerMapTerrainCount: number;
      readonly groupOpacities: Readonly<
        Record<
          string,
          {
            readonly detailWeight: number;
            readonly opacity: number;
            readonly depth: number;
            readonly lodState: string;
            readonly exiting: boolean;
          }
        >
      >;
    };
    readonly terrain: {
      readonly enabled: boolean;
      readonly chunkCount: number;
      readonly maxActiveLod: number;
      readonly coarseBaseCount: number;
      readonly totalTriangles: number;
      readonly chunks: ReadonlyArray<{
        readonly chunkId: string;
        readonly lodLevel: number;
        readonly logicalCells: number;
        readonly isCoarseBase: boolean;
        readonly boundsWorld: {
          readonly minX: number;
          readonly minZ: number;
          readonly maxX: number;
          readonly maxZ: number;
        };
      }>;
    };
    readonly zoomLayer: {
      readonly activeMapId: string | null;
      readonly activePlaceId: string | null;
      readonly isWorldRoot: boolean;
      readonly activeLabelDe: string;
      readonly activeDepth: number;
      readonly activeBreadcrumbPlaceIds: readonly string[];
    };
  };
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
  readonly getSpatialPrefs: () => { readonly confirmGrow: boolean; readonly confirmCascade: boolean };
  readonly getSpatialState: () => {
    readonly ready: boolean;
    readonly entityCount: number;
    readonly activeCount: number;
    readonly archivedCount: number;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly pendingConfirmKind: string | null;
    readonly pendingSummaryDe: string | null;
    readonly lastErrorDe: string | null;
    readonly entities: Readonly<
      Record<
        string,
        {
          readonly id: string;
          readonly labelDe: string;
          readonly role: string;
          readonly status: string;
          readonly carrierId: string | null;
          readonly boundsWorld: {
            readonly minX: number;
            readonly minY: number;
            readonly maxX: number;
            readonly maxY: number;
          };
        }
      >
    >;
  };
  readonly requestSpatialIntent: (intent: Record<string, unknown>) => {
    readonly ok: boolean;
    readonly prompted: boolean;
    readonly reasonDe?: string;
  };
  readonly undoSpatial: () => Promise<boolean>;
  readonly redoSpatial: () => Promise<boolean>;
};

function computeZoomPoints() {
  const bundle = defaultWorldMod.buildCalibratedDefaultWorld();
  const find = (title: string) => {
    const m = bundle.maps.find((entry) => entry.title === title);
    if (!m) throw new Error(`missing map ${title}`);
    return m;
  };
  const proj = (seedKey: string, pt: { x: number; y: number }) => {
    const r = worldSpaceMod.localToWorld(bundle.worldNodes, seedKey, pt);
    if (!r.ok) throw new Error(`localToWorld ${seedKey}: ${r.error}`);
    return r.value;
  };
  const westmark = find('Kontinent Westmark');
  const nordreich = find('Nordreich');
  const dornhain = find('Dornhain');
  const taverne = find('Taverne Zum Flüstern');
  const schankraum = find('Schankraum');
  const table = schankraum.buildCanvas().objects.find((o) => o.id === 'g.tav.table')!;
  return {
    welt: { x: 500, y: 500 },
    westmark: proj(westmark.seedKey, { x: 500, y: 500 }),
    nordreich: proj(nordreich.seedKey, { x: 500, y: 500 }),
    dornhain: proj(dornhain.seedKey, { x: 500, y: 500 }),
    taverne: proj(taverne.seedKey, { x: 500, y: 500 }),
    schankraum: proj(schankraum.seedKey, { x: table.x, y: table.y }),
  };
}

async function waitRaf(page: Page, n = 4): Promise<void> {
  await page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const step = () => {
          left -= 1;
          if (left <= 0) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    n,
  );
}

async function waitSpatialReady(page: Page): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
          const st = b?.getState();
          const sp = b?.getSpatialState();
          return (st?.multiMap.groupCount ?? 0) >= 2 && sp?.ready ? 1 : 0;
        }),
      { timeout: 30_000, message: 'Multi-Map + SpatialWorldModel hydrated' },
    )
    .toBe(1);
}

async function waitForAtlasPersistResponse(page: Page, action: () => Promise<void>): Promise<void> {
  const respPromise = page.waitForResponse(
    (res) =>
      res.url().includes('/atlas') &&
      ['POST', 'PUT', 'PATCH'].includes(res.request().method()) &&
      res.ok(),
    { timeout: 25_000 },
  );
  await action();
  await respPromise;
  // Let any chained secondary map upserts settle
  await page.waitForTimeout(400);
}

async function reloadAtlasAndWait(page: Page): Promise<void> {
  await page.reload();
  await expect(page.locator('[data-world-atlas-workbench]').first()).toBeVisible({ timeout: 45_000 });
  const mode3d = page.locator('[data-atlas-surface-mode="3d"]').first();
  const mode2d = page.locator('[data-atlas-surface-mode="2d"]').first();
  await expect(mode3d.or(mode2d)).toBeVisible({ timeout: 60_000 });
  if ((await mode3d.count()) === 0) await page.locator('[data-atlas-surface-toggle]').first().click();
  await waitAtlas3dReady(page);
  await waitSpatialReady(page);
}

test.describe('SCM — Spatial Containment Model (Host Browser E2E)', () => {
  test.skip(!HOST, 'requires SAGATREE_BROWSER_E2E_HOST=1 (npm run test:e2e)');

  test('SCM-07 + L-1: zoom-driven layer indicator tracks Welt→…→Schankraum with WCAG AA contrast >= 4.5:1 & clearRoot=0', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const pts = computeZoomPoints();

    await page.setViewportSize({ width: 1280, height: 800 });
    await openDornhainAtlas3d(page);
    await waitSpatialReady(page);

    // Open Ebenen tree — must STAY OPEN across every single zoom transition!
    const layersBtn = page.locator('[data-atlas-panel-fold="layers"]').first();
    await expect(layersBtn).toBeVisible();
    if ((await layersBtn.getAttribute('aria-expanded')) !== 'true') {
      await layersBtn.click();
    }
    const layersAside = page.locator('aside[aria-label="Welthierarchie und Ebenen"]').first();
    await expect(layersAside).toBeVisible();

    const ladder = [
      { id: 'welt', expectedLabel: 'Dornhain', x: pts.welt.x, z: pts.welt.y, span: 500, minDepth: 1 },
      { id: 'westmark', expectedLabel: 'Kontinent Westmark', x: pts.westmark.x, z: pts.westmark.y, span: 160, minDepth: 2 },
      { id: 'nordreich', expectedLabel: 'Nordreich', x: pts.nordreich.x, z: pts.nordreich.y, span: 40, minDepth: 3 },
      { id: 'dornhain', expectedLabel: 'Dornhain', x: pts.dornhain.x, z: pts.dornhain.y, span: 2.5, minDepth: 4 },
      { id: 'taverne', expectedLabel: 'Taverne Zum Flüstern', x: pts.taverne.x, z: pts.taverne.y, span: 0.25, minDepth: 5 },
      { id: 'schankraum', expectedLabel: 'Schankraum', x: pts.schankraum.x, z: pts.schankraum.y, span: 0.06, minDepth: 6 },
    ] as const;

    const observed: Array<{
      step: string;
      clearRootCount: number;
      layersOpen: boolean;
      activeLabelDe: string;
      activeDepth: number;
      domZoomActiveText: string | null;
    }> = [];

    for (const stop of ladder) {
      await page.evaluate((v) => {
        const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
        b?.setView({ mode: 'diorama-oblique', x: v.x, z: v.z, span: v.span, yawRad: 0.42 }, false);
      }, stop);
      await waitRaf(page, 6);

      // Tree MUST stay open (never collapse on zoom!)
      await expect(layersAside, `Ebenen stays open at ${stop.id}`).toBeVisible();

      const snap = await page.evaluate(() => {
        const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
        const st = b?.getState();
        const activeBtn = document.querySelector('[data-atlas-zoom-active="true"]');
        return {
          clearRootCount: st?.clearRootCount ?? -1,
          layersOpen: st?.layersOpen ?? false,
          activeLabelDe: st?.zoomLayer.activeLabelDe ?? '',
          activeDepth: st?.zoomLayer.activeDepth ?? 0,
          domZoomActiveText: activeBtn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
        };
      });

      expect(snap.clearRootCount, `${stop.id} clearRootCount === 0`).toBe(0);
      expect(snap.layersOpen, `${stop.id} layersOpen stays true`).toBe(true);
      expect(snap.activeDepth, `${stop.id} depth`).toBeGreaterThanOrEqual(stop.minDepth);
      expect(snap.domZoomActiveText, `${stop.id} active DOM node`).toContain(stop.expectedLabel);

      observed.push({ step: stop.id, ...snap });
    }

    // L-1: Measure real computed WCAG 2.1 contrast ratio on active zoom node (`Schankraum`) + subtitle
    const contrast = await page.evaluate(() => {
      const parseRgba = (raw: string): [number, number, number, number] => {
        const m = raw.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
        if (!m) return [0, 0, 0, 1];
        return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] !== undefined ? Number(m[4]) : 1];
      };
      const blendOver = (
        fg: [number, number, number, number],
        bg: [number, number, number, number],
      ): [number, number, number] => {
        const a = fg[3];
        return [
          fg[0] * a + bg[0] * (1 - a),
          fg[1] * a + bg[1] * (1 - a),
          fg[2] * a + bg[2] * (1 - a),
        ];
      };
      const relLum = ([r, g, b]: [number, number, number]): number => {
        const lin = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      };
      const ratio = (a: [number, number, number], b: [number, number, number]): number => {
        const l1 = relLum(a);
        const l2 = relLum(b);
        return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
      };

      const btn = document.querySelector<HTMLElement>('[data-atlas-zoom-active="true"]');
      if (!btn) return null;
      const btnCs = getComputedStyle(btn);
      const bg = parseRgba(btnCs.backgroundColor);
      const fg = parseRgba(btnCs.color);
      const subEl = btn.querySelectorAll<HTMLElement>('span > span')[1] ?? btn;
      const subCs = getComputedStyle(subEl);
      const subFg = parseRgba(subCs.color);
      const baseBg: [number, number, number] = [bg[0], bg[1], bg[2]];
      return {
        darkMode: document.documentElement.classList.contains('dark'),
        backgroundColor: btnCs.backgroundColor,
        labelColor: btnCs.color,
        subtitleColor: subCs.color,
        fontWeight: btnCs.fontWeight,
        labelContrast: ratio(blendOver(fg, bg), baseBg),
        subtitleContrast: ratio(blendOver(subFg, bg), baseBg),
      };
    });

    expect(contrast, 'active zoom node computed style found').toBeTruthy();
    expect(contrast!.labelContrast, `L-1 active label WCAG AA contrast >= 4.5 (${JSON.stringify(contrast)})`).toBeGreaterThanOrEqual(4.5);
    expect(contrast!.subtitleContrast, `L-1 active subtitle WCAG AA contrast >= 4.5 (${JSON.stringify(contrast)})`).toBeGreaterThanOrEqual(4.5);

    // Badge displays deepest level `Schankraum`
    await expect(page.locator('[data-atlas-zoom-level-badge]').first()).toContainText('Schankraum');
    await page.screenshot({ path: join(EVIDENCE_DIR, 'scm-07-zoom-layer-schankraum.png') });
    await page.screenshot({ path: join(EVIDENCE_DIR, 'scm-l1-zoom-contrast.png') });

    writeFileSync(
      join(EVIDENCE_DIR, 'scm-07-zoom-trace.json'),
      `${JSON.stringify({ capturedAt: new Date().toISOString(), contrast, observed }, null, 2)}\n`,
    );
  });

  test('Phase 1–3: shared chunked world terrain, continuous-LOD opacity ramp, keep-coarse & camera-driven Ebenen focus', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    mkdirSync(LOD_EVIDENCE_DIR, { recursive: true });
    const pts = computeZoomPoints();

    await page.setViewportSize({ width: 1280, height: 800 });
    await openDornhainAtlas3d(page);
    await waitSpatialReady(page);

    // Keep Ebenen drawer open throughout continuous zoom
    const layersBtn = page.locator('[data-atlas-panel-fold="layers"]').first();
    if ((await layersBtn.getAttribute('aria-expanded')) !== 'true') {
      await layersBtn.click();
    }
    const layersAside = page.locator('aside[aria-label="Welthierarchie und Ebenen"]').first();
    await expect(layersAside).toBeVisible();

    const trace: Array<{
      step: string;
      span: number;
      clearRootCount: number;
      ownPerMapTerrainCount: number;
      terrainChunkCount: number;
      terrainMaxLod: number;
      terrainCoarseBaseCount: number;
      activeLabelDe: string;
      activeDepth: number;
      breadcrumbLen: number;
      domZoomActiveText: string | null;
      groupOpacities: Record<
        string,
        { detailWeight: number; opacity: number; depth: number; lodState: string; exiting: boolean }
      >;
    }> = [];

    const captureStep = async (
      step: string,
      focus: { x: number; y: number },
      span: number,
      rafCount = 2,
      screenshotName?: string,
    ) => {
      await page.evaluate(
        (v) => {
          const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
          b?.setView({ mode: 'diorama-oblique', x: v.x, z: v.z, span: v.span, yawRad: 0.42 }, false);
        },
        { x: focus.x, z: focus.y, span },
      );
      await waitRaf(page, rafCount);

      const snap = await page.evaluate(() => {
        const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
        const st = b?.getState();
        const activeBtn = document.querySelector('[data-atlas-zoom-active="true"]');
        return {
          clearRootCount: st?.clearRootCount ?? -1,
          ownPerMapTerrainCount: st?.multiMap.ownPerMapTerrainCount ?? -1,
          terrainEnabled: st?.terrain.enabled ?? false,
          terrainChunkCount: st?.terrain.chunkCount ?? 0,
          terrainMaxLod: st?.terrain.maxActiveLod ?? -1,
          terrainCoarseBaseCount: st?.terrain.coarseBaseCount ?? 0,
          chunks: st?.terrain.chunks ?? [],
          activeMapCount: st?.multiMap.groupCount ?? 0,
          activeLabelDe: st?.zoomLayer.activeLabelDe ?? '',
          activeDepth: st?.zoomLayer.activeDepth ?? 0,
          breadcrumbLen: st?.zoomLayer.activeBreadcrumbPlaceIds.length ?? 0,
          domZoomActiveText: activeBtn?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
          groupOpacities: (st?.multiMap.groupOpacities ?? {}) as Record<
            string,
            { detailWeight: number; opacity: number; depth: number; lodState: string; exiting: boolean }
          >,
        };
      });

      expect(snap.clearRootCount, `${step}: clearRootCount === 0`).toBe(0);
      expect(snap.terrainEnabled, `${step}: shared chunked world terrain enabled`).toBe(true);
      expect(snap.ownPerMapTerrainCount, `${step}: ZERO separate per-map landmass terrain meshes`).toBe(0);
      expect(snap.terrainChunkCount, `${step}: active terrain chunks >= 1`).toBeGreaterThanOrEqual(1);
      expect(snap.terrainCoarseBaseCount, `${step}: keep-coarse base chunks >= 1`).toBeGreaterThanOrEqual(1);
      for (const ch of snap.chunks) {
        expect(ch.chunkId).toMatch(/^L\d+:\d+:\d+$/);
        expect(ch.logicalCells).toBe(64);
      }

      if (screenshotName) {
        await page.screenshot({ path: join(LOD_EVIDENCE_DIR, screenshotName) });
      }

      trace.push({
        step,
        span,
        clearRootCount: snap.clearRootCount,
        ownPerMapTerrainCount: snap.ownPerMapTerrainCount,
        terrainChunkCount: snap.terrainChunkCount,
        terrainMaxLod: snap.terrainMaxLod,
        terrainCoarseBaseCount: snap.terrainCoarseBaseCount,
        activeLabelDe: snap.activeLabelDe,
        activeDepth: snap.activeDepth,
        breadcrumbLen: snap.breadcrumbLen,
        domZoomActiveText: snap.domZoomActiveText,
        groupOpacities: snap.groupOpacities,
      });
      return snap;
    };

    // 1) World overview (span 530): BOTH continents + ocean on ONE continuous world heightfield
    const sWorld = await captureStep('world-530', pts.welt, 530, 8, 'lod-01-world-span530.png');
    expect(sWorld.activeDepth).toBe(1);

    // 2) Continuous zoom ramp over Dornhain (530 → 300 → 200 → 140 → 120 → 70 → 25 → 12 → 6 → 2.5)
    //    Sample quickly (rafCount=2) to observe genuine damped crossfade opacity (0 < op < 1)!
    await captureStep('westmark-300', pts.westmark, 300, 4);
    await captureStep('westmark-120', pts.westmark, 120, 4, 'lod-02-westmark-span120.png');

    await captureStep('dorn-220', pts.dornhain, 220, 2);
    await captureStep('dorn-140', pts.dornhain, 140, 2);
    await captureStep('dorn-80', pts.dornhain, 80, 2);
    const sNord25 = await captureStep('nordreich-25', pts.dornhain, 25, 8, 'lod-03-nordreich-span25.png');
    expect(sNord25.activeLabelDe, 'Phase 3: span=25 over Nordreich highlights Nordreich').toBe('Nordreich');
    expect(sNord25.domZoomActiveText).toContain('Nordreich');
    expect(sNord25.activeDepth).toBe(3);

    // Step across Dornhain refinement boundary (span 12 → 8 → 5 → 2.5) with 1 RAF frame to verify smooth opacity!
    await captureStep('dorn-12', pts.dornhain, 12, 1);
    await captureStep('dorn-8', pts.dornhain, 8, 1);
    await captureStep('dorn-5', pts.dornhain, 5, 1);
    const sDorn = await captureStep('dornhain-2.5', pts.dornhain, 2.5, 12, 'lod-04-dornhain-span2.5.png');
    expect(sDorn.activeLabelDe, 'Phase 3: span=2.5 over Dornhain highlights Dornhain').toBe('Dornhain');
    expect(sDorn.domZoomActiveText).toContain('Dornhain');
    expect(sDorn.activeDepth).toBe(4);
    expect(sDorn.breadcrumbLen).toBeGreaterThanOrEqual(3);
    expect(sDorn.terrainMaxLod, 'Phase 1: same ground sampled finer at Dornhain than at planet span=530').toBeGreaterThan(
      sWorld.terrainMaxLod,
    );

    // Zoom back OUT to Nordreich (span 25) → Ebenen highlight returns cleanly to Nordreich!
    const sBackNord = await captureStep('zoom-out-nordreich-25', pts.dornhain, 25, 8, 'lod-05-zoom-out-nordreich.png');
    expect(sBackNord.activeLabelDe, 'Phase 3: zooming back out restores Nordreich highlight').toBe('Nordreich');
    expect(sBackNord.domZoomActiveText).toContain('Nordreich');
    expect(sBackNord.activeDepth).toBe(3);

    // Phase 2.1 assertion: verify at least one child map exhibited intermediate opacity (0.02 < op < 0.96)
    // proving smooth continuous crossfade instead of a 0→100% single-frame switch!
    const intermediateSamples: Array<{ step: string; mapId: string; opacity: number; detailWeight: number }> = [];
    for (const row of trace) {
      for (const [mapId, info] of Object.entries(row.groupOpacities)) {
        if (info.depth > 1 && info.opacity > 0.02 && info.opacity < 0.96) {
          intermediateSamples.push({
            step: row.step,
            mapId,
            opacity: info.opacity,
            detailWeight: info.detailWeight,
          });
        }
      }
    }
    expect(
      intermediateSamples.length,
      `Phase 2.1: expected smooth intermediate opacities (0 < op < 1) across zoom trace, got ${JSON.stringify(intermediateSamples)}`,
    ).toBeGreaterThan(0);

    writeFileSync(
      join(LOD_EVIDENCE_DIR, 'zoom-trace.json'),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          intermediateOpacityCount: intermediateSamples.length,
          intermediateSamples: intermediateSamples.slice(0, 12),
          trace,
        },
        null,
        2,
      )}\n`,
    );
  });

  test('M-1: real canvas mouse-drag within bounds stays direct; dragging past border triggers live indicator + SCM grow dialog', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const pts = computeZoomPoints();

    await page.setViewportSize({ width: 1280, height: 800 });
    await openDornhainAtlas3d(page);
    await waitSpatialReady(page);

    // Ensure confirmGrow is enabled so pointer-drag breach opens the German dialog
    await page.evaluate(() => {
      localStorage.removeItem('sagatree.atlas.spatialEditPrefs.v1');
    });
    await reloadAtlasAndWait(page);

    // Zoom cleanly over Dornhain in top-down view for deterministic mouse picking & drag
    await page.evaluate((p) => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      b?.setView({ mode: 'ortho-topdown', x: p.x + 0.5, z: p.y, span: 3.4, yawRad: 0 }, false);
    }, pts.dornhain);
    await waitRaf(page, 14);

    // Activate Bewegen (Move) tool via UI button
    const toolsBtn = page.locator('[data-atlas-panel-fold="tools"]').first();
    if ((await toolsBtn.getAttribute('aria-expanded')) !== 'true') {
      await toolsBtn.click();
    }
    await page.locator('[data-atlas-3d-tool="move"]').first().click();

    // Locate a pickable building inside Dornhain + canvas screen coordinates
    const dragPlan = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      const st = b?.getSpatialState();
      const canvas = document.querySelector<HTMLCanvasElement>('[data-atlas-three-workstation] canvas');
      if (!b || !st || !canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const settlement = Object.values(st.entities).find((e) => e.role === 'settlement' && e.labelDe === 'Dornhain');
      const country = Object.values(st.entities).find((e) => e.role === 'country' && e.labelDe === 'Nordreich');
      if (!settlement || !country) return null;

      const buildings = Object.values(st.entities).filter(
        (e) => e.carrierId === settlement.id && e.role === 'building' && e.status === 'active',
      );
      for (const bld of buildings) {
        const cx = (bld.boundsWorld.minX + bld.boundsWorld.maxX) / 2;
        const cy = (bld.boundsWorld.minY + bld.boundsWorld.maxY) / 2;
        const scr = b.projectWorldToScreen(cx, cy);
        if (!scr.visible) continue;
        // Try center + slight offset in case roof/mesh is slightly elevated
        let hitId: string | null = null;
        let hitPx = scr.px;
        let hitPy = scr.py;
        for (const [ox, oy] of [
          [0, 0],
          [0, -4],
          [4, 0],
          [-4, 0],
          [0, 4],
        ]) {
          const id = b.pickAt(scr.px + ox, scr.py + oy);
          if (id && bld.id.endsWith(`:${id}`)) {
            hitId = id;
            hitPx = scr.px + ox;
            hitPy = scr.py + oy;
            break;
          }
        }
        if (!hitId) continue;

        const insideTarget = b.projectWorldToScreen(cx + 0.08, cy);
        const outsideTarget = b.projectWorldToScreen(settlement.boundsWorld.maxX + 0.55, cy);
        if (!insideTarget.visible || !outsideTarget.visible) continue;

        return {
          settlementId: settlement.id,
          countryId: country.id,
          settlementOrigMaxX: settlement.boundsWorld.maxX,
          countryOrigMaxX: country.boundsWorld.maxX,
          buildingId: bld.id,
          featureId: hitId,
          startClientX: rect.left + hitPx,
          startClientY: rect.top + hitPy,
          insideClientX: rect.left + insideTarget.px,
          insideClientY: rect.top + insideTarget.py,
          outsideClientX: rect.left + outsideTarget.px,
          outsideClientY: rect.top + outsideTarget.py,
        };
      }
      return null;
    });

    expect(dragPlan, 'M-1: pickable building inside Dornhain found on canvas').toBeTruthy();

    const dialog = page.locator('[data-atlas-scm-confirm-dialog]').first();
    const breachBadge = page.locator('[data-atlas-scm-drag-breach]').first();

    // M-1a: Real pointer drag WITHIN Dornhain bounds → NO breach badge, NO dialog!
    await page.mouse.move(dragPlan!.startClientX, dragPlan!.startClientY);
    await page.mouse.down();
    await page.mouse.move(dragPlan!.insideClientX, dragPlan!.insideClientY, { steps: 6 });
    await expect(breachBadge).toBeHidden();
    await expect(dialog).toBeHidden();
    await waitForAtlasPersistResponse(page, async () => {
      await page.mouse.up();
    });
    await expect(dialog).toBeHidden();

    // M-1b: Real pointer drag OVER Dornhain's east border → live breach indicator mid-drag, dialog on pointerup!
    await page.mouse.move(dragPlan!.insideClientX, dragPlan!.insideClientY);
    await page.mouse.down();
    await page.mouse.move(dragPlan!.outsideClientX, dragPlan!.outsideClientY, { steps: 12 });
    await expect(breachBadge, 'M-1: live Gold breach indicator shown mid-drag').toBeVisible();
    await expect(breachBadge).toContainText('Dornhain');
    await expect(dialog, 'M-1: confirmation dialog must NOT open mid-drag').toBeHidden();
    await page.screenshot({ path: join(EVIDENCE_DIR, 'scm-m1-drag-breach-live.png') });

    // Release pointer → confirmation dialog opens cleanly!
    await page.mouse.up();
    await expect(dialog, 'M-1: confirmation dialog opens on pointerup').toBeVisible();
    await expect(dialog).toHaveAttribute('data-atlas-scm-confirm-kind', 'grow');
    await expect(page.locator('[data-atlas-scm-confirm-summary]').first()).toContainText('Dornhain');
    await page.screenshot({ path: join(EVIDENCE_DIR, 'scm-m1-drag-grow-dialog.png'), animations: 'disabled' });

    // Confirm → ONLY Dornhain grows (Nordreich untouched!)
    await waitForAtlasPersistResponse(page, async () => {
      await page.locator('[data-atlas-scm-confirm]').first().click();
    });
    await expect(dialog).toBeHidden();

    const afterDragGrow = await page.evaluate(
      ({ sid, cid }) => {
        const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
        const st = b?.getSpatialState();
        return {
          settlementMaxX: st?.entities[sid]?.boundsWorld.maxX ?? 0,
          countryMaxX: st?.entities[cid]?.boundsWorld.maxX ?? 0,
        };
      },
      { sid: dragPlan!.settlementId, cid: dragPlan!.countryId },
    );
    expect(afterDragGrow.settlementMaxX, 'M-1: Dornhain grew after mouse-drag confirm').toBeGreaterThan(
      dragPlan!.settlementOrigMaxX + 0.1,
    );
    expect(afterDragGrow.countryMaxX, 'M-1: Nordreich untouched (INV-3 stop)').toBeCloseTo(
      dragPlan!.countryOrigMaxX,
      3,
    );

    // 2× Undo (grow + prior in-bounds move) restores Dornhain cleanly in SQLite for subsequent tests
    await page.evaluate(async () => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      await b?.undoSpatial();
      await b?.undoSpatial();
    });
    await page.waitForTimeout(400);

    const afterUndo = await page.evaluate((sid) => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.getSpatialState().entities[sid]?.boundsWorld.maxX ?? 0;
    }, dragPlan!.settlementId);
    expect(afterUndo, 'M-1: undo restores original Dornhain border').toBeCloseTo(
      dragPlan!.settlementOrigMaxX,
      3,
    );

    writeFileSync(
      join(EVIDENCE_DIR, 'scm-m1-mouse-drag.json'),
      `${JSON.stringify({ capturedAt: new Date().toISOString(), dragPlan, afterDragGrow, afterUndo }, null, 2)}\n`,
    );
  });

  test('SCM-01/05/06/08 + L-2 + M-2: freeland dialog subtitle, Nicht mehr nachfragen, SQLite Undo/Redo reload persistence & soft-cascade', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });

    await page.setViewportSize({ width: 1280, height: 800 });
    await openDornhainAtlas3d(page);
    await waitSpatialReady(page);
    await page.evaluate(() => {
      localStorage.removeItem('sagatree.atlas.spatialEditPrefs.v1');
    });
    await reloadAtlasAndWait(page);

    // 1. Verify default preferences ON (`spatialEdit.confirmGrow = true`, `confirmCascade = true`)
    const initPrefs = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.getSpatialPrefs() ?? null;
    });
    expect(initPrefs).toEqual({ confirmGrow: true, confirmCascade: true });

    // Open Werkzeuge and verify both switches are rendered & checked
    const toolsBtn = page.locator('[data-atlas-panel-fold="tools"]').first();
    if ((await toolsBtn.getAttribute('aria-expanded')) !== 'true') {
      await toolsBtn.click();
    }
    const growToggle = page.locator('[data-atlas-pref-confirm-grow]').first();
    const cascadeToggle = page.locator('[data-atlas-pref-confirm-cascade]').first();
    await expect(growToggle).toBeVisible();
    await expect(growToggle).toBeChecked();
    await expect(cascadeToggle).toBeChecked();

    // 2. SCM-01 + L-2: Auto-Grow over settlement border → dialog opens with `Freiland-Strukturen` (NEVER `Soft-Kaskade`!)
    const growTarget = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      const st = b?.getSpatialState();
      if (!st) return null;
      const settlement = Object.values(st.entities).find((e) => e.role === 'settlement' && e.labelDe === 'Dornhain');
      if (!settlement) return null;
      const building = Object.values(st.entities).find(
        (e) => e.carrierId === settlement.id && e.role === 'building',
      );
      if (!building) return null;
      return {
        settlementId: settlement.id,
        settlementOrigMaxX: settlement.boundsWorld.maxX,
        buildingId: building.id,
        buildingBounds: building.boundsWorld,
        nextMaxX: settlement.boundsWorld.maxX + 0.4,
      };
    });
    expect(growTarget, 'Dornhain settlement + building found in SpatialWorldModel').toBeTruthy();

    const firstGrowReq = await page.evaluate((t) => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.requestSpatialIntent({
        kind: 'resize_or_move',
        entityId: t.buildingId,
        nextBoundsWorld: {
          minX: t.buildingBounds.minX,
          minY: t.buildingBounds.minY,
          maxX: t.nextMaxX,
          maxY: t.buildingBounds.maxY,
        },
      });
    }, growTarget!);
    expect(firstGrowReq?.ok).toBe(true);
    expect(firstGrowReq?.prompted).toBe(true);

    const dialog = page.locator('[data-atlas-scm-confirm-dialog]').first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('data-atlas-scm-confirm-kind', 'grow');
    await expect(page.locator('[data-atlas-scm-confirm-summary]').first()).toContainText('Dornhain');

    // L-2 assertion: Grow + freeland rerouting MUST show `Freiland-Strukturen (umgeleitet/gekappt):` and NEVER `Soft-Kaskade`!
    const freelandNotice = page.locator('[data-atlas-scm-freeland-notice]').first();
    await expect(freelandNotice, 'L-2: Freiland-Strukturen notice visible on grow with rerouted roads/rivers').toBeVisible();
    await expect(freelandNotice).toContainText('Freiland-Strukturen (umgeleitet/gekappt):');
    await expect(page.locator('[data-atlas-scm-cascade-notice]')).toHaveCount(0);
    await expect(dialog).not.toContainText('Soft-Kaskade');

    await page.screenshot({ path: join(EVIDENCE_DIR, 'scm-01-grow-confirm-dialog.png'), animations: 'disabled' });
    await page.screenshot({ path: join(EVIDENCE_DIR, 'scm-l2-freeland-subtitle.png'), animations: 'disabled' });

    // Check „Nicht mehr nachfragen“ + Bestätigen (wait for SQLite persist!)
    await page.locator('[data-atlas-scm-dont-ask]').first().check();
    await waitForAtlasPersistResponse(page, async () => {
      await page.locator('[data-atlas-scm-confirm]').first().click();
    });
    await expect(dialog).toBeHidden();

    const prefsAfterDismiss = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.getSpatialPrefs();
    });
    expect(prefsAfterDismiss).toEqual({ confirmGrow: false, confirmCascade: true });

    // 3. M-2a: Grow → Undo (persists back to SQLite!) → Full Page Reload → original bounds verified!
    const undoGrowOk = await page.evaluate(async () => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return (await b?.undoSpatial()) ?? false;
    });
    expect(undoGrowOk, 'M-2a: undoSpatial resolves after SQLite persist').toBe(true);

    await reloadAtlasAndWait(page);

    const afterGrowUndoReloadMaxX = await page.evaluate((sid) => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.getSpatialState().entities[sid]?.boundsWorld.maxX ?? 0;
    }, growTarget!.settlementId);
    expect(afterGrowUndoReloadMaxX, 'M-2a: Grow → Undo persists back to SQLite across page reload').toBeCloseTo(
      growTarget!.settlementOrigMaxX,
      3,
    );

    // 4. M-2b + SCM-06: Grow (without prompt, confirmGrow=false) → Undo → Redo → Full Page Reload → Redo persisted!
    await waitForAtlasPersistResponse(page, async () => {
      const secondGrowReq = await page.evaluate((t) => {
        const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
        return b?.requestSpatialIntent({
          kind: 'resize_or_move',
          entityId: t.buildingId,
          nextBoundsWorld: {
            minX: t.buildingBounds.minX,
            minY: t.buildingBounds.minY,
            maxX: t.nextMaxX,
            maxY: t.buildingBounds.maxY,
          },
        });
      }, growTarget!);
      expect(secondGrowReq?.ok).toBe(true);
      expect(secondGrowReq?.prompted).toBe(false);
    });
    await expect(dialog).toBeHidden();

    // Undo then Redo (both await serialized SQLite persist via enqueuePersist!)
    const undoRedoOk = await page.evaluate(async () => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      const u = (await b?.undoSpatial()) ?? false;
      const r = (await b?.redoSpatial()) ?? false;
      return { u, r };
    });
    expect(undoRedoOk).toEqual({ u: true, r: true });

    await reloadAtlasAndWait(page);

    const afterRedoReloadMaxX = await page.evaluate((sid) => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.getSpatialState().entities[sid]?.boundsWorld.maxX ?? 0;
    }, growTarget!.settlementId);
    expect(afterRedoReloadMaxX, 'M-2b: Undo → Redo persists back to SQLite across page reload').toBeCloseTo(
      growTarget!.nextMaxX,
      3,
    );

    // 5. SCM-05 + M-2c: Soft-Cascade removal → confirm → Undo (persists back to SQLite!) → Reload → all children restored!
    const preCascadeSnapshot = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      const st = b?.getSpatialState();
      if (!st) return null;
      const country = Object.values(st.entities).find((e) => e.role === 'country' && e.labelDe === 'Nordreich');
      const dornhain = Object.values(st.entities).find((e) => e.role === 'settlement' && e.labelDe === 'Dornhain');
      if (!country || !dornhain) return null;
      const dornhainBuildings = Object.values(st.entities).filter(
        (e) => e.carrierId === dornhain.id && e.role === 'building' && e.status === 'active',
      ).length;
      return { countryId: country.id, dornhainId: dornhain.id, dornhainBuildings };
    });
    expect(preCascadeSnapshot?.countryId).toBeTruthy();
    expect(preCascadeSnapshot!.dornhainBuildings).toBeGreaterThan(0);

    const cascadeReq = await page.evaluate((cid) => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.requestSpatialIntent({ kind: 'remove', entityId: cid });
    }, preCascadeSnapshot!.countryId);
    expect(cascadeReq?.ok).toBe(true);
    expect(cascadeReq?.prompted).toBe(true);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('data-atlas-scm-confirm-kind', 'cascade');
    await expect(page.locator('[data-atlas-scm-cascade-notice]').first()).toContainText(
      'Soft-Kaskade (archiviert & rückholbar):',
    );
    await page.screenshot({ path: join(EVIDENCE_DIR, 'scm-05-cascade-confirm-dialog.png'), animations: 'disabled' });

    await waitForAtlasPersistResponse(page, async () => {
      await page.locator('[data-atlas-scm-confirm]').first().click();
    });
    await expect(dialog).toBeHidden();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
          return b?.getSpatialState().archivedCount ?? 0;
        }),
      )
      .toBeGreaterThan(1);

    // 1× Undo awaits serialized SQLite persist for all restored docs/anchors!
    const undoCascadeOk = await page.evaluate(async () => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return (await b?.undoSpatial()) ?? false;
    });
    expect(undoCascadeOk, 'M-2c: undoSpatial resolves after restoring SQLite maps').toBe(true);

    await reloadAtlasAndWait(page);

    const postCascadeUndoReload = await page.evaluate((did) => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      const st = b?.getSpatialState();
      const dornhainBuildings = Object.values(st?.entities ?? {}).filter(
        (e) => e.carrierId === did && e.role === 'building' && e.status === 'active',
      ).length;
      return {
        archivedCount: st?.archivedCount ?? -1,
        dornhainBuildings,
      };
    }, preCascadeSnapshot!.dornhainId);

    expect(postCascadeUndoReload.archivedCount, 'M-2c: zero archived entities after Soft-Cascade → Undo → Reload').toBe(0);
    expect(
      postCascadeUndoReload.dornhainBuildings,
      'M-2c: all Dornhain buildings restored in SQLite after Soft-Cascade → Undo → Reload',
    ).toBe(preCascadeSnapshot!.dornhainBuildings);

    // 6. SCM-08: Cycle reparent is rejected fail-closed with German alert
    const cycleRes = await page.evaluate((cid) => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.requestSpatialIntent({ kind: 'reparent', entityId: cid, nextCarrierId: cid });
    }, preCascadeSnapshot!.countryId);
    expect(cycleRes?.ok).toBe(false);
    await expect(page.locator('[data-atlas-scm-error]').first()).toBeVisible();

    // 7. SCM-06: Werkzeug-Einstellungen persist across full page reload (`localStorage`)
    const toolsBtnAfter = page.locator('[data-atlas-panel-fold="tools"]').first();
    if ((await toolsBtnAfter.getAttribute('aria-expanded')) !== 'true') {
      await toolsBtnAfter.click();
    }
    const growToggleAfter = page.locator('[data-atlas-pref-confirm-grow]').first();
    const cascadeToggleAfter = page.locator('[data-atlas-pref-confirm-cascade]').first();
    if (!(await growToggleAfter.isChecked())) await growToggleAfter.check();
    if (await cascadeToggleAfter.isChecked()) await cascadeToggleAfter.uncheck();

    await reloadAtlasAndWait(page);

    const reloadedPrefs = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.getSpatialPrefs();
    });
    expect(reloadedPrefs).toEqual({ confirmGrow: true, confirmCascade: false });

    writeFileSync(
      join(EVIDENCE_DIR, 'scm-e2e-summary.json'),
      `${JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          growTarget,
          prefsAfterDismiss,
          afterGrowUndoReloadMaxX,
          afterRedoReloadMaxX,
          preCascadeSnapshot,
          postCascadeUndoReload,
          reloadedPrefs,
          cycleRejectedDe: cycleRes?.reasonDe ?? null,
        },
        null,
        2,
      )}\n`,
    );
  });
});
