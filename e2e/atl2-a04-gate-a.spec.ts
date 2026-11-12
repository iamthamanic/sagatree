/**
 * atl2-a04-gate-a — Browser wrapper for Gate A foundation protocol (#1200).
 * Location: e2e/atl2-a04-gate-a.spec.ts
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureLoggedIn } from './helpers/auth';

const root = process.cwd();
const selfTest = join(root, 'scripts/atl2-a04-gate-a.self-test.mjs');
const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';

test.describe('ATL2-A04 Gate A', () => {
  test('host protocol self-test PASS (CLEAR)', () => {
    expect(existsSync(selfTest)).toBeTruthy();
    const stdout = execFileSync(process.execPath, [selfTest], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    expect(stdout).toContain('atl2-a04-gate-a self-test: PASS');
    expect(stdout).toContain('CLEAR');
    const report = readFileSync(join(root, '.qa/runs/atl2-a04-gate-a.md'), 'utf8');
    expect(report).toContain('Verdict: **CLEAR**');
  });

  test('browser-host: ensure-starter yields Golden six-level maps', async ({ page }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
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
    const body = (await worlds.json()) as { worlds?: Array<{ id: string; title?: string }> };
    const dornhain = (body.worlds ?? []).find((w) => w.title === 'Dornhain');
    expect(dornhain?.id).toBeTruthy();
    const mapsRes = await page.request.get(`/api/v1/worlds/${dornhain!.id}/atlas/maps`, {
      headers: { Origin: origin },
    });
    expect(mapsRes.ok()).toBeTruthy();
    const titles = (((await mapsRes.json()) as { maps?: Array<{ title: string }> }).maps ?? []).map(
      (m) => m.title,
    );
    expect(titles.length).toBeGreaterThanOrEqual(6);
    expect(titles).toEqual(
      expect.arrayContaining([
        'Welt',
        'Kontinent Westmark',
        'Land Westmark',
        'Dornhain',
        'Taverne Zum Flüstern',
        'Krypta unter dem Hügel',
      ]),
    );
  });
});
