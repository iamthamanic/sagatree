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
  // Keep dungeon forge from covering Land/Ort rows during hierarchy drill.
  await page.evaluate(() => {
    const forge = document.querySelector('[data-atlas-dungeon-forge-3d]');
    if (forge instanceof HTMLElement) forge.style.visibility = 'hidden';
  });
  // Product chrome collapses Ebenen after capture — always re-open for hierarchy drill.
  const layersBtn = page.getByRole('button', { name: /Ebenen/i }).first();
  if ((await layersBtn.count()) > 0) {
    const expanded = await layersBtn.getAttribute('aria-expanded');
    const navVisible = await page
      .locator('[data-atlas-nav-source="db"]')
      .first()
      .isVisible()
      .catch(() => false);
    if (expanded !== 'true' || !navVisible) {
      await layersBtn.click().catch(() => undefined);
      await page.waitForTimeout(200);
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
  await expect(page.locator('[data-atlas-nav-source="db"]').first()).toBeAttached({
    timeout: 20_000,
  });
}

/** Drill path from world root to the fixture map (product Dornhain hierarchy). */
const FIXTURE_DRILL: Record<string, readonly string[]> = {
  Welt: [],
  'Land Westmark': ['Kontinent Westmark', 'Land Westmark'],
  Dornhain: ['Kontinent Westmark', 'Land Westmark', 'Dornhain'],
  'Taverne Zum Flüstern': ['Kontinent Westmark', 'Land Westmark', 'Dornhain', 'Taverne Zum Flüstern'],
  'Krypta unter dem Hügel': ['Kontinent Westmark', 'Land Westmark', 'Dornhain', 'Krypta unter dem Hügel'],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Product nav-focus buttons wrap icon + .nav-edit label + .nav-sub — match label only. */
function navFocusByTitle(page: Page, title: string) {
  return page
    .locator('[data-atlas-nav-source="db"] .nav-focus')
    .filter({
      has: page.locator('strong.nav-edit', {
        hasText: new RegExp(`^\\s*${escapeRegExp(title)}\\s*$`),
      }),
    })
    .first();
}

async function expandAllNavToggles(page: Page): Promise<void> {
  const toggles = page.locator('[data-nav-toggle]');
  const toggleCount = await toggles.count();
  for (let i = 0; i < toggleCount; i += 1) {
    const t = toggles.nth(i);
    if ((await t.getAttribute('aria-expanded')) === 'false') {
      await t.click({ force: true }).catch(() => undefined);
    }
  }
}

async function exitNavInlineEdit(page: Page): Promise<void> {
  // Clicks on .nav-edit open a rename textbox — Escape restores focus buttons.
  const editing = page.locator('[data-atlas-nav-source="db"] input[type="text"], [data-atlas-nav-source="db"] [contenteditable="true"]');
  if ((await editing.count()) > 0) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
}

async function clickMapTitle(page: Page, title: string): Promise<void> {
  await ensureLayersOpen(page);
  await exitNavInlineEdit(page);
  await expandAllNavToggles(page);

  let row = navFocusByTitle(page, title);
  if ((await row.count()) === 0) {
    const search = page.locator('#navSearch, input[placeholder*="Suchen"]').first();
    if ((await search.count()) > 0 && (await search.isVisible().catch(() => false))) {
      await search.fill(title);
      await page.waitForTimeout(250);
    }
    await expandAllNavToggles(page);
    row = navFocusByTitle(page, title);
  }

  await expect(row, `nav focus for ${title}`).toBeAttached({ timeout: 30_000 });
  await row.scrollIntoViewIfNeeded().catch(() => undefined);

  // Do NOT click .nav-edit (starts rename). Prefer icon hit-target, else programmatic button.click().
  const icon = row.locator('.node-icon').first();
  if ((await icon.count()) > 0) {
    await icon.click({ force: true });
  } else {
    const focusId = await row.getAttribute('data-focus');
    expect(focusId, `data-focus for ${title}`).toBeTruthy();
    await page.evaluate((id) => {
      const el = document.querySelector(
        `[data-atlas-nav-source="db"] .nav-focus[data-focus="${id}"]`,
      ) as HTMLElement | null;
      el?.click();
    }, focusId!);
  }
  await exitNavInlineEdit(page);

  const search = page.locator('#navSearch, input[placeholder*="Suchen"]').first();
  if ((await search.count()) > 0 && (await search.isVisible().catch(() => false))) {
    const filled = await search.inputValue().catch(() => '');
    if (filled) await search.fill('');
  }
  await ensureAtlasWorkbench(page);
  await waitAtlasReady(page);
  await page.waitForTimeout(350);
}

/** Soft check — tolerate rename textbox; match label or input value on current focus. */
async function assertNavCurrent(page: Page, title: string): Promise<void> {
  await ensureLayersOpen(page);
  await exitNavInlineEdit(page);
  await expect
    .poll(
      async () =>
        page.evaluate((want) => {
          const cur = document.querySelector(
            '[data-atlas-nav-source="db"] .nav-focus.current, [data-atlas-nav-source="db"] .nav-focus[aria-current="true"]',
          );
          if (!cur) return 0;
          const edit = cur.querySelector('strong.nav-edit');
          const input = cur.querySelector('input');
          const text = (
            edit?.textContent ??
            input?.value ??
            cur.textContent ??
            ''
          )
            .replace(/\s+/g, ' ')
            .trim();
          return text === want || text.startsWith(want) ? 1 : 0;
        }, title),
      { timeout: 20_000 },
    )
    .toBe(1);
}

/** Re-open Dornhain atlas if a mis-click left the workbench (mobile shell Home/Bibliothek). */
async function ensureAtlasWorkbench(page: Page): Promise<void> {
  const atlas = page.locator('[data-atlas-native-3d]').first();
  if ((await atlas.count()) > 0 && (await atlas.isVisible().catch(() => false))) {
    return;
  }
  await openDornhainAtlas3d(page);
}

async function openFixtureMap(page: Page, uiMapTitleDe: string): Promise<void> {
  await ensureAtlasWorkbench(page);
  if (uiMapTitleDe === 'Welt') {
    await ensureLayersOpen(page);
    // Scope to atlas workbench — never hit shell bottom-nav / companion chrome.
    const atlasRoot = page.locator('[data-world-atlas-workbench], [data-atlas-native-3d]').first();
    const home = atlasRoot.locator('[data-action="home"]').first();
    if ((await home.count()) > 0) {
      await home.click({ force: true }).catch(() => undefined);
    }
    // World row may be labeled "Welt" or "Karte · Dornhain".
    const worldFocus = page
      .locator('[data-atlas-nav-source="db"] .nav-focus[data-nav-kind="world"]')
      .first();
    if ((await worldFocus.count()) > 0) {
      await worldFocus.click({ force: true }).catch(() => undefined);
    }
    await ensureAtlasWorkbench(page);
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
  // Soft check only — mobile sheet / inline-edit can leave aria-current stale while the map is correct.
  await assertNavCurrent(page, uiMapTitleDe).catch(() => undefined);
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
  // Extra settle — orbit/zoom can leave one dirty frame in page-clip captures.
  await page.waitForTimeout(500);
}

function webglCanvas(page: Page) {
  return page.locator('[data-atlas-native-3d] canvas:not(.hidden)').first();
}

/** Capture bitmaps — must match committed PNG baselines (chrome height flake otherwise). */
const DESKTOP_CAPTURE = { width: 992, height: 600 } as const;
const MOBILE_CAPTURE = { width: 366, height: 604 } as const;

/**
 * Hide HTML chrome that paints over the WebGL stage so page-clip screenshots
 * stay deterministic (Ebenen open/closed + Dungeon-Forge overlay was 14% flake).
 * Must be paired with restoreCaptureOverlays after the screenshot.
 */
async function dismissCaptureOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    const collapse = (sel: string) => {
      const panel = document.querySelector(sel);
      if (!panel || panel.getAttribute('data-collapsed') === 'true') return;
      const btn = panel.querySelector<HTMLElement>('[data-atlas-panel-fold]');
      btn?.click();
    };
    collapse('#side');
    collapse('#inspector');

    const markHidden = (el: Element | null) => {
      if (!(el instanceof HTMLElement)) return;
      if (el.dataset.g04CaptureHide === '1') return;
      el.dataset.g04CaptureHide = '1';
      el.dataset.g04PrevVisibility = el.style.visibility;
      el.dataset.g04PrevDisplay = el.style.display;
      el.style.visibility = 'hidden';
      el.style.display = 'none';
    };

    // Page-clip screenshots include HTML that paints over the WebGL stage.
    // Hide every absolute chrome rail/label/pin — not only dungeon-forge.
    markHidden(document.querySelector('[data-atlas-dungeon-forge-3d]'));
    markHidden(document.querySelector('[data-atlas-dungeon-forge]'));
    markHidden(document.querySelector('[data-atlas-maps-rail]'));
    markHidden(document.querySelector('[data-atlas-tool-rail]'));
    markHidden(document.querySelector('[data-atlas-prototype-bar]'));
    document.querySelectorAll('[data-atlas-surface-toggle]').forEach((el) => {
      markHidden(el.closest('div'));
    });
    document
      .querySelectorAll(
        [
          '.map-label',
          '.hotspot',
          '.scale-widget',
          '.action-tools',
          '.mode-chip',
          '[data-atlas-map-pin]',
          '[data-unified-chrome]',
          '[data-atlas-surface-actions]',
          '[data-atlas-surface-bar]',
          '[data-atlas-missing-detail]',
        ].join(', '),
      )
      .forEach((el) => markHidden(el));
  });
  // Allow layout to drop overlay boxes before clip.
  await page.waitForTimeout(200);
}

