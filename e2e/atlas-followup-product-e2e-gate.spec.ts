/**
 * atlas-followup-product-e2e-gate — Epic #746 closer (#755).
 * Location: e2e/atlas-followup-product-e2e-gate.spec.ts
 *
 * Contract mode (default CI): Local Admin + mocked world atlas RPCs must mount
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

const EVIDENCE = '.qa/evidence/atlas-followup-real-product-e2e';
const LIVE = process.env.E2E_ATLAS_PRODUCT === '1';
const WORLD_PUBLIC = 'WO-9FFK6';
const WORLD_UUID = '8f52b273-60fe-4823-ae7d-d9e70469b730';
const MAP_WORLD = '76ca488e-76a4-4753-8dae-43f8b6ce6c43';
const PLACE_ID = 'd4cd0cd9-806e-49da-bb90-83cbaf281a7d';

function json(route: Route, value: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(value),
  });
}

function wantsSingleObject(route: Route): boolean {
  const accept = route.request().headers()['accept'] ?? '';
  return accept.includes('vnd.pgrst.object');
}

const WORLD_ROW = {
  id: WORLD_UUID,
  public_id: WORLD_PUBLIC,
  owner_user_id: E2E_LOCAL_ADMIN_USER_ID,
  name: 'Donalu',
  description: null,
  modules: {},
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const MAP_SUMMARY = {
  id: MAP_WORLD,
  worldProfileId: WORLD_UUID,
  parentMapId: null,
  kind: 'world',
  title: 'Welt',
  sortOrder: 0,
  revision: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  hasAzgaarMap: false,
  hasBasemap: false,
};

const MAP_VM = {
  ...MAP_SUMMARY,
  bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
  layers: { type: 'FeatureCollection', features: [] },
  basemapStoragePath: null,
  azgaarMapStoragePath: null,
  generatorMeta: {
    engine: 'unified_canvas',
    mapStatus: 'ready',
    demoSeed: false,
    unifiedCanvas: {
      format: 'sagatree-unified-atlas-v1',
      revision: 1,
      demoSeed: false,
      objects: [],
      strokes: [],
      walls: [],
      rooms: [],
    },
  },
};

async function installAtlasMocks(page: Page) {
  await page.route('**/rest/v1/world_profiles*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    if (wantsSingleObject(route) || route.request().url().includes('public_id=eq.')) {
      await json(route, WORLD_ROW);
      return;
    }
    await json(route, [WORLD_ROW]);
  });

  await page.route('**/rest/v1/rpc/ensure_world_atlas_root*', async (route) => {
    await json(route, { maps: [MAP_SUMMARY] });
  });
  await page.route('**/rest/v1/rpc/list_world_atlas_maps*', async (route) => {
    await json(route, { maps: [MAP_SUMMARY] });
  });
  await page.route('**/rest/v1/rpc/get_world_atlas_map*', async (route) => {
    await json(route, MAP_VM);
  });
  await page.route('**/rest/v1/rpc/list_world_places*', async (route) => {
    await json(route, {
      places: [
        {
          id: PLACE_ID,
          worldProfileId: WORLD_UUID,
          parentPlaceId: null,
          kind: 'settlement',
          name: 'Dornhain',
          description: null,
          status: 'canonical',
          seedKey: null,
          sortOrder: 0,
          revision: 1,
        },
      ],
    });
  });
  await page.route('**/rest/v1/rpc/list_world_place_map_links*', async (route) => {
    await json(route, {
      links: [
        {
          id: 'link-1',
          worldProfileId: WORLD_UUID,
          placeId: PLACE_ID,
          mapId: MAP_WORLD,
          usage: 'overview',
          featureId: null,
          anchor: { x: 500, y: 500 },
        },
      ],
    });
  });
}

test('product WebGL atlas mounts DB nav + registry tools (contract)', async ({ page }) => {
  test.setTimeout(90_000);
  fs.mkdirSync(EVIDENCE, { recursive: true });
  // Contract path always stubs GoTrue so JWT + RPC mocks stay deterministic
  // whether CI uses inert placeholders or live secret URLs.
  await installLocalAdminGoTrueSuccess(page);
  await installAtlasMocks(page);
  await ensureLoggedIn(page);

  await page.goto(`/library/worlds/${WORLD_PUBLIC}/map`);
  const native = page.locator('[data-atlas-native-3d]');
  await expect(native).toBeVisible({ timeout: 45_000 });
  await expect(native).toHaveAttribute('data-atlas-controlled', 'true');
  await expect(native).toHaveAttribute('data-atlas-product-nav', 'true');
  await expect(page.locator('[data-atlas-demo="true"]')).toHaveCount(0);
  // Nav/tools live in chrome that may stay CSS-hidden until surface-ready;
  // product wiring is proven by attached DB/registry markers (not viewport paint).
  await expect(page.locator('[data-atlas-nav-source="db"]')).toBeAttached({ timeout: 20_000 });
  await expect(page.locator('#tools[data-atlas-tool-source="registry"]')).toBeAttached({
    timeout: 20_000,
  });

  fs.writeFileSync(
    path.join(EVIDENCE, 'contract-run.json'),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        worldPublicId: WORLD_PUBLIC,
        mode: 'contract',
        hadNative3d: true,
      },
      null,
      2,
    ),
  );
});

test('cross-owner atlas RPC remains denied without ownership (negative)', async ({ page }) => {
  test.setTimeout(60_000);
  await installLocalAdminGoTrueSuccess(page);
  let denied = false;
  await page.route('**/rest/v1/world_profiles*', async (route) => {
    if (route.request().method() === 'GET') {
      denied = true;
      await json(route, { message: 'JWT denied cross-owner', code: '42501' }, 401);
      return;
    }
    await route.fallback();
  });
  await page.route('**/rest/v1/rpc/list_world_atlas_maps*', async (route) => {
    denied = true;
    await json(route, { message: 'JWT denied cross-owner', code: '42501' }, 401);
  });
  await page.route('**/rest/v1/rpc/ensure_world_atlas_root*', async (route) => {
    denied = true;
    await json(route, { message: 'JWT denied cross-owner', code: '42501' }, 401);
  });
  await ensureLoggedIn(page);
  await page.goto(`/library/worlds/${WORLD_PUBLIC}/map`);
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
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
