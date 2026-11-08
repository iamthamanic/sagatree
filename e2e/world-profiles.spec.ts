/**
 * World profiles library — Host empty-state smoke (CUT-20).
 * Location: e2e/world-profiles.spec.ts
 *
 * Full create/configure flow still expects legacy world_profiles form contracts;
 * tracked with Soft-DENY / world host parity follow-ups.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLoggedIn } from './helpers/auth';
import { stubHostEnsureStarter } from './helpers/host-route-mocks';

const EVIDENCE_DIR = '.qa/evidence/world-profiles-modules';

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test('world profiles empty state is reachable through the library', async ({ page }) => {
  test.setTimeout(60_000);

  await stubHostEnsureStarter(page);
  await page.route('**/api/v1/library/worlds**', async (route) => {
    if (route.request().method() === 'GET' && !/\/api\/v1\/library\/worlds\/[^/?]+/.test(route.request().url())) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ worlds: [] }),
      });
      return;
    }
    await route.fallback();
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await ensureLoggedIn(page);
  await page.getByRole('button', { name: 'Bibliothek' }).first().click();
  await expect(page.getByRole('heading', { name: 'Meine Bibliothek' })).toBeVisible();
  await page.getByRole('tab', { name: 'Welten' }).click();
  await expect(page.getByText('Noch keine Welten erstellt')).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-library-worlds-tab.png'), fullPage: true });
});
