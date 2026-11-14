/**
 * AIB-03 Phase-A QA — companion open/search/source/close + Live non-interference.
 * Location: e2e/aiberto-phase-a.spec.ts
 *
 * T-005/T-011 style journeys: Regeln-only companion; no chat/LLM.
 * Phone sheet may block background (AIB-02); CE shell-chrome check is after dismiss
 * on sheet, and while-open on desktop dock only.
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureLoggedIn, dashboardReadyLocator } from './helpers/auth';
import { expectMinTouchTargets, expectNoHorizontalOverflow } from './helpers/adaptive-ui-quality';

function aibertoToggle(page: Page) {
  return page
    .locator('[data-aiberto-toggle]')
    .or(page.locator('[data-aiberto-toggle="mobile-header"]'));
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
  // Phone AdaptiveSheet: dismiss via Escape (overlay may block chrome toggles)
  await page.keyboard.press('Escape');
}

test.describe('Aiberto Phase-A quality (AIB-03)', () => {
  test('open → search → section → close; shell main remains', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await ensureLoggedIn(page);
    await expect(dashboardReadyLocator(page)).toBeVisible();

    const minPx = testInfo.project.name === 'chromium' ? 32 : 44;
    // Touch target on toggle while chrome is unobstructed
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
      // Desktop/tablet dock: shell chrome stays operable beside the panel (CE)
      const library = page.getByRole('button', { name: /Bibliothek|Home|Dashboard/ }).first();
      await expect(library).toBeVisible();
      await expect(library).toBeEnabled();
    }

    await closeAiberto(page);
    await expect(page.locator('[data-aiberto-companion="dock"]')).toHaveCount(0);
    await expect(page.locator('[data-aiberto-companion="sheet"]')).toHaveCount(0);
    // After dismiss, shell chrome is operable again (phone sheet may have blocked while open)
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
