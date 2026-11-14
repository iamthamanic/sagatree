/**
 * atl2-g04-golden-visual — Real Custom-WebGL screenshot regression (#1232).
 * Location: e2e/atl2-g04-golden-visual.spec.ts
 *
 * Fingerprints alone do NOT pass G04. This HOST Browser E2E opens Dornhain
 * product maps, applies fixed fixture cameras, and pixel-diffs WebGL canvases
 * via Playwright toHaveScreenshot (fail-closed if baselines missing).
 */
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createJiti } from 'jiti';
import { ensureLoggedIn } from './helpers/auth';

const root = process.cwd();
const selfTest = join(root, 'scripts/atl2-g04-golden-visual.self-test.mjs');
const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';
const EVIDENCE = join(root, '.qa/evidence/atl2-g04-golden-visual');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const gv = jiti(join(root, 'src/domains/world/atlas/atlas-golden-visual.ts')) as {
  ATLAS_GOLDEN_VISUAL_FIXTURES: ReadonlyArray<{
    id: string;
    uiMapTitleDe: string;
    camera: {
      mode: string;
      x: number;
      z: number;
      span: number;
      yawRad: number;
      pitchRad: number;
    };
  }>;
  ATLAS_GOLDEN_VISUAL_TOLERANCE: { maxDiffPixelRatio: number; ciMode: string };
  ATLAS_GOLDEN_VISUAL_VIEWPORTS: ReadonlyArray<{
    id: string;
    width: number;
    height: number;
  }>;
  ATLAS_GOLDEN_VISUAL_MOBILE_FIXTURE_IDS: readonly string[];
};

const PIXEL_RATIO = gv.ATLAS_GOLDEN_VISUAL_TOLERANCE.maxDiffPixelRatio;

type AtlasBridge = {
  setCameraMode: (mode: string, opts?: { animate?: boolean }) => void;
  orbit: (yaw: number, pitch: number) => void;
  zoomAt?: (factor: number) => void;
  getState: () => { mode: string; product: { camera: { x: number; z: number } } | null };
};

async function waitAtlasReady(page: Page): Promise<void> {
  await expect(page.locator('[data-atlas-native-3d]').first()).toBeAttached({
    timeout: 60_000,
  });
  await expect(page.locator('[data-atlas-ready="true"]').first()).toBeVisible({
    timeout: 90_000,
  });
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const bridge = (
            window as unknown as { __sagatreeAtlas?: AtlasBridge }
          ).__sagatreeAtlas;
          return bridge?.getState()?.mode ?? 'missing';
        }),
      { timeout: 60_000 },
    )
    .toBe('webgl');
}

async function openDornhainAtlas3d(page: Page): Promise<{ worldId: string }> {
  await ensureLoggedIn(page);
  const origin = new URL(page.url()).origin;

  const ensure = await page.request.post('/api/v1/projects/ensure-starter', {
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    data: { slug: 'dornhain.whisper' },
  });
  expect(ensure.ok(), await ensure.text()).toBeTruthy();

  const worlds = await page.request.get('/api/v1/library/worlds', {
    headers: { Origin: origin },
  });
  const body = (await worlds.json()) as {
    worlds?: Array<{ id: string; title?: string; publicId?: string }>;
  };
  const dornhain = (body.worlds ?? []).find((w) => w.title === 'Dornhain');
  expect(dornhain?.publicId).toBeTruthy();

  await page.goto(`/library/worlds/${dornhain!.publicId}/map`);
  await expect(page.locator('[data-world-atlas-workbench]').first()).toBeVisible({
    timeout: 45_000,
  });

  const mode3d = page.locator('[data-atlas-surface-mode="3d"]').first();
  const mode2d = page.locator('[data-atlas-surface-mode="2d"]').first();
  await expect(mode3d.or(mode2d)).toBeVisible({ timeout: 60_000 });
  if ((await mode3d.count()) === 0) {
    await page.locator('[data-atlas-surface-toggle]').first().click();
  }
  await expect(mode3d).toBeVisible({ timeout: 60_000 });
  await waitAtlasReady(page);
  return { worldId: dornhain!.id };
}

