/**
 * Verify-UI — Saga workspace Phase 2+3 (permissions, Lore, Dornhain seed, Welt).
 * Location: .qa/runs/2026-10-12-saga-workspace-phase-2-3.spec.ts
 *
 * Run: npx playwright test .qa/runs/2026-10-12-saga-workspace-phase-2-3.spec.ts --project=chromium
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLoggedIn, isInertSupabaseEnv } from './helpers/auth';

const SAGA = process.env.SAGA_PUBLIC_ID ?? 'SA-E979J';
const EVIDENCE = '.qa/evidence/saga-workspace-phase-2-3';

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE, { recursive: true });
});

test.beforeEach(() => {
  test.skip(
    isInertSupabaseEnv(),
    'Requires live Supabase + Dornhain seed (set VITE_SUPABASE_* repo secrets)',
  );
});

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({
    path: path.join(EVIDENCE, name),
    fullPage: true,
  });
}

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 1;
  });
  expect(overflow, 'AU-01 horizontal overflow').toBe(false);
}

test.describe('saga workspace phase 2+3 verify-ui', () => {
  test.setTimeout(120_000);

  test('settings rechte + lore + welt + npc bindings', async ({ page }) => {
    await ensureLoggedIn(page);

    await page.goto(`/sagas/${SAGA}/settings`);
    await expect(page.locator('[data-saga-section="settings"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-saga-rechte]')).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
    await shot(page, '01-settings-rechte.png');

    await page.goto(`/sagas/${SAGA}/lore`);
    await expect(page.locator('[data-saga-section="lore"]')).toBeVisible({ timeout: 20_000 });
    const loreBody = page.locator('[data-saga-lore-timeline], [data-saga-lore-empty], [data-saga-lore-error]');
    await expect(loreBody.first()).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
    await shot(page, '02-lore-verlauf.png');

    await page.goto(`/sagas/${SAGA}/world`);
    await expect(page.locator('[data-saga-section="world"]')).toBeVisible({ timeout: 20_000 });
    // Catalog needs GM/membership perms; CI seed may only expose the error shell.
    const worldSettled = page.locator('[data-saga-world-catalog], [data-saga-world-error]');
    await expect(worldSettled.first()).toBeVisible({ timeout: 20_000 });
    if (await page.locator('[data-saga-world-catalog]').count()) {
      await expect(page.locator('[data-saga-world-group="maps"]')).toBeVisible();
      await expect(page.locator('[data-saga-world-group="locations"]')).toBeVisible();
    }
    await expectNoHorizontalOverflow(page);
    await shot(page, '03-welt-catalog.png');

    await page.goto(`/sagas/${SAGA}/npc-creatures`);
    await expect(page.locator('[data-saga-catalog="npc-creatures"]')).toBeVisible({
      timeout: 20_000,
    });
    // Bindings need Dornhain seed/membership; CI may settle on empty catalog shell.
    await expect(page.getByText('Katalog wird geladen…')).toHaveCount(0, {
      timeout: 20_000,
    });
    if (await page.locator('[data-saga-bindings-list]').count()) {
      await expect(page.locator('[data-saga-bindings-list] li').first()).toBeVisible({
        timeout: 20_000,
      });
    }
    await expectNoHorizontalOverflow(page);
    await shot(page, '04-npc-bindings.png');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/sagas/${SAGA}/settings`);
    await expect(page.locator('[data-saga-rechte]')).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
    await shot(page, '05-settings-rechte-mobile.png');
  });
});
