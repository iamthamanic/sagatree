/**
 * ATL2-H03 (#1236) — Golden-E2E: one realistic Dornhain journey on the productive
 * Custom-WebGL atlas (ADR-ST-10) against the real HOST (Better Auth + SQLite).
 * Location: e2e/atl2-h03-golden-journey.spec.ts
 *
 * Golden chain (owner freeze 2026-11-15): Welt → Kontinent Westmark → Nordreich →
 * Dornhain → Taverne Zum Flüstern (→ Schankraum, room scale) / Krypta unter dem Hügel
 * (→ Gruftkammer, room scale). Seed keys stay `country.westmark` (display rename only).
 *
 * Covers: forward/back on both branches, room scale, 2D edit → autosave → reload → 3D with
 * the same object ids, undo/redo persisted, dungeon generate preview, GM vs player
 * (player1 has no access), negatives (stale revision 409, offline save, unauthenticated),
 * phone/tablet viewports. Every test that writes restores Golden through the product
 * "Golden" reset so later specs (G04 pixel baselines) see the seed state.
 *
 * Screenshots: running app only, named
 * `h03__<world>__map-<mapId>__<camera>__<sha>__<profile>__<viewport>.png`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import {
  atlasBridgeState,
  atlasNavCurrentTitle,
  atlasWorldId,
  focusAtlasNavTitle,
  openAtlasWorldRoot,
  openDornhainAtlas3d,
  waitAtlas3dReady,
} from './helpers/atlas-host';
import { ensureLoggedIn } from './helpers/auth';

const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';
const root = process.cwd();
const EVIDENCE = join(root, '.qa/evidence/atl2-h03-golden-journey');

const GOLDEN_TITLES = {
  world: 'Welt',
  continent: 'Kontinent Westmark',
  country: 'Nordreich',
  city: 'Dornhain',
  tavern: 'Taverne Zum Flüstern',
  crypt: 'Krypta unter dem Hügel',
} as const;
/** Room scale has no own product map: it is the building map at a room camera span. */
const ROOM_SPAN_MAX = 120;
const GOLDEN_TAVERN_OBJECT_IDS = ['g.tav.table', 'g.tav.chair-a', 'g.tav.chair-b', 'g.tav.barrel'];

type AtlasMapRow = { readonly id: string; readonly title: string; readonly revision: number };
type CanvasObject = { readonly id: string; readonly type: string };
type AtlasMapDetail = AtlasMapRow & {
  readonly generatorMeta?: { readonly unifiedCanvas?: { readonly objects?: CanvasObject[] } };
  readonly [key: string]: unknown;
};
type FullBridge = {
  getState: () => { span?: number; mode?: string; props?: number; rooms?: number; product?: { scale?: string } | null };
  zoomAt?: (factor: number) => void;
};

function buildSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short=10', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 10) ?? 'unknown';
  }
}

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

