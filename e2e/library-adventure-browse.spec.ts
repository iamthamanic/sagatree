import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLoggedIn } from './helpers/auth';
import { MOCK_ADVENTURE_PROJECTS, mockHostLibraryProjects } from './helpers/host-route-mocks';

const EVIDENCE_DIR = '.qa/evidence/library-entity-browser';

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test('library adventures tab lists real projects with meta chips', async ({ page }) => {
  test.setTimeout(60_000);

  await mockHostLibraryProjects(page, MOCK_ADVENTURE_PROJECTS);

  await page.setViewportSize({ width: 1440, height: 900 });
  await ensureLoggedIn(page);

  await page.getByRole('button', { name: 'Bibliothek' }).first().click();
  await expect(page.getByRole('heading', { name: 'Meine Bibliothek' })).toBeVisible();

  await page.getByRole('tab', { name: 'Sagas' }).first().click();
  await expect(page.getByText('2 Sagas').first()).toBeVisible();

  await expect(page.getByText('Das vergessene Königreich').first()).toBeVisible();
  await expect(page.getByText('Schatten über Nehren').first()).toBeVisible();
  await expect(page.getByText('Aktiv').first()).toBeVisible();
  await expect(page.getByText('Pausiert').first()).toBeVisible();
  await expect(page.getByText('Code: ABCD12').first()).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '04-adventures-list-view.png'), fullPage: true });
});

test('library adventures empty state offers join CTA', async ({ page }) => {
  test.setTimeout(60_000);

  await mockHostLibraryProjects(page, []);

  await page.setViewportSize({ width: 1440, height: 900 });
  await ensureLoggedIn(page);

  await page.getByRole('button', { name: 'Bibliothek' }).first().click();
  await expect(page.getByRole('heading', { name: 'Meine Bibliothek' })).toBeVisible();

  await page.getByRole('tab', { name: 'Sagas' }).first().click();
  await expect(page.getByText('Noch keine Sagas gestartet').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Neue Saga' }).first()).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '05-adventures-empty.png'), fullPage: true });
});