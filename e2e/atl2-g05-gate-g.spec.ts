/**
 * atl2-g05-gate-g — Browser wrapper for Gate G quality protocol (#1233).
 * Location: e2e/atl2-g05-gate-g.spec.ts
 *
 * Host protocol (self-test) + HOST Browser E2E measurement on the productive
 * Custom-WebGL atlas: rAF frame p50/p95 on real Golden maps, map-switch soak,
 * WebGL context-loss/restore, JS-heap growth, camera modes and the
 * desktop/tablet/phone matrix. Missing measurements stay NOT_RUN (never PASS);
 * any FAIL row fails the test. Software-WebGL (SwiftShader) runs are labelled;
 * their frame p95 is INFO only (logged against the documented software ceiling,
 * never failing — rAF cadence on a GPU-less CI runner measures runner load, draw
 * p95 stays < 2 ms). Hardware renderers keep the hard 33.3 ms budget (#1295 V01).
 */
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureLoggedIn } from './helpers/auth';

const root = process.cwd();
const selfTest = join(root, 'scripts/atl2-g05-gate-g.self-test.mjs');
const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';
const EVIDENCE = join(root, '.qa/evidence/atl2-g05-gate-g');

/** G02 interactive p95 (`ATLAS_PERF_BUDGET_THRESHOLDS.frameP95MsSoft`). */
const FRAME_P95_MS_HARDWARE = 33.3;
/** Documented GPU-less CI ceiling (SwiftShader / llvmpipe) — not a product budget. */
const FRAME_P95_MS_SOFTWARE = 120;
/** G02 `ATLAS_PERF_BUDGET_THRESHOLDS.mapSwitchCycles`. */
const MAP_SWITCH_CYCLES = 8;
const FRAME_SAMPLES = 48;
const HEAP_GROWTH_LIMIT_MB = 48;
const CAMERA_MODES = ['ortho-topdown', 'diorama-oblique', 'perspective'] as const;
const DEVICE_MATRIX = [
  { band: 'desktop', width: 1280, height: 800 },
  { band: 'tablet', width: 834, height: 1112 },
  { band: 'phone', width: 390, height: 844 },
] as const;
/** Real Golden product maps as small / medium / large scenes (no synthetic stress geometry). */
const SCENES = [
  { size: 'small', title: 'Taverne Zum Flüstern', drill: ['Kontinent Westmark', 'Nordreich', 'Dornhain', 'Taverne Zum Flüstern'] },
  { size: 'medium', title: 'Dornhain', drill: ['Kontinent Westmark', 'Nordreich', 'Dornhain'] },
  { size: 'large', title: 'Welt', drill: [] },
] as const;

type G05Status = 'PASS' | 'FAIL' | 'NOT_RUN' | 'INFO';
type G05Row = { id: string; status: G05Status; detail: string };
type RendererKind = 'hardware-webgl' | 'software-webgl' | 'lite3d-fallback' | 'unknown';

type AtlasBridge = {
  getState: () => {
    mode: string;
    span?: number;
    yawDeg?: number;
    cameraMode?: string;
    geometry?: Array<{ name: string; triangles: number }>;
    props?: number;
    undoDepth?: number;
    redoDepth?: number;
  };
  setCameraMode: (mode: string, opts?: { animate?: boolean }) => void;
  setYaw: (deg: number) => void;
  orbit: (yaw: number, pitch: number) => void;
  zoomAt?: (factor: number) => void;
};

/** Fail-closed rollup: any FAIL → FAIL; else any NOT_RUN → NOT_RUN; else PASS. */
function rollupG05(rows: readonly G05Row[]): G05Status {
  if (rows.some((r) => r.status === 'FAIL')) return 'FAIL';
  if (rows.length === 0 || rows.some((r) => r.status === 'NOT_RUN')) return 'NOT_RUN';
  return 'PASS';
}

function percentile(samples: readonly number[], p: number): number {
  const sorted = samples.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (sorted.length === 0) return Number.NaN;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank]!;
}

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

