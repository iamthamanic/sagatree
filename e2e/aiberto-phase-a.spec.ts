/**
 * Aiberto Phase-A QA — companion open/search/source/close + Live non-interference.
 * Location: e2e/aiberto-phase-a.spec.ts
 *
 * Prefer the *visible* chrome toggle (sidebar is `hidden md:flex`; mobile uses header).
 * Phone sheet may block background (AIB-02); CE shell check is after dismiss on sheet.
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureLoggedIn, dashboardReadyLocator } from './helpers/auth';
import { expectMinTouchTargets, expectNoHorizontalOverflow } from './helpers/adaptive-ui-quality';

/** Visible Aiberto chrome control (sidebar vs `md:hidden` mobile header). */
function aibertoToggle(page: Page) {
  return page.locator('[data-aiberto-toggle]').filter({ visible: true });
}

async function openAiberto(page: Page) {
  const toggle = aibertoToggle(page);
  await expect(toggle.first()).toBeVisible();
  await toggle.first().click();
}

async function expectRulebookOpen(page: Page) {
  const companion = page
    .locator('[data-aiberto-companion="dock"]')
    .or(page.locator('[data-aiberto-companion="sheet"]'));
  await expect(companion.first()).toBeVisible();
  await expect(page.locator('[data-aiberto-rulebook]')).toBeVisible();
  await expect(page.locator('[data-aiberto-orc-notice]')).toBeVisible();
  await expect(page.locator('[data-aiberto-version]')).toBeVisible();
}

async function closeAiberto(page: Page) {
  const closeDock = page.getByRole('button', { name: 'Aiberto schließen' });
  if (await closeDock.isVisible().catch(() => false)) {
    await closeDock.click();
    return;
  }
  await page.keyboard.press('Escape');
}

test.describe('Aiberto Phase-A quality (AIB-03)', () => {
  test('open → search → section → close; shell main remains', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await ensureLoggedIn(page);
    await expect(dashboardReadyLocator(page)).toBeVisible();

    const minPx = testInfo.project.name === 'chromium' ? 32 : 44;
    await expectMinTouchTargets([aibertoToggle(page).first()], minPx);

    await openAiberto(page);
    await expectRulebookOpen(page);

    const search = page.locator('[data-aiberto-search]');
    await expect(search).toBeVisible();
    await search.fill('Erfahrung');
    await expect(page.locator('[data-aiberto-toc] button').first()).toBeVisible({
      timeout: 10_000,
    });
    await page.locator('[data-aiberto-toc] button').first().click();
    await expect(page.locator('[data-aiberto-section]')).toContainText(/Erfahrung|§|stc-/i);

    const isPhoneSheet = (await page.locator('[data-aiberto-companion="sheet"]').count()) > 0;
    if (!isPhoneSheet) {
      const library = page.getByRole('button', { name: /Bibliothek|Home|Dashboard/ }).first();
      await expect(library).toBeVisible();
      await expect(library).toBeEnabled();
    }

    await closeAiberto(page);
    await expect(page.locator('[data-aiberto-companion="dock"]')).toHaveCount(0);
    await expect(page.locator('[data-aiberto-companion="sheet"]')).toHaveCount(0);
    const libraryAfter = page.getByRole('button', { name: /Bibliothek|Home|Dashboard/ }).first();
    await expect(libraryAfter).toBeVisible();
    await expect(dashboardReadyLocator(page)).toBeVisible();
  });

  test('narrow 320px: companion usable without horizontal overflow', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 320, height: 720 });
    await ensureLoggedIn(page);
    await openAiberto(page);
    await expectRulebookOpen(page);
    await expectNoHorizontalOverflow(page);
    await expect(page.locator('[data-aiberto-search]')).toBeVisible();
    await closeAiberto(page);
  });
});