async function listMaps(request: APIRequestContext, origin: string, worldId: string): Promise<AtlasMapRow[]> {
  const res = await request.get(`/api/v1/worlds/${worldId}/atlas/maps`, { headers: { Origin: origin } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return ((await res.json()) as { maps?: AtlasMapRow[] }).maps ?? [];
}

async function getMap(request: APIRequestContext, origin: string, mapId: string): Promise<AtlasMapDetail> {
  const res = await request.get(`/api/v1/worlds/atlas/maps/${mapId}`, { headers: { Origin: origin } });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as AtlasMapDetail;
}

function objectIds(map: AtlasMapDetail): string[] {
  return (map.generatorMeta?.unifiedCanvas?.objects ?? []).map((o) => o.id).sort();
}

function mapIdByTitle(maps: readonly AtlasMapRow[], title: string): string {
  const id = maps.find((m) => m.title === title)?.id;
  expect(id, `atlas map ${title}`).toBeTruthy();
  return id ?? '';
}

async function mapScale(page: Page): Promise<string | null> {
  return page.locator('[data-atlas-map-scale]').first().getAttribute('data-atlas-map-scale');
}

/** Zoom the 3D camera into room scale (Schankraum / Gruftkammer) and back out. */
async function zoomToRoomScale(page: Page): Promise<number> {
  const span = await page.evaluate((max) => {
    const b = (window as unknown as { __sagatreeAtlas?: FullBridge }).__sagatreeAtlas;
    if (!b?.zoomAt) throw new Error('zoomAt missing');
    for (let i = 0; i < 24; i += 1) {
      const s = Number(b.getState().span);
      if (!Number.isFinite(s) || s <= max) break;
      b.zoomAt(0.82);
    }
    return Number(b.getState().span);
  }, ROOM_SPAN_MAX);
  await page.waitForTimeout(300);
  return span;
}

async function zoomOut(page: Page): Promise<number> {
  return page.evaluate(() => {
    const b = (window as unknown as { __sagatreeAtlas?: FullBridge }).__sagatreeAtlas;
    for (let i = 0; i < 12; i += 1) b?.zoomAt?.(1.22);
    return Number(b?.getState().span);
  });
}

/** World root → Kontinent Westmark → Nordreich → Dornhain → Taverne (DB nav). */
async function drillToTavern(page: Page): Promise<void> {
  await openAtlasWorldRoot(page);
  for (const title of [GOLDEN_TITLES.continent, GOLDEN_TITLES.country, GOLDEN_TITLES.city, GOLDEN_TITLES.tavern]) {
    await focusAtlasNavTitle(page, title);
  }
}

async function toSurface(page: Page, mode: '2d' | '3d'): Promise<void> {
  const target = page.locator(`[data-atlas-surface-mode="${mode}"]`).first();
  const any = page.locator('[data-atlas-surface-mode="2d"], [data-atlas-surface-mode="3d"]').first();
  // Wait until a surface is mounted (after reload the last surface is restored) before toggling.
  await expect(any).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-atlas-booting="true"]')).toHaveCount(0, { timeout: 60_000 });
  await expect
    .poll(
      async () => {
        if ((await target.count()) > 0) return 1;
        await page.locator('[data-atlas-surface-toggle]').first().click();
        await page.waitForTimeout(1_000);
        return (await target.count()) > 0 ? 1 : 0;
      },
      { timeout: 60_000, intervals: [500, 2_000, 4_000] },
    )
    .toBe(1);
  await expect(target).toBeVisible({ timeout: 60_000 });
  if (mode === '3d') await waitAtlas3dReady(page);
}

/** Wait for the next successful autosave PUT for `mapId`. */
function waitForMapSave(page: Page, mapId: string) {
  return page.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' &&
      /\/atlas\/maps$/.test(new URL(r.url()).pathname) &&
      (r.request().postData() ?? '').includes(`"mapId":"${mapId}"`) &&
      r.ok(),
    { timeout: 30_000 },
  );
}

async function placeStamp2d(page: Page, label: RegExp, fx = 0.5, fy = 0.5): Promise<void> {
  await page.getByRole('button', { name: label }).first().click();
  const vp = page.locator('[data-unified-atlas-viewport]').first();
  const box = await vp.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
}

async function shot(page: Page, worldPublicId: string, mapId: string, camera: string, viewport: string): Promise<void> {
  mkdirSync(EVIDENCE, { recursive: true });
  const preset =
    (await page.locator('[data-atlas-graphics-preset]').first().getAttribute('data-atlas-graphics-preset').catch(() => null)) ??
    'balanced';
  // CI / this box run GPU-less: label as software rendering (no hardware perf claims).
  const name = `h03__${slug(worldPublicId)}__map-${slug(mapId)}__${camera}__${buildSha()}__${slug(preset)}-software-webgl__${viewport}.png`;
  await page.screenshot({ path: join(EVIDENCE, name), animations: 'disabled' });
}

/** Product "Golden" reset (scope: Atlas + Golden-Orte) from the world root map. */
async function resetToGolden(page: Page): Promise<void> {
  await toSurface(page, '3d');
  await openAtlasWorldRoot(page);
  await page.locator('[data-atlas-golden-reset-open]').first().click();
  const dialog = page.locator('[data-atlas-golden-reset-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-atlas-golden-reset-confirm]').click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await waitAtlas3dReady(page);
}

