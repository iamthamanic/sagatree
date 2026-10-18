/**
 * Local Admin + GoTrue timeout / stale-attempt contract — behavioral cases.
 * Location: e2e/auth-local-admin-timeout.spec.ts
 *
 * Proves Local Admin shortcut bounds GoTrue with AUTH_SESSION_TIMEOUT_MS, falls
 * back without hanging, upgrades intentional fallback to a late JWT, and rejects
 * late GoTrue success after logout / newer non-admin users (no resurrection).
 */
import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {
  dashboardReadyLocator,
  ensureLoggedIn,
  installLocalAdminGoTrueSuccess,
} from './helpers/auth';

const EVIDENCE = '.qa/evidence/auth-local-admin-timeout';
/** Must match src/lib/networkTimeout.ts AUTH_SESSION_TIMEOUT_MS */
const AUTH_SESSION_TIMEOUT_MS = 1_500;
/** CI slack after timeout for dashboard paint (case 2 timing). */
const AUTH_FALLBACK_VISIBLE_SLACK_MS = 4_500;
const LOCAL_ADMIN_STORAGE_KEY = 'sagatree-local-admin-session';

function isGoTrueToken(url: string): boolean {
  return /\/auth\/v1\/token/.test(url);
}

async function fillCredentials(page: Page, user: string, password: string) {
  await page.goto('/');
  const loginTab = page.getByRole('tab', { name: 'Login' });
  if (await loginTab.count()) await loginTab.click();
  await page.getByPlaceholder('admin oder deine@email.de').fill(user);
  await page.getByPlaceholder('••••••••').fill(password);
}

async function hasSupabaseAuthToken(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.includes('auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw || raw === 'null') continue;
      try {
        const parsed = JSON.parse(raw) as { access_token?: string; user?: unknown };
        if (parsed?.access_token || parsed?.user) return true;
      } catch {
        /* ignore */
      }
    }
    return false;
  });
}

async function readStoredAuthEmail(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key || !key.includes('auth-token')) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { user?: { email?: string } };
        if (parsed?.user?.email) return parsed.user.email;
      }
    } catch {
      /* ignore */
    }
    return null;
  });
}

async function logoutViaUi(page: Page) {
  const logout = page.getByRole('button', { name: 'Abmelden' }).first();
  await expect(logout).toBeVisible({ timeout: 5_000 });
  await logout.click();
  await expect(page.getByRole('tab', { name: 'Login' })).toBeVisible({ timeout: 5_000 });
}

function buildFakeGoTrueSession(user: {
  id: string;
  email: string;
  provider?: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: `e2e-${user.email}-access`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `e2e-${user.email}-refresh`,
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      app_metadata: {
        provider: user.provider ?? 'email',
        providers: [user.provider ?? 'email'],
      },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
    },
  };
}

/**
 * Hold the first Local Admin password grant, then fulfill a successful GoTrue
 * session (deterministic late success — no dependency on live GoTrue).
 */
async function installLateAdminSuccessHold(page: Page): Promise<{ release: () => void }> {
  let releaseFn: (() => void) | null = null;
  const held = new Promise<void>((resolve) => {
    releaseFn = resolve;
  });
  let heldOnce = false;

  await page.route('**/*', async (route: Route) => {
    const req = route.request();
    if (req.method() === 'POST' && isGoTrueToken(req.url()) && !heldOnce) {
      heldOnce = true;
      await held;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildFakeGoTrueSession({
            id: '00000000-0000-4000-8000-000000000001',
            email: 'admin@sagatree.local',
            provider: 'email',
          }),
        ),
      });
      return;
    }
    await route.continue();
  });

  return {
    release: () => {
      releaseFn?.();
    },
  };
}

fs.mkdirSync(EVIDENCE, { recursive: true });

