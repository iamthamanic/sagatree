/**
 * Continuous Shared-World Zoom & Focus Journey — Host Browser-E2E.
 * Location: e2e/atlas-world-zoom-journey.spec.ts
 *
 * Uses strictly ephemeral host fixtures (`openDornhainAtlas3d`) — zero `/tmp` or user-data paths.
 * Verifies all 5 user journeys:
 *  1) Ebenen click on Dornhain stays in SAME world scene graph (`sameCanvas === true`, anchor-derived framing).
 *  2) Real `mouse.wheel` zoom World → Dornhain reveals Dornhain smoothly by `span <= 25` (`ownPerMapTerrainCount === 0`, `clearRootCount === 0`).
 *  3) In-world focus into Building (`Taverne Zum Flüstern`) → Room (`Schankraum`) keeps focus chain intact.
 *  4) Focus vs Edit separation ("Bearbeiten" → single-map editor → "Zurück zur Welt" without saving restores world camera).
 *  5) Rapid target switch + duplicate click + keyboard `Enter` + Phone (390×844) & Tablet (768×1024) touch targets >= 44px.
 */
import { expect, test, type Page } from '@playwright/test';
import { openDornhainAtlas3d, waitAtlas3dReady } from './helpers/atlas-host';

const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';

type AtlasBridgeState = {
  readonly clearRootCount: number;
  readonly layersOpen: boolean;
  readonly editMode: 'world-focus' | 'document-edit';
  readonly focusIntent: {
    readonly targetMapId: string;
    readonly targetPlaceId: string | null;
    readonly labelDe: string;
    readonly phase: 'flying' | 'arrived';
  } | null;
  readonly unlocatedNotice: {
    readonly mapId: string;
    readonly labelDe: string;
    readonly reasonDe: string;
  } | null;
  readonly camera: {
    readonly mode: string;
    readonly x: number;
    readonly z: number;
    readonly span: number;
    readonly yawRad: number;
    readonly pitchRad: number;
  };
  readonly multiMap: {
    readonly activeMapIds: readonly string[];
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
  };
  readonly zoomLayer: {
    readonly activeMapId: string | null;
    readonly activeLabelDe: string;
    readonly activeDepth: number;
    readonly isWorldRoot: boolean;
  };
};

type AtlasBridge = {
  readonly getState: () => AtlasBridgeState;
  readonly setView: (
    next: Partial<{
      readonly mode: string;
      readonly x: number;
      readonly z: number;
      readonly span: number;
      readonly yawRad: number;
      readonly pitchRad: number;
    }>,
    animate?: boolean,
  ) => void;
  readonly projectWorldToScreen: (
    worldX: number,
    worldZ: number,
    worldY?: number,
  ) => { readonly px: number; readonly py: number; readonly visible: boolean } | null;
  readonly pickWorldPointAtScreen: (
    px: number,
    py: number,
  ) => {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly hitKind: 'surface' | 'terrain' | 'plane';
  } | null;
  readonly getWorldBoundsForMap?: (mapId: string) => {
    readonly minX: number;
    readonly minY: number;
    readonly maxX: number;
    readonly maxY: number;
  } | null;
};

