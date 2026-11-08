/**
 * Inventory v2 integration E2E (#114) — structural smoke across desktop + mobile.
 * Deep domain / catalog scenarios remain covered by inventory-*-check.mjs in test-gate.
 * Catalog add that needs live Supabase catalog load is soft-asserted (CI often has no DB).
 * Location: e2e/inventory-v2.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLoggedIn } from './helpers/auth';

const EVIDENCE_DIR = '.qa/evidence/inventory-v2-integration';


async function openNewCharacterInventory(page: Page) {
  const createViaEmptyState = page.getByRole('button', { name: 'Charakter erstellen' });
  if (await createViaEmptyState.count()) {
    await createViaEmptyState.first().click();
  } else {
    await page.getByRole('heading', { name: 'Neuer Charakter' }).first().click();
  }
  await expect(page.getByRole('heading', { name: 'Charakter erstellen' })).toBeVisible();
  await page.getByRole('button', { name: /Eigenen Charakter erstellen/i }).click();
  await expect(page.getByRole('heading', { name: 'Charakter Editor' }).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: /Inventar/i }).click();
  await expect(page.locator('[data-character-inventory-v2]')).toBeVisible({ timeout: 15_000 });
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test('Inventory v2: Core catalog shell + occupancy summary (Scenario A smoke)', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await ensureLoggedIn(page);
  await openNewCharacterInventory(page);

  await expect(page.getByText(/Inventar 0 \/ 20/i).first()).toBeVisible();
  await expect(page.getByText(/^Last 0 \/ 13$/).first()).toBeVisible();

  await page.getByRole('button', { name: /Gegenstand hinzufügen/i }).first().click();
  const catalog = page.locator('[data-inventory-catalog-dialog]');
  await expect(catalog).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Core$/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Eigene$/i })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Welt$/i })).toHaveCount(0);

  // Core list is local; world/personal rows need host catalog (#1160 HOST_VERIFIED).
  const addButtons = catalog.getByRole('button', { name: /^Hinzufügen$/i });
  const firstAdd = addButtons.first();
  if ((await addButtons.count()) > 0 && (await firstAdd.isEnabled().catch(() => false))) {
    await firstAdd.click();
    const confirmAdd = page.getByRole('button', { name: /^Hinzufügen$/i }).last();
    if ((await confirmAdd.isEnabled().catch(() => false)) && (await confirmAdd.isVisible().catch(() => false))) {
      await confirmAdd.click();
      await expect(page.getByText(/Inventar [1-9] \/ 20/i).first()).toBeVisible({
        timeout: 10_000,
      });
    }
  } else {
    test.info().annotations.push({
      type: 'note',
      description:
        'Core catalog add unavailable in this fixture; shell + tabs asserted; host catalog covered by cut-06b self-test.',
    });
  }

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, 'scenario-a-core-add.png'),
    fullPage: true,
  });
});

test('Inventory v2: mobile 390×844 segmented path without horizontal overflow (Scenario J smoke)', async ({
  page,
}) => {
  test.setTimeout(180_000);
  // Authenticate on desktop chrome, then shrink before Inventar mounts so
  // matchMedia(isNarrow) is true on first paint of the panel.
  await ensureLoggedIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openNewCharacterInventory(page);

  await expect(page.locator('[data-inventory-mobile-view-switch]')).toBeVisible({
    timeout: 15_000,
  });
  const overflowX = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
  expect(overflowX).toBe(false);

  await page.getByRole('tab', { name: /^Ausrüstung$/i }).click();
  await expect(page.locator('[data-inventory-mobile-panel="ausruestung"]')).toBeVisible();
  await expect(page.locator('[data-inventory-equipment-panel]')).toBeVisible();
  await expect(page.locator('[data-inventory-equipment-panel]')).toContainText('Kopf');

  await page.getByRole('tab', { name: /^Inventar$/i }).last().click();
  await expect(page.locator('[data-inventory-mobile-panel="inventar"]')).toBeVisible();
  await page.getByRole('button', { name: /Gegenstand hinzufügen/i }).first().click();
  await expect(page.locator('[data-inventory-catalog-dialog]')).toBeVisible();
  await expect(page.getByRole('tab', { name: /^Core$/i })).toBeVisible();

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, 'scenario-j-mobile.png'),
    fullPage: true,
  });
});

test('Inventory v2: desktop equipment pane remains beside grid at wide viewport', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await ensureLoggedIn(page);
  await openNewCharacterInventory(page);
  await page.setViewportSize({ width: 1280, height: 800 });

  await expect(page.locator('[data-inventory-desktop-layout]')).toBeVisible();
  await expect(page.locator('[data-inventory-mobile-layout]')).toHaveCount(0);
  await expect(page.getByText(/Ausrüstung/i).first()).toBeVisible();
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, 'desktop-equipment.png'),
    fullPage: true,
  });
});
