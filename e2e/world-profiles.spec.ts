import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLoggedIn, installLocalAdminGoTrueSuccess } from './helpers/auth';

const EVIDENCE_DIR = '.qa/evidence/world-profiles-modules';

type StoredWorld = {
  id: string;
  owner_user_id: string;
  name: string;
  description: string | null;
  modules: Record<string, Record<string, unknown>>;
  created_at: string;
  updated_at: string;
};


function json(route: Route, value: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(value),
  });
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test('world profiles are created and configured through the library', async ({ page }) => {
  test.setTimeout(60_000);
  const worlds: StoredWorld[] = [];

  await page.route('**/rest/v1/world_profiles*', async (route) => {
    const request = route.request();
    const method = request.method();

    if (method === 'GET') {
      await json(route, worlds);
      return;
    }

    if (method === 'POST') {
      const body = request.postDataJSON() as Partial<StoredWorld>;
      const now = new Date().toISOString();
      const world: StoredWorld = {
        id: 'world-1',
        owner_user_id: String(body.owner_user_id ?? '00000000-0000-4000-8000-000000000001'),
        name: String(body.name ?? ''),
        description: typeof body.description === 'string' ? body.description : null,
        modules: body.modules ?? {},
        created_at: now,
        updated_at: now,
      };
      worlds.unshift(world);
      await json(route, world, 201);
      return;
    }

    if (method === 'PATCH') {
      const body = request.postDataJSON() as Partial<StoredWorld>;
      const current = worlds[0];
      if (!current) {
        await json(route, { message: 'Not found' }, 404);
        return;
      }
      Object.assign(current, body, { updated_at: new Date().toISOString() });
      await json(route, current);
      return;
    }

    if (method === 'DELETE') {
      worlds.splice(0, worlds.length);
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.fallback();
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await installLocalAdminGoTrueSuccess(page);
  await ensureLoggedIn(page);
  await page.getByRole('button', { name: 'Bibliothek' }).first().click();
  await expect(page.getByRole('heading', { name: 'Meine Bibliothek' })).toBeVisible();
  await page.getByRole('tab', { name: 'Welten' }).click();

  await expect(page.getByText('Noch keine Welten erstellt')).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-library-worlds-tab.png'), fullPage: true });

  await page.getByRole('button', { name: 'Erste Welt erstellen' }).click();
  await expect(page.getByRole('heading', { name: 'Neue Welt' })).toBeVisible();
  await expect(page.getByText('Speziesentwicklung').first()).toBeVisible();
  const modeSelect = page.getByRole('combobox', { name: 'Speziesentwicklung: Verfügbarkeit' });
  await expect(modeSelect).toHaveText(/Explizit/);
  await expect(page.getByText(/Normales Level-up vergibt keine Speziespunkte/i)).toBeVisible();

  await page.getByLabel('Name *').fill('Nebelarchipel');
  await page.getByLabel('Beschreibung').fill('Eine modulare Testwelt für SagaTree.');
  await modeSelect.click();
  await page.getByRole('option', { name: 'Progressiv' }).click();
  await expect(page.getByText(/regulär erwerbbare Speziesentwicklungen/i)).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02-world-editor-species-development.png'), fullPage: true });
  await page.getByRole('button', { name: 'Welt erstellen' }).click();

  await expect(page.getByText('Nebelarchipel')).toBeVisible();
  await expect(page.getByText(/Speziesentwicklung:/).first()).toContainText('Progressiv');

  await page.getByRole('button', { name: 'Bearbeiten' }).last().click();
  await expect(page.getByRole('heading', { name: 'Welt bearbeiten' })).toBeVisible();
  await expect(page.getByLabel('Name *')).toHaveValue('Nebelarchipel');
  await expect(page.getByLabel('Beschreibung')).toHaveValue('Eine modulare Testwelt für SagaTree.');
  await expect(page.getByRole('combobox', { name: 'Speziesentwicklung: Verfügbarkeit' })).toHaveText(/Progressiv/);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Welt bearbeiten' })).toBeVisible();
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '03-world-editor-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Abbrechen' }).click();
});
