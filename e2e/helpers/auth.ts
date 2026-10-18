/**
 * Shared E2E auth helper — single Login readiness contract for Browser E2E.
 * Location: e2e/helpers/auth.ts
 *
 * Prefer this over local ensureLoggedIn copies. Local Admin (admin/1234) must reach
 * Dashboard via product Local-Admin fallback within AUTH_SESSION_TIMEOUT_MS when
 * GoTrue is slow — do not paper over hangs with longer waits alone.
 *
 * When CI uses an inert Supabase URL (no repo secrets), call
 * `installLocalAdminGoTrueSuccess` before login for tests that need a persisted
 * JWT (REST mocks / scrub regression). Timeout/fallback specs install their own
 * GoTrue routes and must not use that helper.
 */
import { expect, type Page, type Route } from '@playwright/test';
import { isInertSupabaseEnv } from './supabase-env';

export const E2E_LOCAL_ADMIN_USER = 'admin';
export const E2E_LOCAL_ADMIN_PASSWORD = '1234';
export const E2E_LOCAL_ADMIN_EMAIL = 'admin@sagatree.local';
export const E2E_LOCAL_ADMIN_USER_ID = '00000000-0000-4000-8000-000000000001';

/** Deterministic Local Admin GoTrue session (JWT path without live stack). */
export function buildLocalAdminGoTrueSession() {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: 'e2e-admin-access',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: 'e2e-admin-refresh',
    user: {
      id: E2E_LOCAL_ADMIN_USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: E2E_LOCAL_ADMIN_EMAIL,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
    },
  };
}

/**
 * Fulfill password-grant so Local Admin gets a persisted auth-token.
 * Use on inert CI backends; do not combine with hang/abort GoTrue routes.
 * Auth-token URL only — a catch-all route plus continue would bypass REST mocks.
 */
export async function installLocalAdminGoTrueSuccess(page: Page): Promise<void> {
  await page.route('**/auth/v1/token**', async (route: Route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildLocalAdminGoTrueSession()),
    });
  });
}

export { isInertSupabaseEnv };

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
    await page.getByPlaceholder('admin oder deine@email.de').fill(user);
    await page.getByPlaceholder('••••••••').fill(password);
    await page.getByRole('button', { name: 'Einloggen' }).click();
  }

  await expect(dashboardReadyLocator(page)).toBeVisible({ timeout: readyTimeoutMs });
}