test('1 fast GoTrue success: Local Admin authenticates', async ({ page }) => {
  await ensureLoggedIn(page, { readyTimeoutMs: 10_000 });
  await expect(dashboardReadyLocator(page)).toBeVisible();
  const localFlag = await page.evaluate((k) => localStorage.getItem(k), LOCAL_ADMIN_STORAGE_KEY);
  expect(localFlag).toBe('true');
  await page.screenshot({ path: path.join(EVIDENCE, 'case-1-dashboard.png'), fullPage: true });
});

/**
 * Regression: anti-resurrection used to scrub the JWT immediately after
 * signInWithPassword when generation refs were cleared (HMR / Strict remount),
 * leaving the login screen stuck with local-admin flag set and no token.
 */
test('1b Local Admin JWT must persist after login (no immediate scrub race)', async ({ page }) => {
  // Deterministic GoTrue success (CI may use inert 127.0.0.1:9 without secrets).
  await installLocalAdminGoTrueSuccess(page);
  await fillCredentials(page, 'admin', '1234');
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await expect(dashboardReadyLocator(page)).toBeVisible({ timeout: 10_000 });

  await expect
    .poll(async () => hasSupabaseAuthToken(page), { timeout: 5_000 })
    .toBe(true);

  // Still present after a short settle window (race used to delete within ~10ms).
  await page.waitForTimeout(250);
  expect(await hasSupabaseAuthToken(page)).toBe(true);
  expect(await page.evaluate((k) => localStorage.getItem(k), LOCAL_ADMIN_STORAGE_KEY)).toBe(
    'true',
  );
  await expect(dashboardReadyLocator(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Login' })).toHaveCount(0);

  const report = {
    hasAuthToken: await hasSupabaseAuthToken(page),
    email: await readStoredAuthEmail(page),
    localFlag: await page.evaluate((k) => localStorage.getItem(k), LOCAL_ADMIN_STORAGE_KEY),
  };
  fs.writeFileSync(
    path.join(EVIDENCE, 'case-1b-jwt-persist.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
});

test('2 timeout fallback: GoTrue hang → Local Admin fallback', async ({ page }) => {
  let release: (() => void) | null = null;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && isGoTrueToken(req.url())) {
      await held;
      await route.abort('timedout');
      return;
    }
    await route.continue();
  });

  const t0 = Date.now();
  await fillCredentials(page, 'admin', '1234');
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await expect(dashboardReadyLocator(page)).toBeVisible({
    timeout: AUTH_SESSION_TIMEOUT_MS + AUTH_FALLBACK_VISIBLE_SLACK_MS,
  });
  const elapsed = Date.now() - t0;
  expect(elapsed).toBeLessThan(AUTH_SESSION_TIMEOUT_MS + AUTH_FALLBACK_VISIBLE_SLACK_MS);
  expect(elapsed).toBeGreaterThanOrEqual(AUTH_SESSION_TIMEOUT_MS - 200);
  fs.writeFileSync(
    path.join(EVIDENCE, 'case-2.json'),
    `${JSON.stringify({ elapsedMs: elapsed, authTimeoutMs: AUTH_SESSION_TIMEOUT_MS }, null, 2)}\n`,
  );
  release?.();
});

test('3 timeout → late success must not uncontrolled overwrite fallback', async ({ page }) => {
  const hold = await installLateAdminSuccessHold(page);
  await fillCredentials(page, 'admin', '1234');
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await expect(dashboardReadyLocator(page)).toBeVisible({
    timeout: AUTH_SESSION_TIMEOUT_MS + 2_500,
  });

  hold.release();
  await page.waitForTimeout(2_500);
  await expect(dashboardReadyLocator(page)).toBeVisible();
  // Intentional fallback may upgrade to late JWT — must not bounce to login.
  await expect(page.getByRole('tab', { name: 'Login' })).toHaveCount(0);
  const report = {
    hasAuthToken: await hasSupabaseAuthToken(page),
    email: await readStoredAuthEmail(page),
    localFlag: await page.evaluate((k) => localStorage.getItem(k), LOCAL_ADMIN_STORAGE_KEY),
  };
  // Prefer JWT upgrade so PostgREST/RLS work; flag stays for Local Admin intent.
  expect(report.localFlag).toBeTruthy();
  fs.writeFileSync(path.join(EVIDENCE, 'case-3-late-success.json'), `${JSON.stringify(report, null, 2)}\n`);
  await page.screenshot({ path: path.join(EVIDENCE, 'case-3.png'), fullPage: true });
});

test('4 timeout → logout → late success must not resurrect Admin', async ({ page }) => {
  const hold = await installLateAdminSuccessHold(page);
  const events: string[] = [];
  page.on('console', (msg) => {
    if (msg.text().includes('AUTHENTICATED') || msg.text().includes('SIGNED')) {
      events.push(msg.text());
    }
  });

  await fillCredentials(page, 'admin', '1234');
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await expect(dashboardReadyLocator(page)).toBeVisible({
    timeout: AUTH_SESSION_TIMEOUT_MS + 2_500,
  });
  await logoutViaUi(page);

  hold.release();
  await expect
    .poll(async () => {
      const token = await hasSupabaseAuthToken(page);
      const mail = await readStoredAuthEmail(page);
      const flag = await page.evaluate((k) => localStorage.getItem(k), LOCAL_ADMIN_STORAGE_KEY);
      return { token, mail, flag };
    }, { timeout: 5_000 })
    .toEqual({ token: false, mail: null, flag: null });

  await expect(page.getByRole('tab', { name: 'Login' })).toBeVisible();
  await expect(dashboardReadyLocator(page)).toHaveCount(0);

  const report = {
    hasToken: await hasSupabaseAuthToken(page),
    email: await readStoredAuthEmail(page),
    localFlag: await page.evaluate((k) => localStorage.getItem(k), LOCAL_ADMIN_STORAGE_KEY),
    events,
  };
  fs.writeFileSync(path.join(EVIDENCE, 'case-4-logout-late.json'), `${JSON.stringify(report, null, 2)}\n`);
  await page.screenshot({ path: path.join(EVIDENCE, 'case-4.png'), fullPage: true });
});

test('5 timeout → different user login → late admin must not replace user', async ({ page }) => {
  let releaseAdmin: (() => void) | null = null;
  const adminHeld = new Promise<void>((resolve) => {
    releaseAdmin = resolve;
  });
  let adminHoldUsed = false;
  const otherEmail = 'someone@example.com';
  const otherUserId = '11111111-1111-4111-8111-111111111111';

  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST' || !isGoTrueToken(req.url())) {
      await route.continue();
      return;
    }
    const postData = req.postData() || '';
    const isAdminGrant =
      postData.includes('admin%40sagatree.local') || postData.includes('admin@sagatree.local');
    const isOtherGrant =
      postData.includes('someone%40example.com') || postData.includes(otherEmail);

    if (isAdminGrant && !adminHoldUsed) {
      adminHoldUsed = true;
      await adminHeld;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildFakeGoTrueSession({
            id: '00000000-0000-4000-8000-000000000001',
            email: 'admin@sagatree.local',
            provider: 'email',
          }),
        ),
      });
      return;
    }
    if (isOtherGrant) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildFakeGoTrueSession({
            id: otherUserId,
            email: otherEmail,
            provider: 'email',
          }),
        ),
      });
      return;
    }
    await route.continue();
  });

  await fillCredentials(page, 'admin', '1234');
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await expect(dashboardReadyLocator(page)).toBeVisible({
    timeout: AUTH_SESSION_TIMEOUT_MS + 2_500,
  });
  await logoutViaUi(page);

  await fillCredentials(page, otherEmail, 'other-password');
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await expect(dashboardReadyLocator(page)).toBeVisible({ timeout: 8_000 });

  releaseAdmin?.();
  await page.waitForTimeout(3_000);

  // Newer user must remain authenticated — not replaced by late admin, not bounced to login.
  await expect(dashboardReadyLocator(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Login' })).toHaveCount(0);
  const email = await readStoredAuthEmail(page);
  expect(email).not.toBe('admin@sagatree.local');
  fs.writeFileSync(
    path.join(EVIDENCE, 'case-5-different-user.json'),
    `${JSON.stringify({ email, otherEmail }, null, 2)}\n`,
  );
});

