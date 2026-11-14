/**
 * AIB-03 Phase-A QA — companion open/search/source/close + Live non-interference.
 * Location: e2e/aiberto-phase-a.spec.ts
 *
 * T-005/T-011 style journeys: Regeln-only companion; no chat/LLM.
 * Mobile/tablet projects include this file via playwright.config testMatch.
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureLoggedIn, dashboardReadyLocator } from './helpers/auth';
import { expectMinTouchTargets, expectNoHorizontalOverflow } from './helpers/adaptive-ui-quality';

async function openAiberto(page: Page) {
  const toggle = page.locator('[data-aiberto-toggle]').or(
    page.locator('[data-aiberto-toggle="mobile-header"]'),
  );
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

test.describe('Aiberto Phase-A quality (AIB-03)', () => {
  test('open → search → section → close; shell main remains', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await ensureLoggedIn(page);
    await expect(dashboardReadyLocator(page)).toBeVisible();

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

    // Primary shell chrome still reachable (CE: companion does not steal stage permanently)
    const library = page.getByRole('button', { name: /Bibliothek|Home/ }).first();
    await expect(library).toBeVisible();
    const minPx = testInfo.project.name === 'chromium' ? 32 : 44;
    await expectMinTouchTargets(
      [page.locator('[data-aiberto-toggle]').or(page.locator('[data-aiberto-toggle="mobile-header"]')).first()],
      minPx,
    );

    // Close: dock X or sheet dismiss / toggle again
    const closeDock = page.getByRole('button', { name: 'Aiberto schließen' });
    if (await closeDock.isVisible().catch(() => false)) {
      await closeDock.click();
    } else {
      await openAiberto(page);
    }
    await expect(page.locator('[data-aiberto-companion="dock"]')).toHaveCount(0);
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
  });
});