async function ensureLayersOpen(page: Page): Promise<void> {
  // Product chrome collapses Ebenen on narrow panes — expand for nav rows.
  const layersBtn = page.getByRole('button', { name: /Ebenen/i }).first();
  if ((await layersBtn.count()) > 0) {
    const expanded = await layersBtn.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await layersBtn.click().catch(() => undefined);
    }
  }
  const sideToggle = page.locator('[data-action="side"]').first();
  if ((await sideToggle.count()) > 0) {
    const side = page.locator('#side').first();
    if ((await side.count()) > 0) {
      const wide = await side.evaluate((el) => el.getBoundingClientRect().width > 40);
      if (!wide) await sideToggle.click().catch(() => undefined);
    }
  }
}

/** Drill path from world root to the fixture map (product Dornhain hierarchy). */
const FIXTURE_DRILL: Record<string, readonly string[]> = {
  Welt: [],
  'Land Westmark': ['Kontinent Westmark', 'Land Westmark'],
  Dornhain: ['Kontinent Westmark', 'Land Westmark', 'Dornhain'],
  'Taverne Zum Flüstern': ['Kontinent Westmark', 'Land Westmark', 'Dornhain', 'Taverne Zum Flüstern'],
  'Krypta unter dem Hügel': ['Kontinent Westmark', 'Land Westmark', 'Dornhain', 'Krypta unter dem Hügel'],
};

async function clickMapTitle(page: Page, title: string): Promise<void> {
  await ensureLayersOpen(page);

  const labelBtn = page
    .getByRole('button', { name: new RegExp(`${title}\\s*öffnen|^${title}$`, 'i') })
    .first();
  if ((await labelBtn.count()) > 0) {
    await labelBtn.click({ force: true });
    await waitAtlasReady(page);
    await page.waitForTimeout(350);
    return;
  }

  const toggles = page.locator('[data-nav-toggle]');
  const toggleCount = await toggles.count();
  for (let i = 0; i < toggleCount; i += 1) {
    const t = toggles.nth(i);
    if ((await t.getAttribute('aria-expanded')) === 'false') {
      await t.click({ force: true }).catch(() => undefined);
    }
  }

  const focusRow = page
    .locator(
      '[data-atlas-nav-source="db"] .nav-focus, [data-atlas-nav-source="db"] [data-focus], [data-focus]',
    )
    .filter({ hasText: title })
    .first();
  if ((await focusRow.count()) > 0) {
    await focusRow.click({ force: true });
    await waitAtlasReady(page);
    await page.waitForTimeout(350);
    return;
  }

  // Workbench place/map rows often use the bare title as button text.
  const row = page.locator('button, [role="button"], [data-atlas-place-row]').filter({ hasText: title }).first();
  await expect(row).toBeAttached({ timeout: 30_000 });
  await row.click({ force: true });
  await waitAtlasReady(page);
  await page.waitForTimeout(350);
}

async function openFixtureMap(page: Page, uiMapTitleDe: string): Promise<void> {
  if (uiMapTitleDe === 'Welt') {
    const home = page.locator('[data-action="home"]').first();
    if ((await home.count()) > 0) {
      await home.click({ force: true }).catch(() => undefined);
    }
    // Breadcrumb / back to world root if available.
    const worldCrumb = page.getByRole('button', { name: /^Welt$/i }).first();
    if ((await worldCrumb.count()) > 0) {
      await worldCrumb.click({ force: true }).catch(() => undefined);
    }
    await waitAtlasReady(page);
    await page.waitForTimeout(300);
    return;
  }

  const drill = FIXTURE_DRILL[uiMapTitleDe] ?? [uiMapTitleDe];
  // Reset toward world so each fixture is reproducible.
  await openFixtureMap(page, 'Welt');
  for (const step of drill) {
    await clickMapTitle(page, step);
  }
}

async function applyFixtureCamera(
  page: Page,
  camera: {
    mode: string;
    x: number;
    z: number;
    span: number;
    yawRad: number;
    pitchRad: number;
  },
): Promise<void> {
  await page.evaluate((cam) => {
    const bridge = (
      window as unknown as {
        __sagatreeAtlas?: AtlasBridge & {
          getState: () => { span?: number; product: { camera: unknown } | null };
        };
      }
    ).__sagatreeAtlas;
    if (!bridge) throw new Error('__sagatreeAtlas missing');
    bridge.setCameraMode(cam.mode, { animate: false });
    bridge.orbit(cam.yawRad, cam.pitchRad);
    // Converge span toward fixture (deterministic zoom ladder).
    for (let i = 0; i < 16; i += 1) {
      const curSpan = Number(bridge.getState().span);
      if (!Number.isFinite(curSpan) || curSpan <= 0) break;
      const ratio = curSpan / cam.span;
      if (ratio > 0.92 && ratio < 1.08) break;
      if (typeof bridge.zoomAt === 'function') {
        bridge.zoomAt(ratio > 1 ? 0.82 : 1.22);
      } else {
        break;
      }
    }
  }, camera);
  await page.waitForTimeout(300);
}

