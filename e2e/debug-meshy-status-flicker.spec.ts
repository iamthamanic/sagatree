/**
 * Debug/regression: Meshy status line must not flicker during generation.
 * Location: e2e/debug-meshy-status-flicker.spec.ts
 *
 * Root cause covered: unstable onSuccess remounted config effect → status
 * flipped to "Prüfe Meshy-Konfiguration …" / idle while job was generating.
 */
import { test, expect } from '@playwright/test';
import { openBlankCharacterEditor } from './helpers/character-editor';

const JOB_ID = 'e2e-meshy-flicker-job';

test('meshy status message stays stable while generating (no config remount flicker)', async ({
  page,
}) => {
  test.setTimeout(120_000);

  let pollCount = 0;
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  await page.route('**/functions/v1/ai-provider-credentials', async (route) => {
    const body = route.request().postDataJSON() as { action?: string; providerId?: string } | null;
    const meshyProvider = {
      providerId: 'meshy',
      displayName: 'Meshy',
      configured: true,
      status: 'active',
      keyHint: '••••e2e',
      meta: { credits: 1000 },
    };
    if (body?.action === 'list') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          providers: [meshyProvider],
        }),
      });
      return;
    }
    if (body?.action === 'refresh') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          provider: meshyProvider,
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });
  });

  await page.route('**/functions/v1/character-avatar-meshy', async (route) => {
    const body = route.request().postDataJSON() as {
      action?: string;
      clientNonce?: string;
    } | null;
    const action = body?.action;
    if (action === 'config') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          meshyConfigured: true,
          promptMinChars: 8,
          promptMaxChars: 500,
          imageMaxBytes: 4 * 1024 * 1024,
          supportsImageTo3d: true,
          costHintDe: 'E2E mock — keine echten Credits.',
        }),
      });
      return;
    }
    if (action === 'start') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          job: {
            id: JOB_ID,
            status: 'generating',
            progress: 12,
            prompt: 'e2e flicker prompt long enough',
            idempotency_key: body?.clientNonce ?? 'e2e',
            rig_analysis_status: 'pending',
          },
        }),
      });
      return;
    }
    if (action === 'poll' || action === 'retry') {
      pollCount += 1;
      const progress = Math.min(85, 12 + pollCount * 8);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          job: {
            id: JOB_ID,
            status: 'generating',
            progress,
            prompt: 'e2e flicker prompt long enough',
            idempotency_key: 'e2e',
            rig_analysis_status: 'pending',
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'error', message: `Unhandled action ${action}` }),
    });
  });

  await openBlankCharacterEditor(page);

  const meshySource = page.getByRole('radio', { name: /Mit KI erstellen/i }).or(
    page.locator('[data-avatar-source="meshy"]'),
  );
  if (await meshySource.count()) {
    await meshySource.first().click();
  } else {
    await page.getByText(/Mit KI erstellen/i).first().click();
  }

  const panel = page.locator('[data-avatar-meshy-status]');
  await expect(panel).toBeVisible({ timeout: 15_000 });

  const prompt = page.locator('[data-avatar-meshy-prompt]');
  await expect(prompt).toBeVisible();
  await prompt.fill('Elfenkrieger in Lederrüstung, stilisierter Look für E2E');

  await page.locator('[data-avatar-meshy-start]').click();
  await expect(page.locator('[data-avatar-meshy-confirm-modal]')).toBeVisible({ timeout: 5_000 });
  await page.locator('[data-avatar-meshy-confirm]').click();

  const status = page.locator('[data-avatar-meshy-message]');
  await expect(status).toContainText(/Generiert/i, { timeout: 10_000 });

  const samples: string[] = [];
  const started = Date.now();
  while (Date.now() - started < 8_000) {
    samples.push((await status.innerText()).trim());
    await page.waitForTimeout(250);
  }

  const flickerBack = samples.filter(
    (text) =>
      /Prüfe Meshy-Konfiguration/i.test(text) ||
      /^Bereit$/i.test(text) ||
      text.length === 0,
  );

  expect(
    flickerBack,
    `Status flickered during generation. samples=${JSON.stringify(samples)} console=${JSON.stringify(consoleErrors)}`,
  ).toEqual([]);

  expect(samples.some((text) => /Generiert/i.test(text))).toBe(true);
  expect(pollCount).toBeGreaterThan(0);

  // Ignore known app chrome noise (DevTrack, Radix forwardRef warnings).
  const critical = consoleErrors.filter(
    (line) =>
      !/favicon|Download the React DevTools|DevTrack|ERR_NAME_NOT_RESOLVED|ERR_UNSAFE_PORT|Failed to fetch|net::ERR_|forwardRef|Function components cannot be given refs|Primitive\.div\.SlotClone/i.test(
        line,
      ),
  );
  expect(critical, `Unexpected console errors: ${critical.join(' | ')}`).toEqual([]);
});
