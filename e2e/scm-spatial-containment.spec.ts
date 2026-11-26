/**
 * SCM-06 — Spatial Containment Model Host Browser-E2E (SCM-01 / SCM-05 / SCM-06 / SCM-07 / SCM-08).
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
      readonly groupCount: number;
      readonly activeEditorMapId: string | null;
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

test.describe('SCM — Spatial Containment Model (Host Browser E2E)', () => {
  test.skip(!HOST, 'requires SAGATREE_BROWSER_E2E_HOST=1 (npm run test:e2e)');

  test('SCM-07: zoom-driven layer indicator tracks Welt→…→Schankraum while tree stays open & clearRoot=0', async ({
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

    // Badge displays deepest level `Schankraum`
    await expect(page.locator('[data-atlas-zoom-level-badge]').first()).toContainText('Schankraum');
    await page.screenshot({ path: join(EVIDENCE_DIR, 'scm-07-zoom-layer-schankraum.png') });

    writeFileSync(
      join(EVIDENCE_DIR, 'scm-07-zoom-trace.json'),
      `${JSON.stringify({ capturedAt: new Date().toISOString(), observed }, null, 2)}\n`,
    );
  });

  test('SCM-01/05/06/08: confirmation dialogs, Nicht mehr nachfragen, persistent prefs, soft-cascade & atomic undo', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });

    await page.setViewportSize({ width: 1280, height: 800 });
    await openDornhainAtlas3d(page);
    await waitSpatialReady(page);

    // 1. Verify default preferences ON (`spatialEdit.confirmGrow = true`, `confirmCascade = true`)
    const initPrefs = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.getSpatialPrefs() ?? null;
    });
    expect(initPrefs).toEqual({ confirmGrow: true, confirmCascade: true });

    // Open Werkzeuge and verify both switches are rendered with 44px touch target & checked
    const toolsBtn = page.locator('[data-atlas-panel-fold="tools"]').first();
    await toolsBtn.click();
    const growToggle = page.locator('[data-atlas-pref-confirm-grow]').first();
    const cascadeToggle = page.locator('[data-atlas-pref-confirm-cascade]').first();
    await expect(growToggle).toBeVisible();
    await expect(growToggle).toBeChecked();
    await expect(cascadeToggle).toBeChecked();

    // 2. SCM-01: Auto-Grow over settlement border → German dialog opens → "Nicht mehr nachfragen" + Bestätigen
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
    await page.screenshot({ path: join(EVIDENCE_DIR, 'scm-01-grow-confirm-dialog.png'), animations: 'disabled' });

    // Check „Nicht mehr nachfragen“ + Bestätigen
    await page.locator('[data-atlas-scm-dont-ask]').first().check();
    await page.locator('[data-atlas-scm-confirm]').first().click();
    await expect(dialog).toBeHidden();

    // Wait for commit + verify Dornhain grew & confirmGrow is now false
    await expect
      .poll(async () =>
        page.evaluate((sid) => {
          const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
          return b?.getSpatialState().entities[sid]?.boundsWorld.maxX ?? 0;
        }, growTarget!.settlementId),
      )
      .toBeCloseTo(growTarget!.nextMaxX, 3);

    const prefsAfterDismiss = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.getSpatialPrefs();
    });
    expect(prefsAfterDismiss).toEqual({ confirmGrow: false, confirmCascade: true });

    // 3. SCM-06: Second grow edit runs WITHOUT dialog (confirmGrow=false), yet remains atomic + undoable!
    const secondGrowReq = await page.evaluate((t) => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.requestSpatialIntent({
        kind: 'resize_or_move',
        entityId: t.buildingId,
        nextBoundsWorld: {
          minX: t.buildingBounds.minX,
          minY: t.buildingBounds.minY,
          maxX: t.nextMaxX + 0.3,
          maxY: t.buildingBounds.maxY,
        },
      });
    }, growTarget!);
    expect(secondGrowReq?.ok).toBe(true);
    expect(secondGrowReq?.prompted).toBe(false);
    await expect(dialog).toBeHidden();

    await expect
      .poll(async () =>
        page.evaluate((sid) => {
          const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
          return b?.getSpatialState().entities[sid]?.boundsWorld.maxX ?? 0;
        }, growTarget!.settlementId),
      )
      .toBeCloseTo(growTarget!.nextMaxX + 0.3, 3);

    // Undo twice restores original Dornhain bounds atomically
    await page.evaluate(async () => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      await b?.undoSpatial();
      await b?.undoSpatial();
    });
    await expect
      .poll(async () =>
        page.evaluate((sid) => {
          const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
          return b?.getSpatialState().entities[sid]?.boundsWorld.maxX ?? 0;
        }, growTarget!.settlementId),
      )
      .toBeCloseTo(growTarget!.settlementOrigMaxX, 3);

    // 4. SCM-05: Soft-Cascade removal opens dialog listing contained children, archives recoverably, 1 Undo restores all
    const cascadeTargetId = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      const st = b?.getSpatialState();
      if (!st) return null;
      const country = Object.values(st.entities).find((e) => e.role === 'country' && e.labelDe === 'Nordreich');
      return country?.id ?? null;
    });
    expect(cascadeTargetId).toBeTruthy();

    const cascadeReq = await page.evaluate((cid) => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.requestSpatialIntent({ kind: 'remove', entityId: cid });
    }, cascadeTargetId!);
    expect(cascadeReq?.ok).toBe(true);
    expect(cascadeReq?.prompted).toBe(true);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('data-atlas-scm-confirm-kind', 'cascade');
    await page.screenshot({ path: join(EVIDENCE_DIR, 'scm-05-cascade-confirm-dialog.png'), animations: 'disabled' });

    await page.locator('[data-atlas-scm-confirm]').first().click();
    await expect(dialog).toBeHidden();

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
          return b?.getSpatialState().archivedCount ?? 0;
        }),
      )
      .toBeGreaterThan(1);

    // 1 Undo restores all archived descendants back to active!
    await page.evaluate(async () => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      await b?.undoSpatial();
    });
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
          return b?.getSpatialState().archivedCount ?? -1;
        }),
      )
      .toBe(0);

    // 5. SCM-08: Cycle reparent is rejected fail-closed with German alert
    const cycleRes = await page.evaluate((cid) => {
      const b = (window as unknown as { __sagatreeAtlas?: ScmBridge }).__sagatreeAtlas;
      return b?.requestSpatialIntent({ kind: 'reparent', entityId: cid, nextCarrierId: cid });
    }, cascadeTargetId!);
    expect(cycleRes?.ok).toBe(false);
    await expect(page.locator('[data-atlas-scm-error]').first()).toBeVisible();

    // 6. SCM-06: Werkzeug-Einstellungen persist across full page reload (`localStorage`)
    if (!(await growToggle.isChecked())) await growToggle.check();
    if (await cascadeToggle.isChecked()) await cascadeToggle.uncheck();

    await page.reload();
    await expect(page.locator('[data-world-atlas-workbench]').first()).toBeVisible({ timeout: 45_000 });
    await waitAtlas3dReady(page);
    await waitSpatialReady(page);

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
          reloadedPrefs,
          cycleRejectedDe: cycleRes?.reasonDe ?? null,
        },
        null,
        2,
      )}\n`,
    );
  });
});
