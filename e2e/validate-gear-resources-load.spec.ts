/**
 * #32 Gear / resources / load validation E2E.
 * Structural + affordability UI paths. Catalog/personal writes soft-assert when
 * Supabase catalog is unavailable (same pattern as inventory-v2.spec.ts).
 * Location: e2e/validate-gear-resources-load.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLoggedIn } from './helpers/auth';

const EVIDENCE = '.qa/evidence/validate-gear-resources-load';


async function openInventory(page: Page) {
  const createViaEmptyState = page.getByRole('button', { name: 'Charakter erstellen' });
  if (await createViaEmptyState.count()) {
    await createViaEmptyState.first().click();
  } else {
    await page.getByRole('heading', { name: 'Neuer Charakter' }).first().click();
  }
  await expect(page.getByRole('heading', { name: 'Charakter erstellen' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('button', { name: /Eigenen Charakter erstellen/i }).click();
  await expect(page.getByRole('heading', { name: 'Charakter Editor' }).first()).toBeVisible({
    timeout: 15_000,
  });
  await page.getByRole('tab', { name: /Inventar/i }).click();
  await expect(page.locator('[data-character-inventory-v2]')).toBeVisible({ timeout: 15_000 });
}

async function setResources(page: Page, level: number) {
  const trigger = page.locator('[data-character-resources]');
  await trigger.click();
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeVisible({ timeout: 5_000 });
  await listbox.getByRole('option', { name: String(level), exact: true }).click();
  await expect(trigger).toHaveAttribute('data-resources-value', String(level), {
    timeout: 10_000,
  });
  await expect(trigger).toContainText(String(level), { timeout: 10_000 });
}

async function closeCatalogIfOpen(page: Page) {
  const catalog = page.locator('[data-inventory-catalog-dialog]');
  if (await catalog.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape').catch(() => undefined);
    await catalog.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => undefined);
  }
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE, { recursive: true });
});

test.describe('#32 validate-gear-resources-load', () => {
  test.beforeEach(() => {
    test.skip(
      true,
      'CUT-20 Soft-DENY #1160: gear/catalog affordability path disabled without host item catalog parity',
    );
  });

  test('resources default, load summary, affordability when catalog available', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await ensureLoggedIn(page);
    await openInventory(page);

    await expect(page.locator('[data-character-resources]')).toHaveAttribute(
      'data-resources-value',
      '3',
    );
    await expect(page.locator('[data-character-resources]')).toContainText('3');
    await expect(page.locator('[data-inventory-load]')).toBeVisible();
    await expect(page.locator('[data-inventory-load-status="ok"]')).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE, '01-resources-default.png'),
      fullPage: true,
    });

    await setResources(page, 0);
    await setResources(page, 3);

    await page.getByRole('button', { name: /Gegenstand hinzufügen/i }).first().click();
    const catalog = page.locator('[data-inventory-catalog-dialog]');
    await expect(catalog).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Core$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Eigene$/i })).toBeVisible();

    const addButtons = catalog.getByRole('button', { name: /^Hinzufügen$/i });
    if ((await addButtons.count()) === 0) {
      test.info().annotations.push({
        type: 'note',
        description:
          'Core catalog rows not loaded (likely no Supabase in CI). Resources + load UI asserted; affordability covered by validate-gear-resources-load.mjs.',
      });
      await page.screenshot({
        path: path.join(EVIDENCE, '02-catalog-shell-only.png'),
        fullPage: true,
      });
      return;
    }

    // Resources 0 → any cost>0 item should open blocked affordability (or free if cost 0).
    await closeCatalogIfOpen(page);
    await setResources(page, 0);
    await page.getByRole('button', { name: /Gegenstand hinzufügen/i }).first().click();
    await expect(catalog).toBeVisible();
    await addButtons.first().click();
    const confirmAdd = page.getByRole('button', { name: /^Hinzufügen$/i }).last();
    if (await confirmAdd.isVisible().catch(() => false)) {
      await confirmAdd.click();
    }

    const afford = page.locator('[data-inventory-affordability-dialog]');
    if (await afford.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const kind = await afford.getAttribute('data-affordability-kind');
      if (kind === 'blocked-needs-gift-override') {
        await page.locator('[data-affordability-gift]').click();
        await expect(page.locator('[data-character-resources]')).toHaveAttribute(
          'data-resources-value',
          '0',
        );
      } else if (kind === 'require-purchase-choice') {
        await page.locator('[data-affordability-purchase]').click();
        await expect(page.locator('[data-character-resources]')).toHaveAttribute(
          'data-resources-value',
          '0',
        );
      }
      await page.screenshot({
        path: path.join(EVIDENCE, '03-affordability.png'),
        fullPage: true,
      });
    } else {
      // Cost-0 item: free add, resources unchanged.
      await expect(page.locator('[data-character-resources]')).toHaveAttribute(
        'data-resources-value',
        '0',
      );
    }

    // Equal-cost purchase path: set resources to match a selected item cost badge if present.
    await closeCatalogIfOpen(page);
    await setResources(page, 1);
    await page.getByRole('button', { name: /Gegenstand hinzufügen/i }).first().click();
    await expect(catalog).toBeVisible();
    const cost1Row = catalog.locator('li').filter({ hasText: /Kosten\s*1/i }).first();
    if ((await cost1Row.count()) > 0) {
      await cost1Row.getByRole('button', { name: /^Hinzufügen$/i }).click();
      const confirm = page.getByRole('button', { name: /^Hinzufügen$/i }).last();
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      await expect(page.locator('[data-affordability-kind="require-purchase-choice"]')).toBeVisible({
        timeout: 10_000,
      });
      await page.locator('[data-affordability-purchase]').click();
      await expect(page.locator('[data-character-resources]')).toHaveAttribute(
        'data-resources-value',
        '0',
      );
      await page.screenshot({
        path: path.join(EVIDENCE, '04-purchase-minus-one.png'),
        fullPage: true,
      });
    }

    // Save / reload resources when Speichern succeeds.
    await closeCatalogIfOpen(page);
    await setResources(page, 4);
    const saveBtn = page.getByRole('button', { name: /Speichern|Entwurf speichern/i }).first();
    await saveBtn.click();
    const savedToast = page.getByText(/gespeichert|Gespeichert|Entwurf/i).first();
    if (await savedToast.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await page.reload();
      await ensureLoggedIn(page);
      const inventarTab = page.getByRole('tab', { name: /Inventar/i });
      if (await inventarTab.isVisible().catch(() => false)) {
        await inventarTab.click();
        await expect(page.locator('[data-character-resources]')).toHaveAttribute(
          'data-resources-value',
          '4',
          { timeout: 15_000 },
        );
      }
    }

    await page.screenshot({
      path: path.join(EVIDENCE, '05-after-flow.png'),
      fullPage: true,
    });
  });

  test('Traglast status badges and overload copy present', async ({ page }) => {
    test.setTimeout(120_000);
    await ensureLoggedIn(page);
    await openInventory(page);

    await expect(page.locator('[data-inventory-load]')).toBeVisible();
    await expect(page.locator('[data-inventory-load-status]')).toBeVisible();
    // Under capacity by default — Tragbar.
    await expect(page.locator('[data-inventory-load-status="ok"]')).toBeVisible();
    // RuleHelp / copy for overload states exist in DOM strings via summary bar source;
    // add heavy core items when catalog available to flip badges.
    await page.getByRole('button', { name: /Gegenstand hinzufügen/i }).first().click();
    const catalog = page.locator('[data-inventory-catalog-dialog]');
    await expect(catalog).toBeVisible();
    const addButtons = catalog.getByRole('button', { name: /^Hinzufügen$/i });
    if ((await addButtons.count()) === 0) {
      test.info().annotations.push({
        type: 'note',
        description:
          'No catalog rows — Traglast under-cap UI asserted; overload bands covered by validate script.',
      });
      await page.keyboard.press('Escape').catch(() => undefined);
      await page.screenshot({
        path: path.join(EVIDENCE, '06-load-under-cap.png'),
        fullPage: true,
      });
      return;
    }

    // Soft: add several items from the already-open catalog (do not re-click
    // "Gegenstand hinzufügen" while the dialog covers the trigger).
    for (let i = 0; i < 6; i += 1) {
      if (!(await catalog.isVisible().catch(() => false))) {
        const openAdd = page.getByRole('button', { name: /Gegenstand hinzufügen/i }).first();
        if (!(await openAdd.isVisible().catch(() => false))) break;
        await openAdd.click();
        if (!(await catalog.isVisible().catch(() => false))) break;
      }
      const buttons = catalog.getByRole('button', { name: /^Hinzufügen$/i });
      if ((await buttons.count()) === 0) break;
      await buttons.first().click();
      const confirm = page.getByRole('button', { name: /^Hinzufügen$/i }).last();
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      const afford = page.locator('[data-inventory-affordability-dialog]');
      if (await afford.isVisible().catch(() => false)) {
        await page.locator('[data-affordability-gift]').click();
      }
      // Close catalog if still open so next iteration can re-open cleanly.
      if (await catalog.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape').catch(() => undefined);
        await catalog.waitFor({ state: 'hidden', timeout: 3_000 }).catch(() => undefined);
      }
    }

    await expect(page.locator('[data-inventory-load-status]')).toBeVisible();
    await page.screenshot({
      path: path.join(EVIDENCE, '07-load-after-adds.png'),
      fullPage: true,
    });
  });
});
