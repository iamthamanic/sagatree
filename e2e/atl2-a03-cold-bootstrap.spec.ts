/**
 * atl2-a03-cold-bootstrap — Browser/Host proof wrapper for #1199.
 * Location: e2e/atl2-a03-cold-bootstrap.spec.ts
 *
 * Runs the host SQLite cold-bootstrap self-test (six-level Golden hierarchy)
 * inside Playwright so Browser E2E CI covers ATL2-A03. Optional host-UI probe
 * uses cookie credentials + Origin when SAGATREE_BROWSER_E2E_HOST=1.
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
    const origin = new URL(page.url()).origin;

    const ensure = await page.request.post('/api/v1/projects/ensure-starter', {
      headers: {
        Origin: origin,
        'Content-Type': 'application/json',
      },
      data: { slug: 'dornhain.whisper' },
    });
    if (!ensure.ok()) {
      // Prefer a clear failure over a boolean-only assertion.
      throw new Error(
        `ensure-starter failed: ${ensure.status()} ${await ensure.text()}`,
      );
    }

    const worlds = await page.request.get('/api/v1/library/worlds', {
      headers: { Origin: origin },
    });
    expect(worlds.ok(), await worlds.text()).toBeTruthy();
    const body = (await worlds.json()) as {
      worlds?: Array<{ id: string; publicId?: string; public_id?: string; title?: string }>;
    };
    const dornhain = (body.worlds ?? []).find((w) => w.title === 'Dornhain');
    expect(dornhain?.id, JSON.stringify(body)).toBeTruthy();

    const mapsRes = await page.request.get(`/api/v1/worlds/${dornhain!.id}/atlas/maps`, {
      headers: { Origin: origin },
    });
    expect(mapsRes.ok(), await mapsRes.text()).toBeTruthy();
    const mapsBody = (await mapsRes.json()) as { maps?: Array<{ title: string; id: string }> };
    const maps = mapsBody.maps ?? [];
    expect(maps.length).toBeGreaterThanOrEqual(6);
    const titles = maps.map((m) => m.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        'Welt',
        'Kontinent Westmark',
        'Land Westmark',
        'Dornhain',
        'Taverne Zum Flüstern',
        'Krypta unter dem Hügel',
      ]),
    );

    const publicId = dornhain!.publicId ?? dornhain!.public_id;
    test.skip(!publicId, 'world publicId required for /library/worlds/:id/map');

    await page.goto(`/library/worlds/${publicId}/map`);
    await expect(page.locator('[data-world-atlas-workbench]')).toBeVisible({ timeout: 45_000 });
    const hierarchy = page.locator('[data-world-atlas-hierarchy]').first();
    await expect(hierarchy).toBeVisible({ timeout: 30_000 });
    await expect(hierarchy.getByText('Kontinent Westmark')).toBeVisible();
    await expect(hierarchy.getByText('Krypta unter dem Hügel')).toBeVisible();

    await hierarchy.getByRole('button', { name: /Krypta unter dem Hügel/i }).click();
    await page.reload();
    await expect(page.locator('[data-world-atlas-workbench]')).toBeVisible({ timeout: 45_000 });
    await expect(
      page.locator('[data-world-atlas-hierarchy]').first().getByText('Kontinent Westmark'),
    ).toBeVisible({ timeout: 30_000 });
  });
});