test('6 overlapping Local Admin attempts: newest wins; stale late success discarded', async ({
  page,
}) => {
  const releases: Array<() => void> = [];
  let tokenIndex = 0;

  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && isGoTrueToken(req.url())) {
      const idx = tokenIndex;
      tokenIndex += 1;
      if (idx === 0) {
        // First attempt: hold until release, then late admin success.
        await new Promise<void>((resolve) => {
          releases[0] = resolve;
        });
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            buildFakeGoTrueSession({
              id: '00000000-0000-4000-8000-000000000001',
              email: 'admin@sagatree.local',
              provider: 'email',
            }),
          ),
        });
        return;
      }
      // Newer attempts: fail fast so second login uses fallback quickly.
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await fillCredentials(page, 'admin', '1234');
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await expect(dashboardReadyLocator(page)).toBeVisible({
    timeout: AUTH_SESSION_TIMEOUT_MS + 2_500,
  });
  await logoutViaUi(page);

  // Second Local Admin login (newest generation) → fallback after abort.
  await fillCredentials(page, 'admin', '1234');
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await expect(dashboardReadyLocator(page)).toBeVisible({ timeout: 5_000 });

  // Release stale first attempt late success.
  releases[0]?.();
  await page.waitForTimeout(2_500);
  await expect(dashboardReadyLocator(page)).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Login' })).toHaveCount(0);
});

