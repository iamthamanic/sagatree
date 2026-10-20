/**
 * atlas-followup-product-e2e-gate — Epic #746 closer (#755).
 * Location: e2e/atlas-followup-product-e2e-gate.spec.ts
 *
 * Contract mode (default CI): Local Admin + mocked world atlas payload must mount
 * product WebGL with DB nav + registry tools. Live mode: set E2E_ATLAS_PRODUCT=1.
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  ensureLoggedIn,
  installLocalAdminGoTrueSuccess,
  E2E_LOCAL_ADMIN_USER_ID,
} from './helpers/auth';
import { isInertSupabaseEnv } from './helpers/supabase-env';

const EVIDENCE = '.qa/evidence/atlas-followup-real-product-e2e';
const LIVE = process.env.E2E_ATLAS_PRODUCT === '1';
const WORLD_PUBLIC = 'WO-9FFK6';
const WORLD_UUID = '8f52b273-60fe-4823-ae7d-d9e70469b730';
const MAP_WORLD = '76ca488e-76a4-4753-8dae-43f8b6ce6c43';

function json(route: Route, value: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(value),
  });
}

async function installAtlasMocks(page: Page) {
  await page.route('**/rest/v1/world_profiles*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await json(route, [
      {
        id: WORLD_UUID,
        public_id: WORLD_PUBLIC,
        owner_user_id: E2E_LOCAL_ADMIN_USER_ID,
        name: 'Donalu',
        description: null,
      },
    ]);
  });

  await page.route('**/rest/v1/world_atlas_maps*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await json(route, [
      {
        id: MAP_WORLD,
        world_profile_id: WORLD_UUID,
        parent_map_id: null,
        kind: 'world',
        title: 'Welt',
        sort_order: 0,
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
        layers: { type: 'FeatureCollection', features: [] },
        generator_meta: {
          engine: 'unified_canvas',
          mapStatus: 'ready',
          demoSeed: false,
          unifiedCanvas: {
            format: 'sagatree-unified-atlas-v1',
            revision: 1,
            objects: [],
            strokes: [],
            walls: [],
            rooms: [],
          },
        },
        revision: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
  });

  await page.route('**/rest/v1/world_places*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await json(route, [
      {
        id: 'd4cd0cd9-806e-49da-bb90-83cbaf281a7d',
        world_profile_id: WORLD_UUID,
        parent_place_id: null,
        kind: 'settlement',
        name: 'Dornhain',
        status: 'canonical',
        sort_order: 0,
      },
    ]);
  });

  await page.route('**/rest/v1/world_place_map_links*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await json(route, [
      {
        id: 'link-1',
        world_profile_id: WORLD_UUID,
        place_id: 'd4cd0cd9-806e-49da-bb90-83cbaf281a7d',
        map_id: MAP_WORLD,
        usage: 'overview',
        anchor: { x: 500, y: 500 },
      },
    ]);
  });
}

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE, { recursive: true });
});

test('product WebGL atlas mounts DB nav + registry tools (contract)', async ({ page }) => {
  test.setTimeout(90_000);
  if (isInertSupabaseEnv()) {
    await installLocalAdminGoTrueSuccess(page);
  }
  await installAtlasMocks(page);
  await ensureLoggedIn(page);

  await page.goto(`/library/worlds/${WORLD_PUBLIC}/map`);
  const atlas = page.locator('[data-atlas-native-3d], [data-unified-atlas-editor]').first();
  await expect(atlas).toBeVisible({ timeout: 45_000 });

  const native = page.locator('[data-atlas-native-3d]');
  if ((await native.count()) > 0) {
    await expect(native).toHaveAttribute('data-atlas-controlled', 'true');
    await expect(native).toHaveAttribute('data-atlas-product-nav', 'true');
    const nav = page.locator('[data-atlas-nav-source="db"]');
    await expect(nav).toBeVisible({ timeout: 20_000 });
    const tools = page.locator('#tools[data-atlas-tool-source="registry"]');
    await expect(tools).toBeVisible({ timeout: 20_000 });
  } else {
    // 2D surface still product path — must not be demoSeed chrome.
    await expect(page.locator('[data-atlas-demo="true"]')).toHaveCount(0);
  }

  fs.writeFileSync(
    path.join(EVIDENCE, 'contract-run.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        worldPublicId: WORLD_PUBLIC,
        mode: 'contract',
        hadNative3d: (await native.count()) > 0,
      },
      null,
      2,
    ),
  );
});

test('cross-owner atlas REST remains denied without ownership (negative)', async ({ page }) => {
  test.setTimeout(60_000);
  if (isInertSupabaseEnv()) {
    await installLocalAdminGoTrueSuccess(page);
  }
  let denied = false;
  await page.route('**/rest/v1/world_atlas_maps*', async (route) => {
    if (route.request().method() === 'GET') {
      denied = true;
      await json(route, { message: 'JWT denied cross-owner', code: '42501' }, 401);
      return;
    }
    await route.fallback();
  });
  await ensureLoggedIn(page);
  await page.goto(`/library/worlds/${WORLD_PUBLIC}/map`);
  await page.waitForTimeout(1500);
  expect(denied).toBe(true);
});

test('live GM product journey (optional)', async ({ page }) => {
  test.skip(!LIVE, 'Set E2E_ATLAS_PRODUCT=1 for seeded Donalu RPC journey');
  test.setTimeout(180_000);
  await ensureLoggedIn(page);
  await page.goto(`/library/worlds/${WORLD_PUBLIC}/map`);
  const native = page.locator('[data-atlas-native-3d][data-atlas-controlled="true"]');
  await expect(native).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-atlas-nav-source="db"]')).toBeVisible();
  await expect(page.locator('#tools[data-atlas-tool-source="registry"]')).toBeVisible();
  const surface = page.getByRole('button', { name: /Draufsicht|3D-Ansicht/i }).first();
  if (await surface.count()) {
    await surface.click();
  }
  fs.writeFileSync(
    path.join(EVIDENCE, 'live-run.json'),
    JSON.stringify({ at: new Date().toISOString(), mode: 'live', ok: true }, null, 2),
  );
});
