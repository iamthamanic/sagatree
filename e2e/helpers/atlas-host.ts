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

/** World profile id of the open Dornhain atlas (DB nav root row `world:<id>`). */
export async function atlasWorldId(page: Page): Promise<string> {
  const id = await page.evaluate(() =>
    document
      .querySelector('[data-atlas-nav-source="db"] .nav-focus[data-nav-kind="world"]')
      ?.getAttribute('data-focus')
      ?.replace(/^world:/, ''),
  );
  expect(id, 'world nav root').toBeTruthy();
  return id ?? '';
}

/** Current `.nav-focus` row label in the DB WorldNode tree (null when none is current). */
export async function atlasNavCurrentTitle(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const cur = document.querySelector(
      '[data-atlas-nav-source="db"] .nav-focus.current, [data-atlas-nav-source="db"] .nav-focus[aria-current="true"]',
    );
    if (!cur) return null;
    return (cur.querySelector('strong.nav-edit')?.textContent ?? cur.textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  });
}

/**
 * Programmatic `.nav-focus` click on the DB WorldNode tree (same path as G04/G05 drill),
 * then wait until the row is current and the 3D runtime is ready again.
 */
export async function focusAtlasNavTitle(page: Page, title: string): Promise<void> {
  let focusId: string | null = null;
  await expect
    .poll(
      async () => {
        focusId = await page.evaluate((want) => {
          const side = document.querySelector('#side');
          if (side?.getAttribute('data-collapsed') === 'true') {
            side.querySelector<HTMLElement>('[data-atlas-panel-fold]')?.click();
          }
          document
            .querySelectorAll<HTMLElement>('[data-nav-toggle][aria-expanded="false"]')
            .forEach((t) => t.click());
          const rows = [
            ...document.querySelectorAll<HTMLElement>('[data-atlas-nav-source="db"] .nav-focus'),
          ];
          const hit = rows.find(
            (r) => (r.querySelector('strong.nav-edit')?.textContent ?? '').trim() === want,
          );
          return hit?.getAttribute('data-focus') ?? null;
        }, title);
        return focusId ? 1 : 0;
      },
      { timeout: 20_000, message: `nav row for ${title}` },
    )
    .toBe(1);
  await page.waitForTimeout(250);
  if ((await page.locator('[data-atlas-nav-source="db"] input[type="text"]').count()) > 0) {
    await page.keyboard.press('Escape');
  }
  await page.evaluate((id) => {
    document
      .querySelector<HTMLElement>(`[data-atlas-nav-source="db"] .nav-focus[data-focus="${id}"]`)
      ?.click();
  }, focusId ?? '');
  await waitAtlas3dReady(page);
  await expect
    .poll(async () => {
      const cur = await atlasNavCurrentTitle(page);
      return cur !== null && (cur === title || cur.startsWith(title)) ? 1 : 0;
    }, { timeout: 20_000, message: `nav current = ${title}` })
    .toBe(1);
}

/** Click the DB nav world root row and wait for the 3D runtime. */
export async function openAtlasWorldRoot(page: Page): Promise<void> {
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>('[data-atlas-nav-source="db"] .nav-focus[data-nav-kind="world"]')
      ?.click();
  });
  await waitAtlas3dReady(page);
  await page.waitForTimeout(250);
}