function webglCanvas(page: Page) {
  return page.locator('[data-atlas-native-3d] canvas:not(.hidden)').first();
}

test.describe('ATL2-G04 golden visual regression', () => {
  test('host protocol self-test PASS', () => {
    expect(existsSync(selfTest)).toBeTruthy();
    const stdout = execFileSync(process.execPath, [selfTest], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    expect(stdout).toContain('"ok":true');
    expect(stdout).toContain('fingerprint-and-screenshot');
  });

  test('browser-host: Custom WebGL pixel-diff fixtures', async ({ page }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
    test.setTimeout(300_000);
    expect(gv.ATLAS_GOLDEN_VISUAL_TOLERANCE.ciMode).toBe('fingerprint-and-screenshot');
    mkdirSync(EVIDENCE, { recursive: true });

    const desktop = gv.ATLAS_GOLDEN_VISUAL_VIEWPORTS.find((v) => v.id === 'desktop');
    const mobile = gv.ATLAS_GOLDEN_VISUAL_VIEWPORTS.find((v) => v.id === 'mobile');
    expect(desktop && mobile).toBeTruthy();

    await page.setViewportSize({ width: desktop!.width, height: desktop!.height });
    await openDornhainAtlas3d(page);

    const captureLog: Array<{
      fixtureId: string;
      viewport: string;
      uiMapTitleDe: string;
      webgl: boolean;
    }> = [];

    for (const fixture of gv.ATLAS_GOLDEN_VISUAL_FIXTURES) {
      await openFixtureMap(page, fixture.uiMapTitleDe);
      await applyFixtureCamera(page, fixture.camera);
      const canvas = webglCanvas(page);
      await expect(canvas).toBeVisible({ timeout: 30_000 });

      // Evidence copy (raw) — compare is toHaveScreenshot below (fail-closed).
      await canvas.screenshot({
        path: join(EVIDENCE, `raw-${fixture.id}-desktop.png`),
      });

      await expect(canvas).toHaveScreenshot(`g04-${fixture.id}-desktop.png`, {
        maxDiffPixelRatio: PIXEL_RATIO,
        animations: 'disabled',
      });
      captureLog.push({
        fixtureId: fixture.id,
        viewport: 'desktop',
        uiMapTitleDe: fixture.uiMapTitleDe,
        webgl: true,
      });
    }

    // Mobile: required subset (world + tavern) — same productive Custom WebGL.
    await page.setViewportSize({ width: mobile!.width, height: mobile!.height });
    await waitAtlasReady(page);
    for (const id of gv.ATLAS_GOLDEN_VISUAL_MOBILE_FIXTURE_IDS) {
      const fixture = gv.ATLAS_GOLDEN_VISUAL_FIXTURES.find((f) => f.id === id);
      expect(fixture).toBeTruthy();
      await openFixtureMap(page, fixture!.uiMapTitleDe);
      await applyFixtureCamera(page, fixture!.camera);
      const canvas = webglCanvas(page);
      await expect(canvas).toBeVisible({ timeout: 30_000 });
      await canvas.screenshot({
        path: join(EVIDENCE, `raw-${fixture!.id}-mobile.png`),
      });
      await expect(canvas).toHaveScreenshot(`g04-${fixture!.id}-mobile.png`, {
        maxDiffPixelRatio: PIXEL_RATIO,
        animations: 'disabled',
      });
      captureLog.push({
        fixtureId: fixture!.id,
        viewport: 'mobile',
        uiMapTitleDe: fixture!.uiMapTitleDe,
        webgl: true,
      });
    }

    writeFileSync(
      join(EVIDENCE, 'capture-run.json'),
      JSON.stringify(
        {
          at: new Date().toISOString(),
          target: 'custom-webgl-prototype-runtime',
          maxDiffPixelRatio: PIXEL_RATIO,
          captures: captureLog,
        },
        null,
        2,
      ),
    );
  });
});