async function bridgeState(page: Page) {
  return page.evaluate(() => {
    const b = (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas;
    return b?.getState() ?? null;
  });
}

async function waitAtlasReady(page: Page): Promise<void> {
  await expect(page.locator('[data-atlas-ready="true"]').first()).toBeVisible({ timeout: 90_000 });
  await expect.poll(async () => (await bridgeState(page))?.mode ?? 'missing', { timeout: 60_000 }).toBe('webgl');
}

async function openDornhainAtlas3d(page: Page): Promise<{ worldId: string; worldPublicId: string }> {
  await ensureLoggedIn(page);
  const origin = new URL(page.url()).origin;
  const ensure = await page.request.post('/api/v1/projects/ensure-starter', {
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    data: { slug: 'dornhain.whisper' },
  });
  expect(ensure.ok(), await ensure.text()).toBeTruthy();
  const worlds = await page.request.get('/api/v1/library/worlds', { headers: { Origin: origin } });
  const body = (await worlds.json()) as { worlds?: Array<{ id: string; title?: string; publicId?: string }> };
  const dornhain = (body.worlds ?? []).find((w) => w.title === 'Dornhain');
  expect(dornhain?.publicId).toBeTruthy();
  await page.goto(`/library/worlds/${dornhain!.publicId}/map`);
  await expect(page.locator('[data-world-atlas-workbench]').first()).toBeVisible({ timeout: 45_000 });
  const mode3d = page.locator('[data-atlas-surface-mode="3d"]').first();
  const mode2d = page.locator('[data-atlas-surface-mode="2d"]').first();
  await expect(mode3d.or(mode2d)).toBeVisible({ timeout: 60_000 });
  if ((await mode3d.count()) === 0) await page.locator('[data-atlas-surface-toggle]').first().click();
  await expect(mode3d).toBeVisible({ timeout: 60_000 });
  await waitAtlasReady(page);
  return { worldId: dornhain!.id, worldPublicId: dornhain!.publicId! };
}

/** Programmatic `.nav-focus` click on the DB WorldNode tree (same path as G04 drill). */
async function focusNavTitle(page: Page, title: string): Promise<void> {
  const findFocusId = () =>
    page.evaluate((want) => {
      const side = document.querySelector('#side');
      if (side?.getAttribute('data-collapsed') === 'true') {
        side.querySelector<HTMLElement>('[data-atlas-panel-fold]')?.click();
      }
      document
        .querySelectorAll<HTMLElement>('[data-nav-toggle][aria-expanded="false"]')
        .forEach((t) => t.click());
      const rows = [...document.querySelectorAll<HTMLElement>('[data-atlas-nav-source="db"] .nav-focus')];
      const hit = rows.find((r) => (r.querySelector('strong.nav-edit')?.textContent ?? '').trim() === want);
      return hit?.getAttribute('data-focus') ?? null;
    }, title);
  let focusId: string | null = null;
  // Tree re-renders after each focus/expand — poll until the child row exists.
  await expect
    .poll(
      async () => {
        focusId = await findFocusId();
        return focusId ? 1 : 0;
      },
      { timeout: 20_000 },
    )
    .toBe(1)
    .catch(() => undefined);
  expect(focusId, `nav focus for ${title}`).toBeTruthy();
  // Let expand/re-render settle (G04 uses the same settle), then click the live node.
  await page.waitForTimeout(250);
  if ((await page.locator('[data-atlas-nav-source="db"] input[type="text"]').count()) > 0) {
    await page.keyboard.press('Escape');
  }
  await page.evaluate((id) => {
    document
      .querySelector<HTMLElement>(`[data-atlas-nav-source="db"] .nav-focus[data-focus="${id}"]`)
      ?.click();
  }, focusId!);
  await waitAtlasReady(page);
  await expect
    .poll(
      async () =>
        page.evaluate((want) => {
          const cur = document.querySelector(
            '[data-atlas-nav-source="db"] .nav-focus.current, [data-atlas-nav-source="db"] .nav-focus[aria-current="true"]',
          );
          if (!cur) return 0;
          // Same predicate as G04: label, rename input value, or row text.
          const text = (
            cur.querySelector('strong.nav-edit')?.textContent ??
            cur.querySelector('input')?.value ??
            cur.textContent ??
            ''
          )
            .replace(/\s+/g, ' ')
            .trim();
          return text === want || text.startsWith(want) ? 1 : 0;
        }, title),
      { timeout: 20_000 },
    )
    .toBe(1);
}

async function openWorldRoot(page: Page): Promise<void> {
  await page.evaluate(() => {
    const world = document.querySelector<HTMLElement>(
      '[data-atlas-nav-source="db"] .nav-focus[data-nav-kind="world"]',
    );
    world?.click();
  });
  await waitAtlasReady(page);
  await page.waitForTimeout(250);
}

async function openScene(page: Page, drill: readonly string[]): Promise<void> {
  await openWorldRoot(page);
  for (const step of drill) await focusNavTitle(page, step);
}

async function detectRenderer(page: Page): Promise<{ kind: RendererKind; unmasked: string; preset: string }> {
  return page.evaluate(() => {
    // Runtime writes graphics/WebGL attributes on the mount host, not the wrapper.
    const host = document.querySelector('[data-atlas-native-3d-host]');
    const preset = host?.getAttribute('data-atlas-graphics-preset') ?? 'unknown';
    if (host?.getAttribute('data-atlas-graphics-fallback')) {
      return { kind: 'lite3d-fallback' as const, unmasked: '', preset };
    }
    const canvas = host?.querySelector('canvas:not(.hidden)') as HTMLCanvasElement | null;
    const gl = canvas?.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return { kind: 'unknown' as const, unmasked: '', preset };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const unmasked = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '') : '';
    const software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(unmasked);
    return { kind: software ? ('software-webgl' as const) : ('hardware-webgl' as const), unmasked, preset };
  });
}