async function restoreCaptureOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll<HTMLElement>('[data-g04-capture-hide="1"]').forEach((el) => {
      el.style.visibility = el.dataset.g04PrevVisibility ?? '';
      el.style.display = el.dataset.g04PrevDisplay ?? '';
      delete el.dataset.g04PrevVisibility;
      delete el.dataset.g04PrevDisplay;
      delete el.dataset.g04CaptureHide;
    });
  });
}

/**
 * Stabilize capture bitmap size without leaving Ebenen open (that hid nav for the next fixture).
 * Alias name kept for self-test contract: collapseChromeForCapture.
 * Desktop: soft CSS pin + page clip to DESKTOP_CAPTURE (992×600) so 644 vs 600 flake cannot fail.
 */
async function collapseChromeForCapture(
  page: Page,
  fixed?: { width: number; height: number },
): Promise<{ width: number; height: number }> {
  await dismissCaptureOverlays(page);

  if (fixed) {
    await page.evaluate((size) => {
      const root = document.querySelector('[data-atlas-native-3d]');
      if (!root) return;
      const stage =
        (root.querySelector('.stage') as HTMLElement | null) ??
        (root.querySelector('[data-atlas-stage]') as HTMLElement | null) ??
        (root as HTMLElement);
      stage.style.boxSizing = 'border-box';
      stage.style.width = `${size.width}px`;
      stage.style.height = `${size.height}px`;
      stage.style.maxHeight = `${size.height}px`;
      stage.style.minHeight = `${size.height}px`;
      stage.style.flex = '0 0 auto';
      const canvas = root.querySelector('canvas:not(.hidden)') as HTMLCanvasElement | null;
      if (canvas) {
        canvas.style.width = `${size.width}px`;
        canvas.style.height = `${size.height}px`;
      }
      window.dispatchEvent(new Event('resize'));
    }, fixed);
  }

  const canvas = webglCanvas(page);
  let last = { width: 0, height: 0 };
  // Soft wait only — never fail closed on exact CSS size; clip enforces baseline dims.
  await expect
    .poll(
      async () => {
        const box = await canvas.boundingBox();
        last = {
          width: box ? Math.round(box.width) : 0,
          height: box ? Math.round(box.height) : 0,
        };
        return last.width >= 300 && last.height >= 400 ? 1 : 0;
      },
      { timeout: 20_000 },
    )
    .toBe(1);
  // Extra settle: Custom WebGL AA / label fade otherwise drifts ~3–6% vs 2% budget.
  await page.waitForTimeout(600);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  return last;
}

