/**
 * World profiles library create/configure — Host library mocks (CUT-20).
 * Location: e2e/world-profiles.spec.ts
 */
import { test, expect, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLoggedIn } from './helpers/auth';
import { stubHostEnsureStarter } from './helpers/host-route-mocks';

const EVIDENCE_DIR = '.qa/evidence/world-profiles-modules';

type HostWorld = {
  id: string;
  title: string;
  createdAt: string;
  publicId?: string | null;
  description?: string | null;
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
  const worlds: HostWorld[] = [];

  await stubHostEnsureStarter(page);

  await page.route('**/api/v1/library/worlds**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = request.url();

    if (method === 'GET' && !/\/api\/v1\/library\/worlds\/[^/?]+/.test(url)) {
      await json(route, { worlds });
      return;
    }

    if (method === 'POST') {
      const body = (request.postDataJSON() ?? {}) as {
        title?: string;
        name?: string;
        description?: string;
      };
      const now = new Date().toISOString();
      const world: HostWorld = {
        id: 'world-1',
        title: String(body.title ?? body.name ?? 'Welt'),
        description: typeof body.description === 'string' ? body.description : null,
        createdAt: now,
        publicId: 'WO-TEST1',
      };
      worlds.unshift(world);
      await json(route, world, 201);
      return;
    }

    if (method === 'PATCH' || method === 'PUT') {
      const body = (request.postDataJSON() ?? {}) as Partial<HostWorld> & {
        title?: string;
        name?: string;
      };
      const current = worlds[0];
      if (!current) {
        await json(route, { error: 'Not found' }, 404);
        return;
      }
      const next = {
        ...current,
        title: String(body.title ?? body.name ?? current.title),
        description:
          typeof body.description === 'string' || body.description === null
            ? body.description
            : current.description,
      };
      worlds[0] = next;
      await json(route, next);
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
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Nebelarchipel').first()).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, '02-world-created.png'), fullPage: true });
});
