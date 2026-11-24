/**
 * Shared E2E auth helper — single Login readiness contract for Browser E2E.
 * Location: e2e/helpers/auth.ts
 *
 * Prefer this over local ensureLoggedIn copies. CUT-20: product login is Host
 * Better Auth (`admin`/`1234` → seeded `admin@sagatree.local`). CI runs via
 * `scripts/browser-e2e-with-host.mjs` (Vite `/api` proxy → ephemeral host).
 */
import { expect, type Page } from '@playwright/test';
import { hasLiveHostSeed } from './host-env';

export const E2E_LOCAL_ADMIN_USER = 'admin';
export const E2E_LOCAL_ADMIN_PASSWORD = '1234';
export const E2E_LOCAL_ADMIN_EMAIL = 'admin@sagatree.local';
export const E2E_LOCAL_ADMIN_USER_ID = '00000000-0000-4000-8000-000000000001';

export { hasLiveHostSeed };

/** Shell ready after login: desktop Dashboard or mobile Home. */
export function dashboardReadyLocator(page: Page) {
  return page
    .getByRole('heading', { name: 'Dashboard' })
    .or(page.getByRole('button', { name: 'Home' }))
    .or(page.getByRole('button', { name: 'Dashboard' }))
    .first();
}

/**
 * Demo/local-admin login + wait until the app shell is ready.
 * Default credentials match the Local Admin shortcut (admin/1234).
 */
export async function ensureLoggedIn(
  page: Page,
  options?: {
    user?: string;
    password?: string;
    clearCharacterEditId?: boolean;
    /** CI guard only — Local Admin path must succeed well under this. */
    readyTimeoutMs?: number;
  },
) {
  const user = options?.user ?? E2E_LOCAL_ADMIN_USER;
  const password = options?.password ?? E2E_LOCAL_ADMIN_PASSWORD;
  const readyTimeoutMs = options?.readyTimeoutMs ?? 30_000;

  await page.goto('/');
  if (options?.clearCharacterEditId !== false) {
    await page.evaluate(() => {
      sessionStorage.removeItem('sagatree:character-edit-id');
    });
  }

  const loginTab = page.getByRole('tab', { name: 'Login' });
  if (await loginTab.count()) {
    await loginTab.click();
    // CUT-20 host-first LoginScreen ids (placeholders differ from pre-host copy).
    await page.locator('#login-identifier').fill(user);
    await page.locator('#login-password').fill(password);
    await page.getByRole('button', { name: 'Einloggen' }).click();
  }

  await expect(dashboardReadyLocator(page)).toBeVisible({ timeout: readyTimeoutMs });
}