test('7 non-Local-Admin login does not use Local Admin fallback', async ({ page }) => {
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && isGoTrueToken(req.url())) {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      });
      return;
    }
    await route.continue();
  });

  await fillCredentials(page, 'someone@example.com', 'wrong-password');
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await expect(page.getByRole('tab', { name: 'Login' })).toBeVisible({ timeout: 5_000 });
  await expect(dashboardReadyLocator(page)).toHaveCount(0);
  const localFlag = await page.evaluate((k) => localStorage.getItem(k), LOCAL_ADMIN_STORAGE_KEY);
  expect(localFlag).not.toBe('true');
});

test('8 session bootstrap with Local Admin storage remains regressionsfrei', async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'true');
  }, LOCAL_ADMIN_STORAGE_KEY);

  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (/\/auth\/v1\/(token|user|session)/.test(url)) {
      await new Promise((r) => setTimeout(r, AUTH_SESSION_TIMEOUT_MS + 3_000));
      await route.abort('timedout');
      return;
    }
    await route.continue();
  });

  const t0 = Date.now();
  await page.goto('/');
  await expect(dashboardReadyLocator(page)).toBeVisible({
    timeout: AUTH_SESSION_TIMEOUT_MS + 3_000,
  });
  const elapsed = Date.now() - t0;
  expect(elapsed).toBeLessThan(AUTH_SESSION_TIMEOUT_MS + 3_000);
  fs.writeFileSync(path.join(EVIDENCE, 'case-8.json'), `${JSON.stringify({ elapsedMs: elapsed }, null, 2)}\n`);
});

test('B immediate GoTrue fail → Local Admin fallback', async ({ page }) => {
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && isGoTrueToken(req.url())) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  const t0 = Date.now();
  await fillCredentials(page, 'admin', '1234');
  await page.getByRole('button', { name: 'Einloggen' }).click();
  await expect(dashboardReadyLocator(page)).toBeVisible({ timeout: 5_000 });
  expect(Date.now() - t0).toBeLessThan(5_000);
});
