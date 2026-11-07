/**
 * Adaptive UI quality smokes — Phone/Tablet/Desktop matrix (#483).
 * Location: e2e/adaptive-ui-quality.spec.ts
 *
 * Runs on all Playwright projects. Mobile/tablet projects testMatch this file only
 * (see playwright.config.ts) to avoid multiplying the full suite.
 */
import { test, expect, type Page } from '@playwright/test';
import { ensureLoggedIn } from './helpers/auth';
import {
  expectAccessiblePrimaryControls,
  expectMinTouchTargets,
  expectNoHorizontalOverflow,
} from './helpers/adaptive-ui-quality';
import { MOCK_ADVENTURE_PROJECTS, mockHostLibraryProjects } from './helpers/host-route-mocks';

async function mockLibraryApis(page: Page) {
  await mockHostLibraryProjects(page, [MOCK_ADVENTURE_PROJECTS[0]!]);
}

async function openLibraryAdventures(page: Page) {
  await mockLibraryApis(page);
  await ensureLoggedIn(page);
  await page.getByRole('button', { name: 'Bibliothek' }).first().click();
  await expect(page.getByRole('heading', { name: 'Meine Bibliothek' })).toBeVisible();
  await page.getByRole('tab', { name: 'Sagas' }).first().click();
  await expect(page.getByText('Das vergessene Königreich').first()).toBeVisible();
}

test.describe('Adaptive UI quality gates', () => {
  test('library adventures: no overflow, touch targets, a11y names, visual baseline', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await openLibraryAdventures(page);

    await expectNoHorizontalOverflow(page);

    const primaryActions = [
      page.getByRole('button', { name: 'Bibliothek' }).first(),
      page.getByRole('tab', { name: 'Sagas' }).first(),
    ];
    // Phone/Tablet: AU-02 hard gate (≥44). Desktop chromium: denser chrome allowed (≥32).
    const minPx = testInfo.project.name === 'chromium' ? 32 : 44;
    await expectMinTouchTargets(primaryActions, minPx);

    await expectAccessiblePrimaryControls(page);

    await expect(page.locator('body')).toHaveScreenshot('library-adventures.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.03,
      animations: 'disabled',
    });
  });
});
