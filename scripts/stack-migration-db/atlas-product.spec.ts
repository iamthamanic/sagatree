import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * CUT-20 host product journey — Better Auth cookies + Host atlas HTTP.
 * Location: scripts/stack-migration-db/atlas-product.spec.ts
 *
 * Soft-DENY ≠ parity: PostgREST/GoTrue/saga-reveal paths are not asserted here.
 */

const fixturePath = process.env.ATLAS_ISOLATED_FIXTURE;
if (!fixturePath) throw new Error('Missing isolated live fixture: execute product-run.mjs');
const f = JSON.parse(readFileSync(fixturePath, 'utf8'));
if (f.mode !== 'host-cut-20') {
  throw new Error('This suite requires the CUT-20 host fixture (mode=host-cut-20)');
}
if (new URL(f.hostUrl).hostname !== '127.0.0.1') {
  throw new Error('This suite only accepts its isolated loopback host');
}

async function signIn(page: Page, actor: string) {
  const email = f.emails[actor];
  if (typeof email !== 'string' || !email) throw new Error(`Missing fixture email for ${actor}`);
  await page.goto('/');
  await page.getByRole('tab', { name: 'Login', exact: true }).click();
  // Prefer stable ids — host-first LoginScreen changes email label/placeholder copy.
  await page.locator('#login-identifier').fill(email);
  await page.locator('#login-password').fill(f.password);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/auth/sign-in/email') &&
      response.request().method() === 'POST',
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Einloggen', exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), 'Better Auth email sign-in').toBeLessThan(400);
  await expect(page.getByRole('button', { name: 'Einloggen', exact: true })).toHaveCount(0);
}

test('Owner uses the real product WebGL atlas and persisted world navigation', async ({ page }) => {
  await signIn(page, 'owner');
  const mapsPromise = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/worlds/${f.worldId}/atlas/maps`) &&
      response.request().method() === 'GET',
    { timeout: 30_000 },
  );
  await page.goto(`/library/worlds/${f.worldPublicId}/map`);
  const maps = await mapsPromise;
  expect(maps.status()).toBe(200);
  const body = await maps.json();
  const listed = Array.isArray(body?.maps) ? body.maps : Array.isArray(body) ? body : [];
  expect(listed.length).toBeGreaterThanOrEqual(1);
  const native = page.locator('[data-atlas-native-3d][data-atlas-controlled="true"]');
  await expect(native).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-atlas-demo="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ebenen', exact: true }).click();
  const nav = page.locator('[data-atlas-nav-source="db"]');
  await expect(nav).toBeVisible();
  await expect(nav).toContainText(f.placeLabel);
  if (f.placeId) {
    await page.locator(`[data-edit-place="${f.placeId}"][data-edit-field="label"]`).click();
    await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Fixture continent saved');
    const renamePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/worlds/${f.worldId}/nodes/`) &&
        response.url().includes('/rename') &&
        response.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByRole('textbox', { name: 'Name', exact: true }).press('Enter');
    expect((await renamePromise).status()).toBe(200);
    await page.reload();
    await page.getByRole('button', { name: 'Ebenen', exact: true }).click();
    await expect(page.locator('[data-atlas-nav-source="db"]')).toBeVisible();
    await expect(page.locator('[data-atlas-nav-source="db"]')).toContainText(
      'Fixture continent saved',
    );
  }
  await page.getByRole('button', { name: 'Werkzeuge', exact: true }).click();
  await expect(page.locator('#tools[data-atlas-tool-source="registry"]')).toBeVisible();
});

test('Foreign owner is denied by real Host authz and the product screen', async ({ page }) => {
  await signIn(page, 'outsider');
  const denied = await page.request.get(
    `${f.frontendUrl}/api/v1/worlds/${f.worldId}/atlas/maps`,
  );
  expect([401, 403, 404]).toContain(denied.status());
  await page.goto(`/library/worlds/${f.worldPublicId}/map`);
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-atlas-native-3d]')).toHaveCount(0);
});

test('Second remote player keeps an isolated Dornhain atlas copy', async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signIn(ownerPage, 'owner');
  const ownerMaps = await ownerPage.request.get(
    `${f.frontendUrl}/api/v1/worlds/${f.worldId}/atlas/maps`,
  );
  expect(ownerMaps.status()).toBe(200);

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  try {
    await signIn(playerPage, 'player1');
    expect(f.playerWorldId).toBeTruthy();
    expect(f.playerWorldId).not.toBe(f.worldId);
    const ownMaps = await playerPage.request.get(
      `${f.frontendUrl}/api/v1/worlds/${f.playerWorldId}/atlas/maps`,
    );
    expect(ownMaps.status()).toBe(200);
    const ownBody = await ownMaps.json();
    const ownListed = Array.isArray(ownBody?.maps)
      ? ownBody.maps
      : Array.isArray(ownBody)
        ? ownBody
        : [];
    expect(ownListed.length).toBeGreaterThanOrEqual(1);

    const cross = await playerPage.request.get(
      `${f.frontendUrl}/api/v1/worlds/${f.worldId}/atlas/maps`,
    );
    expect([401, 403, 404]).toContain(cross.status());

    await playerPage.goto(`/library/worlds/${f.playerWorldPublicId}/map`);
    const native = playerPage.locator('[data-atlas-native-3d][data-atlas-controlled="true"]');
    await expect(native).toBeVisible({ timeout: 45_000 });
  } finally {
    await playerContext.close();
    await ownerContext.close();
  }
});
