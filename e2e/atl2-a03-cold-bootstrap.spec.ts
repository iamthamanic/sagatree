/**
 * atl2-a03-cold-bootstrap — Browser/Host proof wrapper for #1199.
 * Location: e2e/atl2-a03-cold-bootstrap.spec.ts
 *
 * Runs the host SQLite cold-bootstrap self-test (six-level Golden hierarchy)
 * inside Playwright so Browser E2E CI covers ATL2-A03. Full UI Reset→Drill is
 * exercised when SAGATREE_BROWSER_E2E_HOST=1 via host-backed navigation.
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureLoggedIn } from './helpers/auth';

const root = process.cwd();
const selfTest = join(root, 'scripts/atl2-a03-cold-bootstrap.self-test.mjs');
const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';

test.describe('ATL2-A03 cold bootstrap', () => {
  test('host self-test PASS (six-level Golden hierarchy)', () => {
    expect(existsSync(selfTest)).toBeTruthy();
    const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
    expect(gate).toContain('atl2-a03-cold-bootstrap.self-test.mjs');
    const stdout = execFileSync(process.execPath, [selfTest], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    expect(stdout).toContain('atl2-a03-cold-bootstrap self-test: PASS');
  });

  test('host UI: Dornhain atlas lists Golden child maps after starter', async ({ page }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host (SAGATREE_BROWSER_E2E_HOST=1)');

    await ensureLoggedIn(page);
    const ensure = await page.request.post('/api/v1/projects/ensure-starter', {
      data: { slug: 'dornhain.whisper' },
    });
    expect(ensure.ok()).toBeTruthy();

    const worlds = await page.request.get('/api/v1/library/worlds');
    expect(worlds.ok()).toBeTruthy();
    const body = (await worlds.json()) as {
      worlds?: Array<{ id: string; public_id?: string; title?: string }>;
    };
    const dornhain = (body.worlds ?? []).find((w) => w.title === 'Dornhain');
    expect(dornhain?.public_id || dornhain?.id).toBeTruthy();

    const mapsRes = await page.request.get(`/api/v1/worlds/${dornhain!.id}/atlas/maps`);
    expect(mapsRes.ok()).toBeTruthy();
    const mapsBody = (await mapsRes.json()) as { maps?: Array<{ title: string; id: string }> };
    const maps = mapsBody.maps ?? [];
    expect(maps.length).toBeGreaterThanOrEqual(6);
    const titles = maps.map((m) => m.title);
    expect(titles).toContain('Welt');
    expect(titles).toContain('Kontinent Westmark');
    expect(titles).toContain('Land Westmark');
    expect(titles).toContain('Dornhain');
    expect(titles).toContain('Taverne Zum Flüstern');
    expect(titles).toContain('Krypta unter dem Hügel');

    const publicId = dornhain!.public_id ?? dornhain!.id;
    await page.goto(`/library/worlds/${publicId}/map`);
    await expect(page.locator('[data-world-atlas-workbench]')).toBeVisible({ timeout: 45_000 });

    const hierarchy = page.locator('[data-world-atlas-hierarchy]').first();
    await expect(hierarchy).toBeVisible({ timeout: 30_000 });
    await expect(hierarchy.getByText('Kontinent Westmark')).toBeVisible();
    await expect(hierarchy.getByText('Krypta unter dem Hügel')).toBeVisible();

    // Drill into crypt map then reload — hierarchy must remain.
    await hierarchy.getByRole('button', { name: /Krypta unter dem Hügel/i }).click();
    await page.reload();
    await expect(page.locator('[data-world-atlas-workbench]')).toBeVisible({ timeout: 45_000 });
    await expect(
      page.locator('[data-world-atlas-hierarchy]').first().getByText('Kontinent Westmark'),
    ).toBeVisible({ timeout: 30_000 });

    // Golden reset dialog opens (atlas mode) without hanging chrome.
    const resetOpen = page.locator('[data-atlas-golden-reset-open]').first();
    if (await resetOpen.isVisible()) {
      await resetOpen.click();
      await expect(page.locator('[data-atlas-golden-reset-dialog]')).toBeVisible({
        timeout: 10_000,
      });
      const confirm = page.locator('[data-atlas-golden-reset-confirm]');
      if (await confirm.isVisible()) {
        await confirm.click();
        await expect(page.locator('[data-atlas-golden-reset-dialog]')).toBeHidden({
          timeout: 60_000,
        });
      }
      await expect(
        page.locator('[data-world-atlas-hierarchy]').first().getByText('Land Westmark'),
      ).toBeVisible({ timeout: 30_000 });
    }
  });
});