async function getBridgeState(page: Page): Promise<AtlasBridgeState> {
  return page.evaluate(() => {
    const b = (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas;
    if (!b) throw new Error('window.__sagatreeAtlas bridge missing');
    return b.getState();
  });
}

async function waitRaf(page: Page, frames = 10): Promise<void> {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const step = () => {
          i += 1;
          if (i >= n) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    frames,
  );
}

async function ensureLayersOpen(page: Page): Promise<void> {
  const drawer = page.locator('aside[aria-label="Welthierarchie und Ebenen"]');
  if (await drawer.isVisible().catch(() => false)) return;
  await page.locator('[data-atlas-panel-fold="layers"]').click();
  await expect(drawer).toBeVisible({ timeout: 8000 });
}

test.describe('Shared World Space — Continuous Zoom & Focus Journey', () => {
  test.skip(!HOST, 'Requires SAGATREE_BROWSER_E2E_HOST=1');

  test('Journeys 1–5: Ebenen focus, smooth wheel zoom, building/room, edit return, robustness & AU viewports', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1280, height: 800 });
    await openDornhainAtlas3d(page);
    await waitAtlas3dReady(page);
    await waitRaf(page, 18);

    // Wait for Multi-Map World Scene Graph hydration
    await expect
      .poll(async () => (await getBridgeState(page)).multiMap.activeMapIds.length, { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);

    const initialState = await getBridgeState(page);
    expect(initialState.terrain.enabled).toBe(true);
    expect(initialState.multiMap.ownPerMapTerrainCount).toBe(0);
    expect(initialState.clearRootCount).toBe(0);

    // Tag canvas instance to assert zero remount across in-world focus transitions
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas[aria-label="Interaktive Three.js 3D-Weltkarte"]');
      if (canvas) (canvas as HTMLElement).dataset.journeyCanvasTag = 'world-canvas-1';
    });

    // ─── Journey 1: Real Ebenen click on Dornhain stays in SAME world scene graph ───
    await ensureLayersOpen(page);
    const navButtons = page.locator(
      'aside[aria-label="Welthierarchie und Ebenen"] button[data-atlas-nav-node]',
    );
    const dornBtn = navButtons.filter({ hasText: 'Dornhain' }).first();
    await expect(dornBtn).toBeVisible();
    await dornBtn.click();

    await expect
      .poll(async () => (await getBridgeState(page)).focusIntent?.phase, { timeout: 10_000 })
      .toBe('arrived');
    await waitRaf(page, 16);

    const sameCanvasAfterJ1 = await page.evaluate(() => {
      const canvas = document.querySelector(
        'canvas[aria-label="Interaktive Three.js 3D-Weltkarte"]',
      ) as HTMLElement | null;
      return canvas?.dataset.journeyCanvasTag === 'world-canvas-1';
    });
    expect(sameCanvasAfterJ1).toBe(true);

    const j1State = await getBridgeState(page);
    expect(j1State.editMode).toBe('world-focus');
    expect(j1State.clearRootCount).toBe(0);
    expect(j1State.multiMap.ownPerMapTerrainCount).toBe(0);
    expect(j1State.camera.span).toBeLessThan(12);
    expect(j1State.camera.span).toBeGreaterThan(1);
    expect(j1State.multiMap.activeMapIds.length).toBeGreaterThanOrEqual(4);
    expect(j1State.zoomLayer.activeLabelDe).toContain('Dornhain');
    const dornMapId = j1State.multiMap.activeEditorMapId!;
    const dornWorldPos = { x: j1State.camera.x, z: j1State.camera.z };

    // ─── Journey 2: Real mouse.wheel zoom from World Overview down to Dornhain ───
    await page.locator('[data-atlas-nav-root]').click();
    await expect
      .poll(async () => (await getBridgeState(page)).camera.span, { timeout: 10_000 })
      .toBeGreaterThan(350);
    await waitRaf(page, 12);

    // Close Ebenen drawer so the wheel hits the unobstructed canvas center
    await page.locator('[data-atlas-panel-fold="layers"]').click();
    await waitRaf(page, 4);

    const canvasBox = await page.locator('[data-atlas-three-workstation] canvas').first().boundingBox();
    expect(canvasBox).toBeTruthy();

    const opacities: number[] = [];
    let dornEnteredBeforeClose = false;
    for (let step = 0; step < 34; step++) {
      const pt = await page.evaluate(
        ({ wx, wz }) => {
          const b = (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas;
          return b?.projectWorldToScreen(wx, wz) ?? null;
        },
        { wx: dornWorldPos.x, wz: dornWorldPos.z },
      );
      const mx = pt?.visible
        ? canvasBox!.x + Math.max(40, Math.min(canvasBox!.width - 40, pt.px))
        : canvasBox!.x + canvasBox!.width / 2;
      const my = pt?.visible
        ? canvasBox!.y + Math.max(40, Math.min(canvasBox!.height - 40, pt.py))
        : canvasBox!.y + canvasBox!.height / 2;
      await page.mouse.move(mx, my);
      await page.mouse.wheel(0, -190);
      await waitRaf(page, 5);

      const st = await getBridgeState(page);
      expect(st.multiMap.ownPerMapTerrainCount).toBe(0);
      expect(st.clearRootCount).toBe(0);
      const grp = st.multiMap.groupOpacities[dornMapId];
      if (grp) {
        opacities.push(grp.opacity);
        if (st.camera.span >= 6) {
          dornEnteredBeforeClose = true;
        }
      }
      if (st.camera.span <= 2.5) break;
    }

    expect(dornEnteredBeforeClose).toBe(true);
    expect(opacities.some((op) => op > 0.05 && op < 0.95)).toBe(true);
    expect(opacities[opacities.length - 1] ?? 0).toBeGreaterThan(0.9);

    // ─── Phase A: Exact Cursor-Anchored Zoom Stability (Intermediate RAF + Settled < 2 px) ───
    const assertAnchoredZoom = async (opts: {
      readonly setup?: {
        readonly mode: string;
        readonly x: number;
        readonly z: number;
        readonly span: number;
        readonly yawRad: number;
        readonly pitchRad?: number;
      };
      readonly targetWorld: { readonly x: number; readonly z: number };
      readonly wheelDeltaY: number;
      readonly steps: number;
    }) => {
      if (opts.setup) {
        await page.evaluate((cam) => {
          (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas?.setView(cam, false);
        }, opts.setup);
        await waitRaf(page, 10);
      }
      const box = await page.locator('[data-atlas-three-workstation] canvas').first().boundingBox();
      expect(box).toBeTruthy();
      const rough = await page.evaluate(
        ({ wx, wz }) =>
          (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas?.projectWorldToScreen(
            wx,
            wz,
          ) ?? null,
        { wx: opts.targetWorld.x, wz: opts.targetWorld.z },
      );
      expect(rough?.visible).toBe(true);
      const mx = Math.round(box!.x + rough!.px);
      const my = Math.round(box!.y + rough!.py);
      const cpx = mx - box!.x;
      const cpy = my - box!.y;
      const picked = await page.evaluate(
        ({ px, py }) =>
          (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas?.pickWorldPointAtScreen(
            px,
            py,
          ) ?? null,
        { px: cpx, py: cpy },
      );
      expect(picked).toBeTruthy();
      const startProj = await page.evaluate(
        ({ x, y, z }) =>
          (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas?.projectWorldToScreen(
            x,
            z,
            y,
          ) ?? null,
        picked!,
      );
      expect(startProj?.visible).toBe(true);

      await page.mouse.move(mx, my);
      let maxDriftPx = 0;
      for (let s = 0; s < opts.steps; s += 1) {
        await page.mouse.wheel(0, opts.wheelDeltaY);
        for (let f = 0; f < 2; f += 1) {
          await waitRaf(page, 2);
          const curProj = await page.evaluate(
            ({ x, y, z }) =>
              (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas?.projectWorldToScreen(
                x,
                z,
                y,
              ) ?? null,
            picked!,
          );
          expect(curProj?.visible).toBe(true);
          const d = Math.hypot(curProj!.px - startProj!.px, curProj!.py - startProj!.py);
          if (d > maxDriftPx) maxDriftPx = d;
        }
      }
      await waitRaf(page, 24);
      const settledProj = await page.evaluate(
        ({ x, y, z }) =>
          (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas?.projectWorldToScreen(
            x,
            z,
            y,
          ) ?? null,
        picked!,
      );
      const settledDriftPx = Math.hypot(
        settledProj!.px - startProj!.px,
        settledProj!.py - startProj!.py,
      );
      expect(Math.max(maxDriftPx, settledDriftPx)).toBeLessThan(2.0);
    };

    // Off-center Diorama IN + OUT
    await assertAnchoredZoom({
      setup: { mode: 'diorama-oblique', x: 500, z: 500, span: 480, yawRad: 0.42 },
      targetWorld: dornWorldPos,
      wheelDeltaY: -180,
      steps: 8,
    });
    await assertAnchoredZoom({
      targetWorld: dornWorldPos,
      wheelDeltaY: 180,
      steps: 6,
    });
    // Rotated Yaw + Perspective over hilly terrain
    await assertAnchoredZoom({
      setup: { mode: 'perspective', x: 420, z: 450, span: 260, yawRad: -0.85, pitchRad: 0.85 },
      targetWorld: { x: 310, z: 340 },
      wheelDeltaY: -160,
      steps: 6,
    });
    // Ortho-topdown (Draufsicht) off-center zoom keeps exact PI/2 pitch
    await assertAnchoredZoom({
      setup: { mode: 'ortho-topdown', x: 340, z: 440, span: 300, yawRad: 0.35, pitchRad: Math.PI / 2 },
      targetWorld: dornWorldPos,
      wheelDeltaY: -180,
      steps: 5,
    });
    const orthoAfter = await getBridgeState(page);
    expect(Math.abs(orthoAfter.camera.pitchRad - Math.PI / 2)).toBeLessThan(0.01);

    // Restore Diorama world overview before Journey 3
    await page.evaluate(() => {
      (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas?.setView(
        { mode: 'diorama-oblique', x: 500, z: 500, span: 530, yawRad: 0.42 },
        false,
      );
    });
    await waitRaf(page, 10);

    // ─── Journey 3: Focus Building (Taverne Zum Flüstern) → Room (Schankraum) ───
    await ensureLayersOpen(page);
    await navButtons.filter({ hasText: 'Taverne Zum Flüstern' }).first().click();
    await expect
      .poll(async () => (await getBridgeState(page)).focusIntent?.phase, { timeout: 10_000 })
      .toBe('arrived');
    await waitRaf(page, 14);
    const j3Tavern = await getBridgeState(page);
    expect(j3Tavern.editMode).toBe('world-focus');
    expect(j3Tavern.camera.span).toBeLessThan(1.0);
    expect(j3Tavern.zoomLayer.activeLabelDe).toContain('Taverne');
    expect(j3Tavern.clearRootCount).toBe(0);

    await navButtons.filter({ hasText: 'Schankraum' }).first().click();
    await expect
      .poll(async () => (await getBridgeState(page)).focusIntent?.phase, { timeout: 10_000 })
      .toBe('arrived');
    await waitRaf(page, 14);
    const j3Room = await getBridgeState(page);
    expect(j3Room.editMode).toBe('world-focus');
    expect(j3Room.camera.span).toBeLessThan(j3Tavern.camera.span);
    expect(j3Room.zoomLayer.activeLabelDe).toContain('Schankraum');
    expect(j3Room.clearRootCount).toBe(0);
    // Phase B: truthful scale HUD never saturates at fake 2500%
    const roomScaleText = await page.locator('[data-atlas-scale-readout]').first().textContent();
    expect(roomScaleText).toBeTruthy();
    expect(roomScaleText).not.toContain('2500%');

    // ─── Journey 4: Focus vs Edit Separation ("Bearbeiten" → "Zurück zur Welt") ───
    await navButtons.filter({ hasText: 'Dornhain' }).first().click();
    await expect
      .poll(async () => (await getBridgeState(page)).focusIntent?.phase, { timeout: 10_000 })
      .toBe('arrived');
    await waitRaf(page, 10);
    const preEdit = await getBridgeState(page);

    const editBtn = page.locator('[data-atlas-open-edit-focused]').first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    await expect
      .poll(async () => (await getBridgeState(page)).editMode, { timeout: 12_000 })
      .toBe('document-edit');
    await waitRaf(page, 12);
    const inEdit = await getBridgeState(page);
    expect(inEdit.camera.span).toBeGreaterThan(60);
    // Medium finding guard: Ebenen badge stays locked to Dornhain in edit mode
    const editBadge = await page.locator('[data-atlas-zoom-level-badge]').first().textContent();
    expect(editBadge?.trim()).toBe('Dornhain');

    const returnBtn = page.locator('[data-atlas-return-world]').first();
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    await expect
      .poll(async () => (await getBridgeState(page)).editMode, { timeout: 12_000 })
      .toBe('world-focus');
    await waitRaf(page, 14);
    const returned = await getBridgeState(page);
    expect(Math.abs(returned.camera.x - preEdit.camera.x)).toBeLessThan(0.5);
    expect(Math.abs(returned.camera.z - preEdit.camera.z)).toBeLessThan(0.5);
    expect(Math.abs(returned.camera.span - preEdit.camera.span)).toBeLessThan(0.5);
    expect(returned.multiMap.activeEditorMapId).toBe(dornMapId);

    // ─── Journey 5: Rapid switch, duplicate click, keyboard Enter & Phone/Tablet AU check ───
    await ensureLayersOpen(page);
    await navButtons.filter({ hasText: 'Kontinent Ostmark' }).first().click();
    await page.waitForTimeout(80);
    await navButtons.filter({ hasText: 'Dornhain' }).first().click();
    await navButtons.filter({ hasText: 'Dornhain' }).first().click();
    await expect
      .poll(async () => (await getBridgeState(page)).focusIntent?.phase, { timeout: 10_000 })
      .toBe('arrived');
    await waitRaf(page, 10);
    const afterRapid = await getBridgeState(page);
    expect(afterRapid.multiMap.activeEditorMapId).toBe(dornMapId);

    const nordBtn = navButtons.filter({ hasText: 'Nordreich' }).first();
    await nordBtn.focus();
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await getBridgeState(page)).focusIntent?.phase, { timeout: 10_000 })
      .toBe('arrived');
    const afterKeyboard = await getBridgeState(page);
    expect(afterKeyboard.zoomLayer.activeLabelDe).toContain('Nordreich');

    for (const vp of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(vp);
      await waitRaf(page, 6);
      // Close layers drawer to test unobstructed cursor-anchored zoom on Phone & Tablet
      const drawer = page.locator('aside[aria-label="Welthierarchie und Ebenen"]');
      if (await drawer.isVisible().catch(() => false)) {
        await page.locator('[data-atlas-panel-fold="layers"]').click();
        await waitRaf(page, 4);
      }
      await assertAnchoredZoom({
        setup: { mode: 'diorama-oblique', x: 320, z: 420, span: 240, yawRad: 0.42 },
        targetWorld: dornWorldPos,
        wheelDeltaY: -160,
        steps: 4,
      });
      const metrics = await page.evaluate(() => {
        const vw = window.innerWidth;
        const docOverflow = document.documentElement.scrollWidth > vw + 2;
        const selectors = [
          '[data-atlas-panel-fold="layers"]',
          '[data-atlas-panel-fold="tools"]',
          '[data-atlas-bottom-taskbar] button[aria-label="Hineinzoomen"]',
          '[data-atlas-bottom-taskbar] button[aria-label="Herauszoomen"]',
        ];
        const targets = selectors
          .map((sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { sel, w: r.width, h: r.height, clipped: r.left < -1 || r.right > vw + 1 };
          })
          .filter(Boolean);
        return { docOverflow, targets };
      });
      expect(metrics.docOverflow).toBe(false);
      for (const t of metrics.targets) {
        expect(t!.h).toBeGreaterThanOrEqual(44);
        expect(t!.w).toBeGreaterThanOrEqual(44);
        expect(t!.clipped).toBe(false);
      }
    }

    expect(pageErrors).toEqual([]);
  });
});
