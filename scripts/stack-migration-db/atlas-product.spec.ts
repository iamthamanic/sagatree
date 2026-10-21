import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixturePath = process.env.ATLAS_ISOLATED_FIXTURE;
if (!fixturePath) throw new Error('Missing isolated live fixture: execute product-run.mjs');
const f = JSON.parse(readFileSync(fixturePath, 'utf8'));
if (new URL(f.apiUrl).hostname !== '127.0.0.1') throw new Error('This suite only accepts its isolated loopback backend');

async function signIn(page: Page, actor: string) {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Login', exact: true }).click();
  await page.getByPlaceholder('admin oder deine@email.de').fill(`${actor}@migration.fixture.invalid`);
  await page.getByPlaceholder('••••••••').fill(f.password);
  const responsePromise = page.waitForResponse((response) => response.url().startsWith(`${f.apiUrl}/auth/v1/token`) && response.request().method() === 'POST', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Einloggen', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), 'Real GoTrue password grant').toBe(200);
  const session = await response.json();
  expect(session.user.id).toBe(f.actors[actor]);
  expect(session.access_token.split('.')).toHaveLength(3);
  await expect(page.getByRole('button', { name: 'Einloggen', exact: true })).toHaveCount(0);
  return session.access_token as string;
}

async function rpc(page: Page, token: string, name: string, data: object) {
  return page.request.post(`${f.apiUrl}/rest/v1/rpc/${name}`, {
    headers: { apikey: f.anonKey, Authorization: `Bearer ${token}` }, data,
  });
}

test('Owner uses the real product WebGL atlas and persisted world navigation', async ({ page }) => {
  const token = await signIn(page, 'owner');
  const detailPromise = page.waitForResponse((response) => response.url().includes('/rest/v1/rpc/get_world_atlas_map'), { timeout: 30_000 });
  await page.goto(`/library/worlds/${f.worldPublicId}/map`);
  const detail = await detailPromise;
  expect(detail.status()).toBe(200);
  expect([f.rootMap, f.secretMap]).toContain((await detail.json()).id);
  const native = page.locator('[data-atlas-native-3d][data-atlas-controlled="true"]');
  await expect(native).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-atlas-demo="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ebenen', exact: true }).click();
  const nav = page.locator('[data-atlas-nav-source="db"]');
  await expect(nav).toBeVisible();
  await expect(nav).toContainText('Fixture continent');
  // The body observed here originates at PostgREST and has passed real SQL auth.
  const maps = await rpc(page, token, 'list_world_atlas_maps', { p_world_profile_id: f.world, p_player_view: false });
  expect(maps.status()).toBe(200);
  expect((await maps.json()).maps.map((row: { id: string }) => row.id).sort()).toEqual([f.rootMap, f.secretMap].sort());
  await page.locator(`[data-edit-place="${f.place}"][data-edit-field="label"]`).click();
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Fixture continent saved');
  const renamePromise = page.waitForResponse((response) => response.url().includes('/rpc/rename_world_node'), { timeout: 20_000 });
  await page.getByRole('textbox', { name: 'Name', exact: true }).press('Enter');
  expect((await renamePromise).status()).toBe(200);
  await page.reload();
  await page.getByRole('button', { name: 'Ebenen', exact: true }).click();
  await expect(page.locator('[data-atlas-nav-source="db"]')).toBeVisible();
  await expect(page.locator('[data-atlas-nav-source="db"]')).toContainText('Fixture continent saved');
  await page.getByRole('button', { name: 'Werkzeuge', exact: true }).click();
  await expect(page.locator('#tools[data-atlas-tool-source="registry"]')).toBeVisible();
});

test('Foreign owner is denied by real PostgREST and the product screen', async ({ page }) => {
  const token = await signIn(page, 'outsider');
  const denied = await rpc(page, token, 'list_world_atlas_maps', { p_world_profile_id: f.world, p_player_view: false, p_saga_public_id: f.sagaPublicId });
  expect(denied.status()).toBe(403);
  expect((await denied.json()).code).toBe('42501');
  await page.goto(`/library/worlds/${f.worldPublicId}/map`);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.locator('[data-atlas-native-3d]')).toHaveCount(0);
  await expect(page.getByText(f.secretTitle, { exact: true })).toHaveCount(0);
});

test('Both real player sessions hide secrets and render a positive GM reveal', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const gmPage = await gmContext.newPage();
  const gmToken = await signIn(gmPage, 'gm');
  const players: { context: Awaited<ReturnType<typeof browser.newContext>>; page: Page; token: string }[] = [];
  try {
    for (const actor of ['player1', 'player2']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const token = await signIn(page, actor);
      players.push({ context, page, token });
      const hidden = await rpc(page, token, 'list_world_atlas_maps', { p_world_profile_id: f.world, p_player_view: true, p_saga_public_id: f.sagaPublicId });
      expect(hidden.status()).toBe(200);
      expect((await hidden.json()).maps).toEqual([]);
      const secret = await rpc(page, token, 'get_world_atlas_map', { p_map_id: f.secretMap, p_player_view: true, p_saga_public_id: f.sagaPublicId });
      // PostgREST 12 maps this existing P0002 exception to HTTP 500.
      // Keep the source baseline response explicit; no fictional 404 mapping.
      expect(secret.status()).toBe(500);
      expect((await secret.json()).code).toBe('P0002');
    }
    const reveal = await rpc(gmPage, gmToken, 'set_saga_binding_reveal', { p_project_id: f.project, p_binding_id: f.locationBinding, p_reveal: 'party' });
    expect(reveal.status()).toBe(200);
    for (const { page, token } of players) {
      const visible = await rpc(page, token, 'get_world_atlas_map', { p_map_id: f.rootMap, p_player_view: true, p_saga_public_id: f.sagaPublicId });
      expect(visible.status()).toBe(200);
      const map = await visible.json();
      expect(map.title).toBe(f.publicTitle);
      expect(JSON.stringify(map)).not.toContain('Secret landmark');
    }
    for (const { page } of players) {
      // Positive browser assertion is mandatory. A correctly filtered empty RPC
      // response alone cannot prove that the product transports saga context.
      await page.goto(`/sagas/${f.sagaPublicId}/world/map`);
      await expect(page.locator('[data-atlas-native-3d][data-atlas-controlled="true"]')).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-atlas-nav-source="db"]')).toContainText('Fixture continent');
      await expect(page.getByText(f.secretTitle, { exact: true })).toHaveCount(0);
    }
  } finally {
    await Promise.all(players.map(({ context }) => context.close()));
    await gmContext.close();
  }
});