test.describe('ATL2-H03 Golden journey (#1236)', () => {
  test.describe.configure({ mode: 'serial' });

  test('browser-host: Golden chain forward/back, room scale, 2D edit → reload → 3D ids, undo/redo, dungeon preview', async ({
    page,
  }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
    test.setTimeout(420_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const { worldPublicId } = await openDornhainAtlas3d(page);
    const origin = new URL(page.url()).origin;
    const worldId = await atlasWorldId(page);

    try {
      // ── Golden names (owner freeze): exact chain in the DB nav + API.
      const maps = await listMaps(page.request, origin, worldId);
      expect(maps.map((m) => m.title)).toEqual(expect.arrayContaining(Object.values(GOLDEN_TITLES)));
      expect(maps.map((m) => m.title)).not.toContain('Land Westmark');
      const tavernId = mapIdByTitle(maps, GOLDEN_TITLES.tavern);
      const cryptId = mapIdByTitle(maps, GOLDEN_TITLES.crypt);
      expect(await mapScale(page)).toBe('world');
      await shot(page, worldPublicId, mapIdByTitle(maps, GOLDEN_TITLES.world), 'ortho-topdown', 'desktop');

      // ── Forward: tavern branch down to room scale (Schankraum).
      const scales: Record<string, string | null> = {};
      for (const title of [GOLDEN_TITLES.continent, GOLDEN_TITLES.country, GOLDEN_TITLES.city, GOLDEN_TITLES.tavern]) {
        await focusAtlasNavTitle(page, title);
        scales[title] = await mapScale(page);
      }
      expect(scales[GOLDEN_TITLES.tavern]).toBe('interior');
      expect(new Set(Object.values(scales)).size, JSON.stringify(scales)).toBeGreaterThanOrEqual(3);
      await shot(page, worldPublicId, tavernId, 'ortho-topdown', 'desktop');
      const tavernSpan = Number((await atlasBridgeState(page) as { span?: number } | null)?.span ?? NaN);
      const roomSpan = await zoomToRoomScale(page);
      expect(roomSpan, 'Schankraum room-scale span').toBeLessThanOrEqual(ROOM_SPAN_MAX);
      expect(roomSpan).toBeLessThan(tavernSpan);
      await shot(page, worldPublicId, tavernId, 'room-schankraum', 'desktop');
      expect(await zoomOut(page)).toBeGreaterThan(roomSpan);

      // ── Back to Dornhain, then crypt branch down to room scale (Gruftkammer).
      await focusAtlasNavTitle(page, GOLDEN_TITLES.city);
      expect(await mapScale(page)).toBe(scales[GOLDEN_TITLES.city]);
      await focusAtlasNavTitle(page, GOLDEN_TITLES.crypt);
      expect(await mapScale(page)).toBe('interior');
      expect(await zoomToRoomScale(page), 'Gruftkammer room-scale span').toBeLessThanOrEqual(ROOM_SPAN_MAX);
      await shot(page, worldPublicId, cryptId, 'room-gruftkammer', 'desktop');
      await zoomOut(page);

      // ── Dungeon generate = preview in the 3D runtime (stays WebGL, no Golden map write).
      const generate = page.locator('[data-atlas-dungeon-generate]').first();
      if ((await generate.count()) > 0 && (await generate.isVisible())) {
        await generate.click();
        await page.waitForTimeout(800);
        const st = await atlasBridgeState(page);
        expect(st?.mode).toBe('webgl');
        expect(((st as { rooms?: number } | null)?.rooms ?? 0)).toBeGreaterThan(0);
      }
      expect((await getMap(page.request, origin, cryptId)).revision).toBeGreaterThanOrEqual(1);

      // ── Back up the chain to the world root (both branches walked).
      for (const title of [GOLDEN_TITLES.city, GOLDEN_TITLES.country, GOLDEN_TITLES.continent]) {
        await focusAtlasNavTitle(page, title);
      }
      await openAtlasWorldRoot(page);
      expect(await mapScale(page)).toBe('world');

      // ── 2D edit → autosave → reload → 3D with the same object ids.
      await drillToTavern(page);
      const before = await getMap(page.request, origin, tavernId);
      expect(objectIds(before)).toEqual([...GOLDEN_TAVERN_OBJECT_IDS].sort());
      await toSurface(page, '2d');
      // 2D breadcrumb shows the frozen Golden chain.
      await expect(page.locator('[data-world-atlas-breadcrumb]').first()).toContainText(GOLDEN_TITLES.country);
      const saved = waitForMapSave(page, tavernId);
      await placeStamp2d(page, /Kiste/);
      await saved;
      const afterEdit = await getMap(page.request, origin, tavernId);
      expect(afterEdit.revision).toBe(before.revision + 1);
      const added = objectIds(afterEdit).filter((id) => !GOLDEN_TAVERN_OBJECT_IDS.includes(id));
      expect(added).toHaveLength(1);
      const editedIds = objectIds(afterEdit);

      await page.reload();
      await expect(page.locator('[data-world-atlas-workbench]').first()).toBeVisible({ timeout: 45_000 });
      await toSurface(page, '3d');
      await drillToTavern(page);
      expect((await atlasBridgeState(page))?.props, '3D props after reload').toBe(editedIds.length);
      const afterReload = await getMap(page.request, origin, tavernId);
      expect(objectIds(afterReload)).toEqual(editedIds);
      expect(afterReload.revision).toBe(afterEdit.revision);
      await shot(page, worldPublicId, tavernId, 'ortho-topdown-after-edit', 'desktop');

      // ── Undo / redo in 2D are persisted (history is per session, so edit again first).
      await toSurface(page, '2d');
      const secondSave = waitForMapSave(page, tavernId);
      await placeStamp2d(page, /Fass/, 0.4, 0.6);
      await secondSave;
      const withSecond = objectIds(await getMap(page.request, origin, tavernId));
      const secondId = withSecond.filter((id) => !editedIds.includes(id));
      expect(secondId).toHaveLength(1);
      const undoSave = waitForMapSave(page, tavernId);
      await page.locator('[data-atlas-undo]').first().click();
      await undoSave;
      expect(objectIds(await getMap(page.request, origin, tavernId))).toEqual(editedIds);
      const redoSave = waitForMapSave(page, tavernId);
      await page.locator('[data-atlas-redo]').first().click();
      await redoSave;
      // Redo restores the same object id (no new id minted).
      expect(objectIds(await getMap(page.request, origin, tavernId))).toEqual(withSecond);

      // ── 2D "Zurück zur Elternkarte" goes up one level.
      await page.locator('[data-world-atlas-hierarchy-back]').first().click();
      await expect(page.locator('[data-world-atlas-breadcrumb]').first()).not.toContainText(GOLDEN_TITLES.tavern, {
        timeout: 20_000,
      });
    } finally {
      await resetToGolden(page);
    }
    const restoredMaps = await listMaps(page.request, origin, worldId);
    const restored = await getMap(page.request, origin, mapIdByTitle(restoredMaps, GOLDEN_TITLES.tavern));
    expect(objectIds(restored)).toEqual([...GOLDEN_TAVERN_OBJECT_IDS].sort());
    expect(await atlasNavCurrentTitle(page)).not.toBeNull();
  });

  test('browser-host: negatives — stale revision 409, offline save, unauthenticated, player1 has no GM access', async ({
    page,
    browser,
  }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    const { worldPublicId } = await openDornhainAtlas3d(page);
    const origin = new URL(page.url()).origin;
    const worldId = await atlasWorldId(page);
    const maps = await listMaps(page.request, origin, worldId);
    const tavernId = mapIdByTitle(maps, GOLDEN_TITLES.tavern);
    const golden = await getMap(page.request, origin, tavernId);
    const putBody = (expectedRevision: number) => ({
      mapId: golden.id,
      parentMapId: golden['parentMapId'],
      kind: golden['kind'],
      title: golden.title,
      sortOrder: golden['sortOrder'],
      bounds: golden['bounds'],
      layers: golden['layers'],
      generatorMeta: golden.generatorMeta,
      expectedRevision,
    });

    try {
      // Stale revision → 409, map untouched.
      const stale = await page.request.put(`/api/v1/worlds/${worldId}/atlas/maps`, {
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        data: putBody(golden.revision - 1),
      });
      expect(stale.status()).toBe(409);
      expect((await getMap(page.request, origin, tavernId)).revision).toBe(golden.revision);

      // Unauthenticated → 401/403 for read and write.
      const anon = await browser.newContext({ baseURL: origin });
      try {
        const r = await anon.request.get(`/api/v1/worlds/atlas/maps/${tavernId}`, { headers: { Origin: origin } });
        expect([401, 403]).toContain(r.status());
        const w = await anon.request.put(`/api/v1/worlds/${worldId}/atlas/maps`, {
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          data: putBody(golden.revision),
        });
        expect([401, 403]).toContain(w.status());
      } finally {
        await anon.close();
      }

      // player1 (seeded demo player, not a member of the admin's Dornhain world): no GM write.
      const playerCtx = await browser.newContext({ baseURL: origin });
      try {
        const player = await playerCtx.newPage();
        await ensureLoggedIn(player, { user: 'player1@sagatree.local', password: '1234' });
        const w = await player.request.put(`/api/v1/worlds/${worldId}/atlas/maps`, {
          headers: { Origin: origin, 'Content-Type': 'application/json' },
          data: putBody(golden.revision),
        });
        expect([403, 404]).toContain(w.status());
        const r = await player.request.get(`/api/v1/worlds/atlas/maps/${tavernId}`, { headers: { Origin: origin } });
        expect(r.ok(), 'player1 must not read GM atlas of a foreign world').toBeFalsy();
        // UI: the GM-only atlas tools (Golden reset, explicit save, 3D editor) never mount for player1.
        await player.goto(`/library/worlds/${worldPublicId}/map`);
        await player.waitForTimeout(3_000);
        await expect(player.locator('[data-atlas-golden-reset-open]')).toHaveCount(0);
        await expect(player.locator('[data-atlas-explicit-save]')).toHaveCount(0);
        await expect(player.locator('[data-atlas-native-3d-host]')).toHaveCount(0);
      } finally {
        await playerCtx.close();
      }
      expect((await getMap(page.request, origin, tavernId)).revision).toBe(golden.revision);

      // Offline: 2D edit cannot be persisted; server keeps the Golden revision.
      await drillToTavern(page);
      await toSurface(page, '2d');
      await page.context().setOffline(true);
      await placeStamp2d(page, /Fass/, 0.45, 0.55);
      await page.waitForTimeout(3_000);
      await page.context().setOffline(false);
      expect((await getMap(page.request, origin, tavernId)).revision).toBe(golden.revision);
      await expect(page.locator('[data-unified-atlas-editor]').first()).toBeVisible();
    } finally {
      await page.context().setOffline(false);
      await page.reload();
      await expect(page.locator('[data-world-atlas-workbench]').first()).toBeVisible({ timeout: 45_000 });
      await resetToGolden(page);
    }
    expect(objectIds(await getMap(page.request, origin, mapIdByTitle(await listMaps(page.request, origin, worldId), GOLDEN_TITLES.tavern)))).toEqual(
      [...GOLDEN_TAVERN_OBJECT_IDS].sort(),
    );
  });

  for (const vp of [
    { name: 'phone', width: 390, height: 844 },
    { name: 'tablet', width: 820, height: 1180 },
  ] as const) {
    test(`browser-host: ${vp.name} viewport — Golden chain to tavern and crypt (read-only)`, async ({ page }) => {
      test.skip(!HOST, 'requires browser-e2e-with-host');
      test.setTimeout(240_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const { worldPublicId } = await openDornhainAtlas3d(page);
      const origin = new URL(page.url()).origin;
      const maps = await listMaps(page.request, origin, await atlasWorldId(page));
      await drillToTavern(page);
      expect(await mapScale(page)).toBe('interior');
      await shot(page, worldPublicId, mapIdByTitle(maps, GOLDEN_TITLES.tavern), 'ortho-topdown', vp.name);
      await focusAtlasNavTitle(page, GOLDEN_TITLES.city);
      await focusAtlasNavTitle(page, GOLDEN_TITLES.crypt);
      expect(await mapScale(page)).toBe('interior');
      // No horizontal overflow on the atlas workstation.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }
});
