/**
 * Minimal e2e for world `npc-creature-catalog` module UI (#199).
 * Mocks world_profiles REST like world-item-catalog-module.spec.ts.
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLoggedIn, installLocalAdminGoTrueSuccess } from './helpers/auth';

const EVIDENCE_DIR = '.qa/evidence/npc-creature-world-catalog';

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

test('world npc-creature-catalog module toggles packs and shows live count', async ({ page }) => {
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
        id: 'world-npc-catalog-1',
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

    await route.fallback();
  });

  await page.route('**/rest/v1/inventory_item_definitions*', async (route) => {
    await json(route, []);
  });

  await page.route('**/rest/v1/npc_creature_definitions*', async (route) => {
    await json(route, []);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await installLocalAdminGoTrueSuccess(page);
  await ensureLoggedIn(page);
  await page.getByRole('button', { name: 'Bibliothek' }).first().click();
  await page.getByRole('tab', { name: 'Welten' }).click();
  await page.getByRole('button', { name: 'Erste Welt erstellen' }).click();

  const catalog = page.getByTestId('world-npc-creature-catalog-module');
  await expect(catalog).toBeVisible();
  await expect(catalog.getByText('NPCs & Kreaturen').first()).toBeVisible();
  await expect(catalog.getByText(/6 Figuren in dieser Welt verfügbar/)).toBeVisible();

  // item-catalog still present (regression)
  await expect(page.getByTestId('world-item-catalog-module')).toBeVisible();

  await catalog.locator('#npc-creature-catalog-pack-builtin\\:npc-fantasy-basics').click();
  await expect(catalog.getByText(/Figuren in dieser Welt verfügbar/)).toBeVisible();
  await expect(catalog.getByText(/6 Figuren in dieser Welt verfügbar/)).not.toBeVisible();

  await catalog.locator('#npc-creature-catalog-pack-builtin\\:npc-animals').click();

  await catalog.getByRole('switch', { name: /Eigene Figuren der Spieler erlauben/ }).click();

  await page.getByLabel('Name *').fill('NPC-Katalogwelt');
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '01-world-npc-creature-catalog-section.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Welt erstellen' }).click();
  await expect(page.getByText('NPC-Katalogwelt')).toBeVisible();

  const saved = worlds[0];
  expect(saved).toBeTruthy();
  const moduleConfig = saved.modules['npc-creature-catalog'];
  expect(moduleConfig).toBeTruthy();
  expect(Array.isArray(moduleConfig.enabledPackIds)).toBe(true);
  expect(moduleConfig.enabledPackIds).toContain('builtin:npc-fantasy-basics');
  expect(moduleConfig.enabledPackIds).toContain('builtin:npc-animals');
  expect(moduleConfig.allowPersonalDefinitions).toBe(false);
});
