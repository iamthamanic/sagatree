import { test, expect, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLoggedIn } from './helpers/character-editor';

const EVIDENCE_DIR = '.qa/evidence/item-workbench';

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

test('item workbench create landing, type picker, editor, and core readonly fork', async ({
  page,
}) => {
  test.setTimeout(120_000);

  const createdById = new Map<string, Record<string, unknown>>();

  await page.route('**/rest/v1/inventory_item_definitions*', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'GET') {
      const idMatch = url.match(/[?&]id=eq\.([^&]+)/);
      if (idMatch) {
        const id = decodeURIComponent(idMatch[1]);
        const row = createdById.get(id);
        await json(route, row ?? null);
        return;
      }
      await json(route, [...createdById.values()]);
      return;
    }

    if (method === 'POST') {
      const body = route.request().postDataJSON() as {
        id?: string;
        scope?: string;
        world_profile_id?: string | null;
        owner_user_id?: string;
        payload?: Record<string, unknown>;
        status?: string;
      };
      const id = body.id ?? `personal:e2e-${Date.now()}`;
      const row = {
        id,
        scope: body.scope ?? 'personal',
        world_profile_id: body.world_profile_id ?? null,
        owner_user_id: body.owner_user_id ?? '00000000-0000-4000-8000-000000000001',
        payload: body.payload ?? {},
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      createdById.set(id, row);
      await json(route, row);
      return;
    }

    if (method === 'PATCH') {
      const idMatch = url.match(/[?&]id=eq\.([^&]+)/);
      const id = idMatch ? decodeURIComponent(idMatch[1]) : null;
      const existing = id ? createdById.get(id) : null;
      if (!existing) {
        await json(route, null, 404);
        return;
      }
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const updated = {
        ...existing,
        ...body,
        updated_at: new Date().toISOString(),
      };
      createdById.set(existing.id, updated);
      await json(route, updated);
      return;
    }

    await route.fallback();
  });

  await page.route('**/rest/v1/world_profiles*', async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, []);
      return;
    }
    await route.fallback();
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await ensureLoggedIn(page);

  await page.goto('/items/create');
  await expect(page.locator('[data-item-workbench="landing"]')).toBeVisible();
  await expect(page.locator('[data-app-shell="desktop"]')).toBeVisible();
  const typePicker = page.locator('[data-item-workbench-type-picker]');
  await expect(typePicker).toHaveCount(1);
  await expect(typePicker).toBeVisible();
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '01-create-landing.png'),
    fullPage: true,
  });

  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '02-type-picker.png'),
    fullPage: true,
  });

  await typePicker.locator('[data-item-workbench-type-option="device"]').click();
  await expect(page).toHaveURL(/\/items\/create\/new\/geraet$/);
  const forge = page.locator('[data-item-workbench="create"]');
  await expect(forge).toBeVisible();
  await expect(forge.locator('[data-item-workbench-editor]')).toBeVisible();
  await expect(forge.locator('[data-item-workbench-visuals]')).toBeVisible();
  await expect(forge.locator('[data-item-workbench-visual-toggle]')).toBeVisible();
  await forge.locator('[data-item-workbench-visual-3d]').click();
  await expect(forge.locator('[data-item-workbench-model3d]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible();

  await forge.locator('[data-item-workbench-name]').fill('Feldkommunikator');
  await expect(page.locator('[data-item-workbench-topbar] h1')).toContainText('Feldkommunikator');
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '03-editor-desktop.png'),
    fullPage: true,
  });

  // Assert details panel can scroll past taxonomy into rules (forge scroll contract).
  const details = forge.locator('[data-item-workbench-panel-scroll="details"]');
  await expect(details).toBeVisible();
  await details.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(forge.locator('[data-item-workbench-rules]')).toBeVisible();
  await expect(forge.getByText('SagaTree-Regeln')).toBeVisible();

  await page.getByRole('button', { name: 'Speichern' }).click();
  // CUT-20 host createDefinition mints a UUID id (not personal:mig-* client probe).
  await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}$/i, { timeout: 20_000 });
  await expect(page.locator('[data-item-workbench="edit"]')).toBeVisible({
    timeout: 20_000,
  });

  // Core / builtin readonly + fork CTA
  await page.goto('/items/core.weapon.light-melee');
  await expect(page.locator('[data-item-workbench="readonly"]')).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('[data-item-workbench-readonly-banner]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Als eigenes Item verwenden' })).toBeVisible();
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '04-readonly-core-fork.png'),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/items/create');
  await expect(page.locator('[data-app-shell="mobile"]')).toBeVisible();
  const mobilePicker = page.locator('[data-item-workbench-type-picker]');
  await expect(mobilePicker).toHaveCount(1);
  await expect(mobilePicker).toBeVisible();
  await mobilePicker.locator('[data-item-workbench-type-option="tool"]').click();
  await expect(page).toHaveURL(/\/items\/create\/new\/werkzeug$/);
  await expect(page.locator('[data-item-workbench-editor]')).toBeVisible();
  await page.screenshot({
    path: path.join(EVIDENCE_DIR, '05-editor-mobile.png'),
    fullPage: true,
  });
});