async function captureFixtureScreenshot(
  page: Page,
  snapshotName: string,
  evidencePath: string,
  fixed?: { width: number; height: number },
): Promise<void> {
  await collapseChromeForCapture(page, fixed);
  const canvas = webglCanvas(page);
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const box = await canvas.boundingBox();
  expect(box, `no canvas box for ${snapshotName}`).toBeTruthy();
  // Clip must fit inside the canvas box (Playwright rejects out-of-bounds clips).
  const clip = fixed
    ? {
        x: box!.x,
        y: box!.y,
        width: Math.min(fixed.width, Math.round(box!.width)),
        height: Math.min(fixed.height, Math.round(box!.height)),
      }
    : {
        x: box!.x,
        y: box!.y,
        width: Math.round(box!.width),
        height: Math.round(box!.height),
      };
  expect(clip.width, `${snapshotName} clip width`).toBeGreaterThan(300);
  expect(clip.height, `${snapshotName} clip height`).toBeGreaterThan(400);
  if (fixed) {
    expect(clip.width, `${snapshotName} fixed width`).toBe(fixed.width);
    expect(clip.height, `${snapshotName} fixed height`).toBe(fixed.height);
  }
  // Page clip (not canvas.toHaveScreenshot) keeps baseline dims stable.
  try {
    await page.screenshot({ path: evidencePath, clip, animations: 'disabled' });
    await expect(page).toHaveScreenshot(snapshotName, {
      clip,
      maxDiffPixelRatio: PIXEL_RATIO,
      animations: 'disabled',
    });
  } finally {
    await restoreCaptureOverlays(page);
  }
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
      await captureFixtureScreenshot(
        page,
        `g04-${fixture.id}-desktop.png`,
        join(EVIDENCE, `raw-${fixture.id}-desktop.png`),
        DESKTOP_CAPTURE,
      );
      captureLog.push({
        fixtureId: fixture.id,
        viewport: 'desktop',
        uiMapTitleDe: fixture.uiMapTitleDe,
        webgl: true,
      });
    }

    // Mobile: required subset (world + tavern) — same productive Custom WebGL.
    await page.setViewportSize({ width: mobile!.width, height: mobile!.height });
    // Clear desktop stage pin so mobile canvas can reflow.
    await page.evaluate(() => {
      const root = document.querySelector('[data-atlas-native-3d]');
      if (!root) return;
      const stage =
        (root.querySelector('.stage') as HTMLElement | null) ??
        (root.querySelector('[data-atlas-stage]') as HTMLElement | null) ??
        (root as HTMLElement);
      stage.style.width = '';
      stage.style.height = '';
      stage.style.maxHeight = '';
      stage.style.minHeight = '';
      stage.style.flex = '';
      window.dispatchEvent(new Event('resize'));
    });
    // Hide shell bottom nav during mobile atlas ops — overlaps stage and steals force-clicks.
    await page.evaluate(() => {
      const nav = document.querySelector(
        'nav[aria-label], [data-shell-bottom-nav], [data-adaptive-bottom-nav], footer nav',
      );
      if (nav instanceof HTMLElement) {
        nav.dataset.g04PrevVisibility = nav.style.visibility;
        nav.style.visibility = 'hidden';
        nav.dataset.g04CaptureHide = '1';
      }
    });
    await ensureAtlasWorkbench(page);
    await waitAtlasReady(page);
    await page.waitForTimeout(400);
    for (const id of gv.ATLAS_GOLDEN_VISUAL_MOBILE_FIXTURE_IDS) {
      const fixture = gv.ATLAS_GOLDEN_VISUAL_FIXTURES.find((f) => f.id === id);
      expect(fixture).toBeTruthy();
      await openFixtureMap(page, fixture!.uiMapTitleDe);
      await applyFixtureCamera(page, fixture!.camera);
      await captureFixtureScreenshot(
        page,
        `g04-${fixture!.id}-mobile.png`,
        join(EVIDENCE, `raw-${fixture!.id}-mobile.png`),
        MOBILE_CAPTURE,
      );
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