/** Real rAF loop on the productive renderer: each frame rotates yaw → drawFrame(). */
async function sampleFrames(page: Page, n: number): Promise<{ frameMs: number[]; drawMs: number[] }> {
  return page.evaluate(
    (count) =>
      new Promise<{ frameMs: number[]; drawMs: number[] }>((resolve) => {
        const b = (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas;
        const frameMs: number[] = [];
        const drawMs: number[] = [];
        if (!b) {
          resolve({ frameMs, drawMs });
          return;
        }
        let yaw = Number(b.getState().yawDeg) || 0;
        let last = -1;
        // Discard warm-up frames (shader/buffer upload right after a map switch).
        const warmup = 8;
        let left = count + warmup + 1;
        const tick = (now: number) => {
          const idx = count + warmup + 1 - left;
          if (last >= 0 && idx > warmup) frameMs.push(now - last);
          last = now;
          yaw = (yaw + 1.5) % 360;
          const t0 = performance.now();
          b.setYaw(yaw);
          if (idx >= warmup) drawMs.push(performance.now() - t0);
          left -= 1;
          if (left <= 0) resolve({ frameMs, drawMs: drawMs.slice(1) });
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    n,
  );
}

async function jsHeapMb(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return mem?.usedJSHeapSize ? mem.usedJSHeapSize / (1024 * 1024) : null;
  });
}

/** Live GPU mesh slots in the Custom-WebGL engine (bounded set; leaks would grow it). */
async function meshCount(page: Page): Promise<number> {
  return (await bridgeState(page))?.geometry?.length ?? -1;
}

async function meshNames(page: Page): Promise<string[]> {
  return ((await bridgeState(page))?.geometry ?? []).map((g) => g.name).sort();
}

/** Triangles across live meshes — scene workload indicator for small/medium/large. */
async function triangleCount(page: Page): Promise<number> {
  const geo = (await bridgeState(page))?.geometry ?? [];
  return Math.round(geo.reduce((sum, g) => sum + (Number(g.triangles) || 0), 0));
}

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
  test('browser-host: frame / map-switch / context-loss / heap / camera / device evidence', async ({ page }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
    test.setTimeout(420_000);
    mkdirSync(EVIDENCE, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 800 });
    const { worldId, worldPublicId } = await openDornhainAtlas3d(page);
    const origin = new URL(page.url()).origin;
    const mapsRes = await page.request.get(`/api/v1/worlds/${worldId}/atlas/maps`, {
      headers: { Origin: origin },
    });
    expect(mapsRes.ok()).toBeTruthy();
    const mapIdByTitle = new Map(
      (((await mapsRes.json()) as { maps?: Array<{ id: string; title: string }> }).maps ?? []).map(
        (m) => [m.title, m.id] as const,
      ),
    );
    const sha = buildSha();
    const renderer = await detectRenderer(page);
    const budgetMs =
      renderer.kind === 'hardware-webgl' ? FRAME_P95_MS_HARDWARE : FRAME_P95_MS_SOFTWARE;
    /** Software WebGL: frame p95 is informational (logged), hardware stays a hard budget. */
    const frameBudgetEnforced = renderer.kind !== 'software-webgl';
    const profile = `${renderer.preset}-${renderer.kind}`;
    const rows: G05Row[] = [];
    const screenshots: string[] = [];
    const shot = async (mapTitle: string, camera: string, viewport: string) => {
      // Full atlas map id (Golden ids share long prefixes, so truncation is ambiguous).
      const mapId = mapIdByTitle.get(mapTitle) ?? 'unknown';
      const name = `g05__${slug(worldPublicId)}-${slug(mapTitle)}__map-${slug(mapId)}__${camera}__${sha}__${slug(profile)}__${viewport}.png`;
      await page.screenshot({ path: join(EVIDENCE, name), animations: 'disabled' });
      screenshots.push(name);
    };

    // 1) Frame p50/p95 on real small / medium / large Golden maps.
    const frames: Array<Record<string, unknown>> = [];
    for (const scene of SCENES) {
      await openScene(page, scene.drill);
      const meshes = await meshCount(page);
      const triangles = await triangleCount(page);
      const { frameMs, drawMs } = await sampleFrames(page, FRAME_SAMPLES);
      const p50 = percentile(frameMs, 50);
      const p95 = percentile(frameMs, 95);
      const drawP95 = percentile(drawMs, 95);
      frames.push({ scene: scene.size, map: scene.title, meshes, triangles, samples: frameMs.length, p50, p95, drawP95, budgetMs });
      rows.push({
        id: `frame-times-${scene.size}`,
        status:
          frameMs.length < FRAME_SAMPLES || meshes <= 0
            ? 'NOT_RUN'
            : !frameBudgetEnforced
              ? 'INFO'
              : p95 <= budgetMs
                ? 'PASS'
                : 'FAIL',
        detail: `${scene.title}: meshes=${meshes} triangles=${triangles} p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms drawP95=${drawP95.toFixed(1)}ms budget=${budgetMs}ms renderer=${renderer.kind}${frameBudgetEnforced ? '' : ' (informational: software WebGL)'}`,
      });
      if (!frameBudgetEnforced) {
        console.log(`[G05 frame p95 informational] ${scene.title} p95=${p95.toFixed(1)}ms ceiling=${budgetMs}ms renderer=${renderer.kind}`);
      }
      await shot(scene.title, 'default', 'desktop');
    }

    // 2) Three camera modes on Dornhain (state deltas + screenshots).
    await openScene(page, SCENES[1].drill);
    const cameraResults: Array<{ mode: string; ok: boolean; span: number; yaw: number }> = [];
    for (const mode of CAMERA_MODES) {
      await page.evaluate((m) => {
        (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas?.setCameraMode(m, { animate: false });
      }, mode);
      await page.waitForTimeout(300);
      const st = await bridgeState(page);
      cameraResults.push({ mode, ok: st?.cameraMode === mode, span: Number(st?.span), yaw: Number(st?.yawDeg) });
      await shot('Dornhain', mode, 'desktop');
    }
    const zoomOrbit = await page.evaluate(() => {
      const b = (window as unknown as { __sagatreeAtlas?: AtlasBridge }).__sagatreeAtlas;
      if (!b?.zoomAt) return { ok: false, detail: 'zoomAt missing' };
      const before = b.getState();
      b.zoomAt(0.8);
      b.setYaw((Number(before.yawDeg) || 0) + 25);
      const after = b.getState();
      const spanDelta = Math.abs(Number(after.span) - Number(before.span));
      const yawDelta = Math.abs(Number(after.yawDeg) - Number(before.yawDeg));
      return { ok: spanDelta > 0.05 && yawDelta > 0.05, detail: `spanΔ=${spanDelta.toFixed(2)} yawΔ=${yawDelta.toFixed(2)}` };
    });
    rows.push({
      id: 'camera-modes-zoom-orbit',
      status: cameraResults.every((c) => c.ok) && zoomOrbit.ok ? 'PASS' : 'FAIL',
      detail: `${cameraResults.map((c) => `${c.mode}=${c.ok}`).join(' ')} ${zoomOrbit.detail}`,
    });

    // 3) Map-switch soak Dornhain ↔ Taverne: bounded meshes + heap growth.
    await openScene(page, SCENES[1].drill);
    const meshesWarm = await meshCount(page);
    const heapBefore = await jsHeapMb(page);
    for (let i = 0; i < MAP_SWITCH_CYCLES; i += 1) {
      await focusNavTitle(page, 'Taverne Zum Flüstern');
      await focusNavTitle(page, 'Dornhain');
    }
    const meshesAfter = await meshCount(page);
    const heapAfter = await jsHeapMb(page);
    rows.push({
      id: 'map-switch-teardown',
      status: meshesWarm > 0 && meshesAfter > 0 && meshesAfter <= meshesWarm ? 'PASS' : 'FAIL',
      detail: `cycles=${MAP_SWITCH_CYCLES} meshesWarm=${meshesWarm} meshesAfter=${meshesAfter}`,
    });
    rows.push({
      id: 'js-heap-soak',
      status:
        heapBefore == null || heapAfter == null
          ? 'NOT_RUN'
          : heapAfter - heapBefore <= HEAP_GROWTH_LIMIT_MB
            ? 'PASS'
            : 'FAIL',
      detail: `before=${heapBefore?.toFixed(1) ?? 'n/a'}MB after=${heapAfter?.toFixed(1) ?? 'n/a'}MB limit=+${HEAP_GROWTH_LIMIT_MB}MB (performance.memory, coarse)`,
    });

    // 4) WebGL context loss → observed by runtime → restore → same meshes.
    const meshesBeforeLoss = await meshCount(page);
    const namesBeforeLoss = await meshNames(page);
    const forced = await page.evaluate(() => {
      const canvas = document.querySelector('[data-atlas-native-3d] canvas:not(.hidden)') as HTMLCanvasElement | null;
      const gl = canvas?.getContext('webgl2') as WebGL2RenderingContext | null;
      const ext = gl?.getExtension('WEBGL_lose_context');
      if (!ext) return false;
      (window as unknown as { __g05LoseCtx?: WEBGL_lose_context }).__g05LoseCtx = ext;
      ext.loseContext();
      return true;
    });
    let contextRow: G05Row = { id: 'webgl-context-loss', status: 'NOT_RUN', detail: 'WEBGL_lose_context unavailable' };
    if (forced) {
      const lostSeen = await expect
        .poll(
          async () =>
            page.evaluate(() =>
              document.querySelector('[data-atlas-native-3d-host]')?.getAttribute('data-atlas-webgl-lost'),
            ),
          { timeout: 10_000 },
        )
        .toBe('true')
        .then(() => true, () => false);
      await page.evaluate(() => {
        (window as unknown as { __g05LoseCtx?: WEBGL_lose_context }).__g05LoseCtx?.restoreContext();
      });
      const restored = await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const host = document.querySelector('[data-atlas-native-3d-host]');
              return host?.getAttribute('data-atlas-webgl-lost') !== 'true' &&
                host?.getAttribute('data-atlas-webgl-context') === 'ok'
                ? 1
                : 0;
            }),
          { timeout: 20_000 },
        )
        .toBe(1)
        .then(() => true, () => false);
      if (restored) await waitAtlasReady(page);
      const meshesAfterRestore = await meshCount(page);
      const namesAfterRestore = await meshNames(page);
      const missing = namesBeforeLoss.filter((n) => !namesAfterRestore.includes(n));
      contextRow = {
        id: 'webgl-context-loss',
        status: lostSeen && restored && meshesAfterRestore === meshesBeforeLoss ? 'PASS' : 'FAIL',
        detail: `lostObserved=${lostSeen} restored=${restored} meshes ${meshesBeforeLoss}→${meshesAfterRestore}${missing.length ? ` missing=${missing.join(',')}` : ''}`,
      };
      await shot('Dornhain', 'after-context-restore', 'desktop');
    }
    rows.push(contextRow);

    // 5) Device matrix (same session, real recomposition).
    for (const vp of DEVICE_MATRIX) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500);
      const probe = await page.evaluate(() => {
        const ready = document.querySelector('[data-atlas-ready="true"]');
        const canvas = document.querySelector('[data-atlas-native-3d] canvas:not(.hidden)') as HTMLCanvasElement | null;
        const r = canvas?.getBoundingClientRect();
        return {
          ready: !!ready && (ready as HTMLElement).offsetParent !== null,
          canvasW: Math.round(r?.width ?? 0),
          canvasH: Math.round(r?.height ?? 0),
          overflowX: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      rows.push({
        id: `device-${vp.band}`,
        status: probe.ready && probe.canvasW >= 200 && probe.canvasH >= 200 && probe.overflowX <= 1 ? 'PASS' : 'FAIL',
        detail: `${vp.width}x${vp.height} ready=${probe.ready} canvas=${probe.canvasW}x${probe.canvasH} overflowX=${probe.overflowX}`,
      });
      await shot('Dornhain', 'default', vp.band);
    }
    rows.push({
      id: 'visual-screenshots',
      status: screenshots.length >= 10 ? 'PASS' : 'NOT_RUN',
      detail: `screenshots=${screenshots.length}`,
    });

    const rollup = rollupG05(rows);
    writeFileSync(
      join(EVIDENCE, 'browser-measurement.json'),
      `${JSON.stringify(
        {
          format: 'atl2-g05-browser-measurement-v1',
          issue: 1233,
          buildSha: sha,
          at: new Date().toISOString(),
          renderer,
          measurementClass: renderer.kind === 'hardware-webgl' ? 'hardware' : 'software-rendering (not a GPU product measurement)',
          budgetMs,
          frameBudget: frameBudgetEnforced ? 'enforced' : 'informational (software WebGL)',
          userAgent: await page.evaluate(() => navigator.userAgent),
          frames,
          cameras: cameraResults,
          rows,
          rollup,
          screenshots,
        },
        null,
        2,
      )}\n`,
    );
    expect(rows.filter((r) => r.status === 'FAIL'), JSON.stringify(rows, null, 2)).toEqual([]);
    // Only js-heap may be NOT_RUN (performance.memory is Chromium-only); everything else must PASS.
    expect(
      rows.filter((r) => r.status !== 'PASS' && r.id !== 'js-heap-soak' && !(r.status === 'INFO' && r.id.startsWith('frame-times-'))),
      JSON.stringify(rows, null, 2),
    ).toEqual([]);
  });

  /*
   * G05 finding (#1233): every 3D edit rebuilt the runtime (doc identity → remount) and wiped
   * Undo/Redo. Edit → wait past autosave debounce → undo → redo must work on the SAME runtime.
   * Atlas writes are held (never reach the DB) so Golden maps stay pristine for other specs.
   */
  test('browser-host: 3D edit → undo → redo survives runtime rebuild triggers', async ({ page }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
    test.setTimeout(240_000);
    const held: Array<{ abort: () => Promise<void> }> = [];
    try {
      await page.setViewportSize({ width: 1280, height: 800 });
      await openDornhainAtlas3d(page);
      // Hold atlas map writes (PUT/DELETE) only after load — ensure-root (POST) must pass.
      await page.route(
        (url) => /\/api\/v1\/worlds\/[^/]+\/atlas\/maps(\/|$)/.test(url.pathname),
        async (route) => {
          const method = route.request().method();
          if (method !== 'PUT' && method !== 'DELETE') {
            await route.continue();
            return;
          }
          held.push({ abort: () => route.abort().catch(() => undefined) });
        },
      );
      for (const title of SCENES[1].drill) await focusNavTitle(page, title);
      await page.evaluate(() => {
        const root = document.querySelector<HTMLElement>('[data-atlas-native-3d-host] > *');
        if (root) root.dataset.g05UndoProbe = 'mount-1';
      });
      const before = await bridgeState(page);
      const props0 = Number(before?.props ?? 0);
      expect(before?.undoDepth ?? 0, 'fresh map has no undo history').toBe(0);

      const toolsFold = page.locator('[data-atlas-native-3d-host] [data-atlas-panel-fold="tools"]').first();
      if ((await toolsFold.getAttribute('aria-expanded')) !== 'true') await toolsFold.click();
      await page.locator('[data-atlas-native-3d-host] [data-tool="stamp"]').first().click();
      await toolsFold.click();
      const stage = page.locator('[data-atlas-native-3d-host] #stage').first();
      const box = await stage.boundingBox();
      expect(box, 'stage visible').toBeTruthy();
      if (!box) return;
      await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.55);
      await expect.poll(async () => Number((await bridgeState(page))?.props ?? 0)).toBe(props0 + 1);
      // Past ATLAS_AUTOSAVE_DEBOUNCE_MS (1.2 s): persist → doc change used to remount here.
      await page.waitForTimeout(2_500);
      const afterEdit = await bridgeState(page);
      expect(afterEdit?.undoDepth, 'edit recorded in undo history after persist').toBe(1);
      const sameRuntime = await page.evaluate(
        () =>
          document.querySelector<HTMLElement>('[data-atlas-native-3d-host] > *')?.dataset.g05UndoProbe ?? null,
      );
      expect(sameRuntime, 'plain edit does not remount the 3D runtime').toBe('mount-1');

      const root = page.locator('[data-atlas-native-3d-host] > *').first();
      await root.focus();
      await page.keyboard.press('Control+z');
      await expect.poll(async () => Number((await bridgeState(page))?.props ?? -1)).toBe(props0);
      await page.waitForTimeout(1_500);
      const afterUndo = await bridgeState(page);
      expect(afterUndo?.redoDepth, 'redo available after undo + persist').toBe(1);

      await root.focus();
      await page.keyboard.press('Control+Shift+z');
      await expect.poll(async () => Number((await bridgeState(page))?.props ?? -1)).toBe(props0 + 1);
      const afterRedo = await bridgeState(page);
      expect(afterRedo?.undoDepth).toBe(1);
      expect(afterRedo?.redoDepth).toBe(0);
      // Leave the scene as found (local only; writes are held).
      await root.focus();
      await page.keyboard.press('Control+z');
      await expect.poll(async () => Number((await bridgeState(page))?.props ?? -1)).toBe(props0);
    } finally {
      // Close the page while atlas writes are still held: aborting them first let the
      // product's persist retry reach the DB and leak the stamp into the Golden Dornhain
      // map (seen by ATL3-V01's stored-fingerprint check, which runs after this spec).
      await page.close().catch(() => undefined);
      for (const h of held) await h.abort();
    }
  });
});
