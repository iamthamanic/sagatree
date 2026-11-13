/**
 * atl2-c06-gate-c — Browser wrapper for Gate C 2D editor protocol (#1211).
 * Location: e2e/atl2-c06-gate-c.spec.ts
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureLoggedIn } from './helpers/auth';

const root = process.cwd();
const selfTest = join(root, 'scripts/atl2-c06-gate-c.self-test.mjs');
const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';
const EVIDENCE = join(root, '.qa/evidence/atl2-c06-gate-c');

test.describe('ATL2-C06 Gate C', () => {
  test('host protocol self-test PASS (CLEAR)', () => {
    expect(existsSync(selfTest)).toBeTruthy();
    const stdout = execFileSync(process.execPath, [selfTest], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    expect(stdout).toContain('atl2-c06-gate-c self-test: PASS');
    expect(stdout).toContain('CLEAR');
    const report = readFileSync(join(root, '.qa/runs/atl2-c06-gate-c.md'), 'utf8');
    expect(report).toContain('Verdict: **CLEAR**');
    expect(report).toContain('Soll / Ist');
  });

  test('browser-host: 2D workstation chrome on Dornhain atlas', async ({ page }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
    mkdirSync(EVIDENCE, { recursive: true });
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

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/library/worlds/${dornhain!.publicId}/map`);
    const workstation = page.locator('[data-world-atlas-workbench]').first();
    await expect(workstation).toBeVisible({ timeout: 45_000 });
    await expect(workstation).toHaveAttribute('data-atlas-surface-class', 'workstation');

    // Wait until controlled 3D (or already 2D) mounts, then switch to Draufsicht authoring chrome.
    const mode3d = page.locator('[data-atlas-surface-mode="3d"]').first();
    const mode2d = page.locator('[data-atlas-surface-mode="2d"]').first();
    await expect(mode3d.or(mode2d)).toBeVisible({ timeout: 60_000 });
    if (await mode2d.count() === 0) {
      const toTopDown = page.locator('[data-atlas-surface-toggle]').first();
      await expect(toTopDown).toBeVisible({ timeout: 45_000 });
      await toTopDown.click();
    }
    await expect(mode2d).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-atlas-tool-rail]').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-atlas-undo]').first()).toBeVisible();
    await expect(page.locator('[data-atlas-redo]').first()).toBeVisible();
    await expect(page.locator('[data-atlas-history-live]').first()).toBeAttached();

    const band = page.locator('[data-atlas-content-band]').first();
    await expect(band).toBeAttached({ timeout: 15_000 });

    await expect
      .poll(async () => band.getAttribute('data-atlas-content-band'), { timeout: 15_000 })
      .toMatch(/desktop|tablet/);
    await expect(page.locator('[data-atlas-reduced-phone="true"]')).toHaveCount(0);
    await page.screenshot({ path: join(EVIDENCE, 'desktop-workstation.png'), fullPage: true });

    await page.setViewportSize({ width: 820, height: 1024 });
    await expect
      .poll(async () => band.getAttribute('data-atlas-content-band'), { timeout: 15_000 })
      .toMatch(/tablet|desktop/);
    await page.screenshot({ path: join(EVIDENCE, 'tablet-workstation.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('[data-atlas-tool-rail]').first()).toBeVisible();
    await expect
      .poll(async () => band.getAttribute('data-atlas-content-band'), { timeout: 20_000 })
      .toBe('phone');
    await expect(page.locator('[data-atlas-reduced-phone="true"]').first()).toBeAttached({
      timeout: 15_000,
    });
    await page.screenshot({ path: join(EVIDENCE, 'phone-workstation.png'), fullPage: true });

    const mapsRes = await page.request.get(`/api/v1/worlds/${dornhain!.id}/atlas/maps`, {
      headers: { Origin: origin },
    });
    expect(mapsRes.ok()).toBeTruthy();
    const titles = (((await mapsRes.json()) as { maps?: Array<{ title: string }> }).maps ?? []).map(
      (m) => m.title,
    );
    expect(titles).toEqual(
      expect.arrayContaining([
        'Welt',
        'Land Westmark',
        'Dornhain',
        'Krypta unter dem Hügel',
      ]),
    );
  });
});
