/**
 * atl2-d07-gate-d — Browser wrapper for Gate D product 3D protocol (#1218).
 * Location: e2e/atl2-d07-gate-d.spec.ts
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureLoggedIn } from './helpers/auth';

const root = process.cwd();
const selfTest = join(root, 'scripts/atl2-d07-gate-d.self-test.mjs');
const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';
const EVIDENCE = join(root, '.qa/evidence/atl2-d07-gate-d');

test.describe('ATL2-D07 Gate D', () => {
  test('host protocol self-test PASS (CLEAR)', () => {
    expect(existsSync(selfTest)).toBeTruthy();
    const stdout = execFileSync(process.execPath, [selfTest], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    expect(stdout).toContain('atl2-d07-gate-d self-test: PASS');
    expect(stdout).toContain('CLEAR');
    const report = readFileSync(join(root, '.qa/runs/atl2-d07-gate-d.md'), 'utf8');
    expect(report).toContain('Verdict: **CLEAR**');
    expect(report).toContain('Soll / Ist');
    expect(report).toContain('custom-webgl-prototype-runtime');
  });

  test('browser-host: product 3D surface on Dornhain atlas', async ({ page }) => {
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

    const mode3d = page.locator('[data-atlas-surface-mode="3d"]').first();
    const mode2d = page.locator('[data-atlas-surface-mode="2d"]').first();
    await expect(mode3d.or(mode2d)).toBeVisible({ timeout: 60_000 });

    // Prefer product 3D for Gate D evidence; toggle if authoring landed on 2D.
    if ((await mode3d.count()) === 0) {
      const to3d = page.locator('[data-atlas-surface-toggle]').first();
      await expect(to3d).toBeVisible({ timeout: 45_000 });
      await to3d.click();
    }
    await expect(mode3d).toBeVisible({ timeout: 60_000 });

    // Product runtime host markers (custom WebGL / Lite) — not SpatialViewport.
    const nativeHost = page.locator('[data-atlas-native-3d], [data-atlas-graphics-preset]').first();
    await expect(nativeHost).toBeAttached({ timeout: 60_000 });

    await page.screenshot({ path: join(EVIDENCE, 'product-3d-dornhain.png'), fullPage: true });

    const mapsRes = await page.request.get(`/api/v1/worlds/${dornhain!.id}/atlas/maps`, {
      headers: { Origin: origin },
    });
    expect(mapsRes.ok()).toBeTruthy();
    const titles = (((await mapsRes.json()) as { maps?: Array<{ title: string }> }).maps ?? []).map(
      (m) => m.title,
    );
    expect(titles).toEqual(
      expect.arrayContaining(['Welt', 'Dornhain', 'Krypta unter dem Hügel']),
    );
  });
});
