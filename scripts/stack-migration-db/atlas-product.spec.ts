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
  await page.goto(`/library/worlds/${f.worldPublicId}/map`);
  // Host atlas may resolve by public id; assert the composed product surface rather than a brittle RPC URL.
  const native = page.locator('[data-atlas-native-3d][data-atlas-controlled="true"]');
  await expect(native).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-atlas-demo="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ebenen', exact: true }).click();
  const nav = page.locator('[data-atlas-nav-source="db"]');
  await expect(nav).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Werkzeuge', exact: true }).click();
  await expect(page.locator('#tools[data-atlas-tool-source="registry"]')).toBeVisible();
});

test('Foreign owner is denied by real Host authz and the product screen', async ({ page }) => {
  await signIn(page, 'outsider');
  await page.goto(`/library/worlds/${f.worldPublicId}/map`);
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-atlas-native-3d]')).toHaveCount(0);
});

test('Second remote player keeps an isolated Dornhain atlas copy', async ({ browser }) => {
  expect(f.playerWorldPublicId).toBeTruthy();
  expect(f.playerWorldPublicId).not.toBe(f.worldPublicId);

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  await signIn(ownerPage, 'owner');
  await ownerPage.goto(`/library/worlds/${f.worldPublicId}/map`);
  await expect(
    ownerPage.locator('[data-atlas-native-3d][data-atlas-controlled="true"]'),
  ).toBeVisible({ timeout: 45_000 });

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  try {
    await signIn(playerPage, 'player1');
    await playerPage.goto(`/library/worlds/${f.playerWorldPublicId}/map`);
    await expect(
      playerPage.locator('[data-atlas-native-3d][data-atlas-controlled="true"]'),
    ).toBeVisible({ timeout: 45_000 });

    // Cross-owner public id must not render the owner's atlas for the player session.
    await playerPage.goto(`/library/worlds/${f.worldPublicId}/map`);
    await expect(playerPage.getByRole('alert')).toBeVisible({ timeout: 20_000 });
    await expect(playerPage.locator('[data-atlas-native-3d]')).toHaveCount(0);
  } finally {
    await playerContext.close();
    await ownerContext.close();
  }
});
