/**
 * atl2-g05-gate-g — Browser wrapper for Gate G quality protocol (#1233).
 * Location: e2e/atl2-g05-gate-g.spec.ts
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureLoggedIn } from './helpers/auth';

const root = process.cwd();
const selfTest = join(root, 'scripts/atl2-g05-gate-g.self-test.mjs');
const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';
const EVIDENCE = join(root, '.qa/evidence/atl2-g05-gate-g');

test.describe('ATL2-G05 Gate G', () => {
  test('host protocol self-test PASS (CLEAR)', () => {
    expect(existsSync(selfTest)).toBeTruthy();
    const stdout = execFileSync(process.execPath, [selfTest], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    expect(stdout).toContain('atl2-g05-gate-g self-test: PASS');
    expect(stdout).toContain('CLEAR');
    const report = readFileSync(join(root, '.qa/runs/atl2-g05-gate-g.md'), 'utf8');
    expect(report).toContain('Verdict: **CLEAR**');
    expect(report).toContain('Soll / Ist');
    expect(report).toContain('#1283');
  });

  test('browser-host: Dornhain atlas quality workstation (desktop)', async ({ page }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
    mkdirSync(EVIDENCE, { recursive: true });
    await ensureLoggedIn(page);
    const origin = new URL(page.url()).origin;

    const ensure = await page.request.post('/api/v1/projects/ensure-starter', {
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      data: { slug: 'dornhain.whisper' },
    });
    expect(ensure.ok(), await ensure.text()).toBeTruthy();
    const ensureBody = (await ensure.json()) as { publicId?: string; id?: string };
    expect(ensureBody.publicId?.startsWith('SA-')).toBeTruthy();

    const worlds = await page.request.get('/api/v1/library/worlds', {
      headers: { Origin: origin },
    });
    const body = (await worlds.json()) as {
      worlds?: Array<{ id: string; title?: string; publicId?: string }>;
    };
    const dornhain = (body.worlds ?? []).find((w) => w.title === 'Dornhain');
    expect(dornhain?.publicId).toBeTruthy();

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/library/worlds/${dornhain!.publicId}/map`);
    const workstation = page.locator('[data-world-atlas-workbench]').first();
    await expect(workstation).toBeVisible({ timeout: 45_000 });

    const mode3d = page.locator('[data-atlas-surface-mode="3d"]').first();
    const mode2d = page.locator('[data-atlas-surface-mode="2d"]').first();
    await expect(mode3d.or(mode2d)).toBeVisible({ timeout: 60_000 });

    const surfaceState = page.locator('[data-atlas-surface-state]').first();
    if ((await surfaceState.count()) > 0) {
      await expect(surfaceState).toBeVisible();
    }

    await page.screenshot({
      path: join(EVIDENCE, 'gate-g-workstation-desktop.png'),
      fullPage: true,
    });

    const mapsRes = await page.request.get(`/api/v1/worlds/${dornhain!.id}/atlas/maps`, {
      headers: { Origin: origin },
    });
    expect(mapsRes.ok()).toBeTruthy();
    const titles = (((await mapsRes.json()) as { maps?: Array<{ title: string; id: string }> })
      .maps ?? []).map((m) => m.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        'Welt',
        'Dornhain',
        'Taverne Zum Flüstern',
        'Krypta unter dem Hügel',
      ]),
    );
    // Party-reveal + non-editor SC-03 redaction is proven in
    // scripts/atl2-g05-gate-g.self-test.mjs (host protocol) — Browser E2E does not
    // seed saga_asset_bindings or invent a second player membership here.
  });

  test('browser-host: phone viewport atlas chrome (device matrix)', async ({ page }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
    mkdirSync(EVIDENCE, { recursive: true });
    await ensureLoggedIn(page);
    const origin = new URL(page.url()).origin;

    const ensure = await page.request.post('/api/v1/projects/ensure-starter', {
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      data: { slug: 'dornhain.whisper' },
    });
    expect(ensure.ok(), await ensure.text()).toBeTruthy();

    const worlds = await page.request.get('/api/v1/library/worlds', {
      headers: { Origin: origin },
    });
    const body = (await worlds.json()) as {
      worlds?: Array<{ id: string; title?: string; publicId?: string }>;
    };
    const dornhain = (body.worlds ?? []).find((w) => w.title === 'Dornhain');
    expect(dornhain?.publicId).toBeTruthy();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/library/worlds/${dornhain!.publicId}/map`);
    const workstation = page.locator('[data-world-atlas-workbench]').first();
    await expect(workstation).toBeVisible({ timeout: 45_000 });
    await page.screenshot({
      path: join(EVIDENCE, 'gate-g-workstation-phone.png'),
      fullPage: true,
    });
  });
});
