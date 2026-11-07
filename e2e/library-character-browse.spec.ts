import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLoggedIn } from './helpers/auth';
import { MOCK_LIBRARY_CHARACTERS, mockHostLibraryCharacters } from './helpers/host-route-mocks';

const EVIDENCE_DIR = '.qa/evidence/library-entity-browser';
const VIEW_MODE_STORAGE_KEY = 'sagatree_library_characters_view_mode';

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test('library characters tab browses via carousel/list with persisted view mode', async ({ page }) => {
  test.setTimeout(60_000);

  await mockHostLibraryCharacters(page, MOCK_LIBRARY_CHARACTERS);

  await page.setViewportSize({ width: 1440, height: 900 });
  await ensureLoggedIn(page);

  await page.getByRole('button', { name: 'Bibliothek' }).first().click();
  await expect(page.getByRole('heading', { name: 'Meine Bibliothek' })).toBeVisible();
  await expect(page.getByText('2 Charaktere').first()).toBeVisible();

  await expect(page.getByRole('button', { name: 'Listenansicht' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Kara Sturmklinge').first()).toBeVisible();
  await expect(page.getByText('Bror Steinfuss').first()).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-characters-list-view.png'), fullPage: true });

  await page.getByRole('button', { name: 'Karussell-Ansicht' }).click();
  await expect(page.getByRole('button', { name: 'Karussell-Ansicht' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: /carousel/i }).or(page.locator('[data-slot="carousel"]'))).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02-characters-carousel-view.png'), fullPage: true });

  const stored = await page.evaluate((key) => window.localStorage.getItem(key), VIEW_MODE_STORAGE_KEY);
  expect(stored).toBe('carousel');
});

test('library characters search-empty state stays actionable', async ({ page }) => {
  test.setTimeout(60_000);

  await mockHostLibraryCharacters(page, MOCK_LIBRARY_CHARACTERS);

  await page.setViewportSize({ width: 1440, height: 900 });
  await ensureLoggedIn(page);

  await page.getByRole('button', { name: 'Bibliothek' }).first().click();
  await expect(page.getByRole('heading', { name: 'Meine Bibliothek' })).toBeVisible();
  await expect(page.getByText('2 Charaktere').first()).toBeVisible();

  await page.getByPlaceholder('Suche in deiner Bibliothek...').first().fill('Unbekannter Held');
  await expect(page.getByText('Keine Charaktere gefunden').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ersten Charakter erstellen' })).toBeHidden();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '03-characters-search-empty.png'), fullPage: true });

  await page.getByPlaceholder('Suche in deiner Bibliothek...').first().fill('Kara');
  await expect(page.getByText('1 Charakter').first()).toBeVisible();
  await expect(page.getByText('Kara Sturmklinge').first()).toBeVisible();
});