/**
 * Shared HOST Browser-E2E helpers for the productive Custom-WebGL atlas (ATL2-H01+).
 * Location: e2e/helpers/atlas-host.ts
 *
 * Opens the seeded Dornhain world atlas in the 3D surface through the real product
 * route (Host Better Auth + SQLite) and reads the runtime bridge. Reusable by later
 * ATL2-H / ATL3 specs so they do not grow private copies.
 */
import { expect, type Page } from '@playwright/test';
import { ensureLoggedIn } from './auth';

export type AtlasBridgeState = {
  readonly mode?: string;
  readonly level?: string;
  readonly props?: number;
  readonly geometry?: ReadonlyArray<{ readonly name: string; readonly triangles: number }>;
};

type AtlasBridge = { readonly getState: () => AtlasBridgeState };

export async function atlasBridgeState(page: Page): Promise<AtlasBridgeState | null> {
  return page.evaluate(() => {
    const b = (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas;
    return b?.getState() ?? null;
  });
}

export async function waitAtlas3dReady(page: Page): Promise<void> {
  await expect(page.locator('[data-atlas-ready="true"]').first()).toBeVisible({ timeout: 90_000 });
  await expect
    .poll(async () => (await atlasBridgeState(page))?.mode ?? 'missing', { timeout: 60_000 })
    .toBe('webgl');
}

/** Seeded Dornhain starter → world atlas route → 3D surface ready. */
export async function openDornhainAtlas3d(page: Page): Promise<{ worldPublicId: string }> {
  await ensureLoggedIn(page);
  const origin = new URL(page.url()).origin;
  const ensure = await page.request.post('/api/v1/projects/ensure-starter', {
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    data: { slug: 'dornhain.whisper' },
  });
  expect(ensure.ok(), await ensure.text()).toBeTruthy();
  const worlds = await page.request.get('/api/v1/library/worlds', { headers: { Origin: origin } });
  const body = (await worlds.json()) as { worlds?: Array<{ title?: string; publicId?: string }> };
  const publicId = (body.worlds ?? []).find((w) => w.title === 'Dornhain')?.publicId;
  expect(publicId, 'Dornhain starter world').toBeTruthy();
  if (!publicId) throw new Error('Dornhain starter world missing');
  await page.goto(`/library/worlds/${publicId}/map`);
  await expect(page.locator('[data-world-atlas-workbench]').first()).toBeVisible({ timeout: 45_000 });
  const mode3d = page.locator('[data-atlas-surface-mode="3d"]').first();
  const mode2d = page.locator('[data-atlas-surface-mode="2d"]').first();
  await expect(mode3d.or(mode2d)).toBeVisible({ timeout: 60_000 });
  if ((await mode3d.count()) === 0) await page.locator('[data-atlas-surface-toggle]').first().click();
  await expect(mode3d).toBeVisible({ timeout: 60_000 });
  await waitAtlas3dReady(page);
  return { worldPublicId: publicId };
}
