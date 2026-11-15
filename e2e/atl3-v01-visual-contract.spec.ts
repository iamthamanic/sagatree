/**
 * atl3-v01-visual-contract — Baseline capture for the ATL3 visual quality contract (#1295).
 * Location: e2e/atl3-v01-visual-contract.spec.ts
 *
 * Captures the CURRENT productive Custom-WebGL renderer on the stored Golden
 * Dornhain block and Krypta maps with the fixed cameras / zoom levels /
 * viewports from `.qa/fixtures/atl3-v01-visual-contract/golden-scenes.json`.
 * It is the "Ist" half of the Soll/Ist matrix in
 * `.qa/design/atl3-procedural-fantasy-rendering.md` — not a quality PASS and
 * not a pixel-diff gate (G04 stays the regression gate). Fail-closed on:
 * stored data drift, camera not applied, blank capture, missing matrix rows.
 * Camera centre and zoom go through the product scale widget (#coords / #zoom);
 * mode and yaw through the public atlas bridge; the quality profile through the
 * product switch ([data-atlas-graphics-preset-select]) — no test hooks in the runtime.
 */
import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createJiti } from 'jiti';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureLoggedIn } from './helpers/auth';

const root = process.cwd();
const jiti = createJiti(import.meta.url, { esmResolve: true });
const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';
const CONTRACT_PATH = join(root, '.qa/fixtures/atl3-v01-visual-contract/golden-scenes.json');
const SELF_TEST = join(root, 'scripts/atl3-v01-visual-contract.self-test.mjs');
/** Fresh run output (gitignored); the committed reference set lives in `baseline/`. */
const EVIDENCE = join(root, '.qa/evidence/atl3-v01-visual-contract/run');
const FRAME_SAMPLES = 48;
const WARMUP_FRAMES = 8;

type Vec2 = readonly [number, number];
type ZoomLevel = { id: string; labelDe: string; zoomPercent: number; center: Vec2 };
type SceneSpec = {
  id: string;
  mapSeedKey: string;
  mapTitleDe: string;
  navDrill: readonly string[];
  dataFingerprint: string;
  zoomLevels: readonly ZoomLevel[];
};
type CameraSpec = { id: 'ortho-topdown' | 'diorama-oblique' | 'perspective'; yawDeg: number; pitchRad: number };
type ViewportSpec = { id: 'desktop' | 'tablet' | 'phone'; width: number; height: number; matrix: string };
type ProfileId = 'high' | 'balanced' | 'lite';
/** One capture block: quality profile × viewport × cameras × zoom levels (zoomIds 'all' or id prefixes). */
type ProfileRow = { profile: ProfileId; viewport: ViewportSpec['id']; cameras: readonly CameraSpec['id'][]; zoomIds: 'all' | readonly string[] };
type Contract = {
  format: string;
  starterSlug: string;
  zoomSpanBase: number;
  scenes: readonly SceneSpec[];
  cameras: readonly CameraSpec[];
  viewports: readonly ViewportSpec[];
  tolerances: {
    cameraCenterUnits: number;
    spanRelative: number;
    yawDeg: number;
    repeatCapture: { maxChannelDelta: number; maxDiffPixelRatio: number };
    baselineDrift: { maxChannelDelta: number; maxDiffPixelRatio: number };
    nonBlank: { minDistinctColors: number; minLumaStdDev: number };
  };
  screenshotNameRegex: string;
  ciSoftwareCeiling: { frameP95Ms: number };
  profileMatrix: readonly ProfileRow[];
  qualitySwitch: { default: ProfileId };
};
type CameraSnapshot = { mode: string; x: number; z: number; span: number; yawRad: number; pitchRad: number };
type AtlasState = { mode: string; geometry?: Array<{ name: string; triangles: number }> };
type AtlasBridge = {
  getState: () => AtlasState;
  getCameraState: () => CameraSnapshot;
  setCameraMode: (mode: string, opts?: { animate?: boolean }) => void;
  setYaw: (deg: number) => void;
};

declare global {
  interface Window {
    /** Public prototype-runtime bridge (atlas-prototype-runtime.mjs): camera mode, yaw, state snapshots. */
    __sagatreeAtlas?: AtlasBridge;
  }
}
type RendererKind = 'hardware-webgl' | 'software-webgl' | 'lite3d-fallback' | 'unknown';
type ImageMetrics = { width: number; height: number; lumaMean: number; lumaStdDev: number; distinctColors: number; edgeDensity: number; dominantColorShare: number };
type CaptureRow = {
  file: string;
  profile: ProfileId;
  sceneId: string;
  mapId: string;
  camera: string;
  zoomId: string;
  viewport: string;
  target: { x: number; z: number; span: number; yawDeg: number };
  actual: CameraSnapshot;
  meshes: number;
  triangles: number;
  metrics: ImageMetrics;
};

const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8')) as Contract;
const nameRe = new RegExp(contract.screenshotNameRegex);

function buildSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short=10', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown000';
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Same canonical feature fingerprint as the self-test (sorted keys, feature arrays only). */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
const unifiedDoc = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts')) as {
  parseUnifiedCanvasDoc: (raw: unknown) => Record<string, unknown> | null;
  serializeUnifiedCanvasDoc: (doc: Record<string, unknown>) => Record<string, unknown>;
};
/** Same canonical form as the self-test: product parse → serialize (no-op re-persist is not drift). */
function featureFingerprint(rawDoc: Record<string, unknown>): string {
  const parsed = unifiedDoc.parseUnifiedCanvasDoc(rawDoc);
  if (!parsed) return 'unparseable';
  const doc = unifiedDoc.serializeUnifiedCanvasDoc(parsed);
  const pick = {
    rooms: doc.rooms ?? [],
    walls: doc.walls ?? [],
    doors: doc.doors ?? [],
    objects: doc.objects ?? [],
    strokes: doc.strokes ?? [],
    heightfield: doc.heightfield ?? null,
  };
  return createHash('sha256').update(canonicalJson(pick)).digest('hex').slice(0, 16);
}

function bridge(page: Page) {
  return {
    state: () =>
      page.evaluate(() => window.__sagatreeAtlas?.getState() ?? null),
    camera: () =>
      page.evaluate(
        () => window.__sagatreeAtlas?.getCameraState() ?? null,
      ),
  };
}

/** Narrow nullable values with a descriptive failure instead of a non-null assertion. */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`${what} missing`);
  return value;
}

async function waitAtlasReady(page: Page): Promise<void> {
  await expect(page.locator('[data-atlas-ready="true"]').first()).toBeVisible({ timeout: 90_000 });
  await expect.poll(async () => (await bridge(page).state())?.mode ?? 'missing', { timeout: 60_000 }).toBe('webgl');
  await expect(page.getByText('Kartenwechsel läuft')).toHaveCount(0, { timeout: 30_000 });
}

async function openDornhainAtlas3d(page: Page): Promise<{ worldId: string; origin: string }> {
  await ensureLoggedIn(page);
  const origin = new URL(page.url()).origin;
  const ensure = await page.request.post('/api/v1/projects/ensure-starter', {
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    data: { slug: contract.starterSlug },
  });
  expect(ensure.ok(), await ensure.text()).toBeTruthy();
  const worlds = await page.request.get('/api/v1/library/worlds', { headers: { Origin: origin } });
  const body = (await worlds.json()) as { worlds?: Array<{ id: string; title?: string; publicId?: string }> };
  const dornhain = (body.worlds ?? []).find((w) => w.title === 'Dornhain');
  expect(dornhain?.publicId).toBeTruthy();
  if (!dornhain?.publicId) throw new Error('Dornhain starter world missing');
  await page.goto(`/library/worlds/${dornhain.publicId}/map`);
  await expect(page.locator('[data-world-atlas-workbench]').first()).toBeVisible({ timeout: 45_000 });
  const mode3d = page.locator('[data-atlas-surface-mode="3d"]').first();
  const mode2d = page.locator('[data-atlas-surface-mode="2d"]').first();
  await expect(mode3d.or(mode2d)).toBeVisible({ timeout: 60_000 });
  if ((await mode3d.count()) === 0) await page.locator('[data-atlas-surface-toggle]').first().click();
  await expect(mode3d).toBeVisible({ timeout: 60_000 });
  await waitAtlasReady(page);
  return { worldId: dornhain.id, origin };
}

/** Programmatic `.nav-focus` click on the DB WorldNode tree (same path as G04/G05). */
async function focusNavTitle(page: Page, title: string): Promise<void> {
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
          const rows = [...document.querySelectorAll<HTMLElement>('[data-atlas-nav-source="db"] .nav-focus')];
          const hit = rows.find((r) => (r.querySelector('strong.nav-edit')?.textContent ?? '').trim() === want);
          return hit?.getAttribute('data-focus') ?? null;
        }, title);
        return focusId ? 1 : 0;
      },
      { timeout: 20_000 },
    )
    .toBe(1);
  await page.waitForTimeout(250);
  if ((await page.locator('[data-atlas-nav-source="db"] input[type="text"]').count()) > 0) {
    await page.keyboard.press('Escape');
  }
  await page.evaluate((id) => {
    document.querySelector<HTMLElement>(`[data-atlas-nav-source="db"] .nav-focus[data-focus="${id}"]`)?.click();
  }, focusId ?? '');
  await waitAtlasReady(page);
  await expect
    .poll(async () => ((await page.locator('nav[aria-label="Kartennavigation"]').innerText()).includes(title) ? 1 : 0), {
      timeout: 20_000,
    })
    .toBe(1);
}

async function openScene(page: Page, scene: SceneSpec): Promise<void> {
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-atlas-nav-source="db"] .nav-focus[data-nav-kind="world"]')?.click();
  });
  await waitAtlasReady(page);
  for (const step of scene.navDrill) await focusNavTitle(page, step);
}

async function detectRenderer(page: Page): Promise<{ kind: RendererKind; unmasked: string; preset: string }> {
  return page.evaluate(() => {
    const host = document.querySelector('[data-atlas-native-3d-host]');
    const preset = host?.getAttribute('data-atlas-graphics-preset') ?? 'unknown';
    if (host?.getAttribute('data-atlas-graphics-fallback')) return { kind: 'lite3d-fallback' as const, unmasked: '', preset };
    const canvas = host?.querySelector('canvas:not(.hidden)') as HTMLCanvasElement | null;
    const gl = canvas?.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return { kind: 'unknown' as const, unmasked: '', preset };
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const unmasked = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '') : '';
    const software = /swiftshader|llvmpipe|softpipe|software/i.test(unmasked);
    return { kind: software ? ('software-webgl' as const) : ('hardware-webgl' as const), unmasked, preset };
  });
}

/** Type into a product scale-widget field (#coords / #zoom) and commit with Enter. */
async function typeScaleField(page: Page, id: 'coords' | 'zoom', value: string): Promise<void> {
  // DOM click: on tablet/phone the Dungeon-Forge sheet can overlap the scale widget.
  await page.evaluate((fieldId) => document.getElementById(fieldId)?.click(), id);
  const input = page.locator('input.scale-edit-input').first();
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.fill(value);
  await input.press('Enter');
  await expect(page.locator('input.scale-edit-input')).toHaveCount(0);
}

async function applyCamera(page: Page, cam: CameraSpec, zoom: ZoomLevel): Promise<{ x: number; z: number; span: number; yawDeg: number }> {
  const target = { x: zoom.center[0], z: zoom.center[1], span: (contract.zoomSpanBase * 100) / zoom.zoomPercent, yawDeg: cam.yawDeg };
  const setModeYaw = () =>
    page.evaluate(
      ({ mode, yaw }) => {
        const b = window.__sagatreeAtlas;
        if (!b) throw new Error('__sagatreeAtlas missing');
        b.setCameraMode(mode, { animate: false });
        b.setYaw(yaw);
      },
      { mode: cam.id, yaw: cam.yawDeg },
    );
  const tol = contract.tolerances;
  const check = async () => {
    const c = await bridge(page).camera();
    if (!c) return { ok: false, detail: 'missing', modeYawOk: false };
    const yawDeg = (((c.yawRad * 180) / Math.PI) % 360 + 360) % 360;
    const modeYawOk =
      c.mode === cam.id && Math.abs(yawDeg - target.yawDeg) <= tol.yawDeg && Math.abs(c.pitchRad - cam.pitchRad) <= 0.01;
    const ok =
      modeYawOk &&
      Math.abs(c.x - target.x) <= tol.cameraCenterUnits &&
      Math.abs(c.z - target.z) <= tol.cameraCenterUnits &&
      Math.abs(c.span - target.span) / target.span <= tol.spanRelative;
    return { ok, detail: JSON.stringify(c), modeYawOk };
  };
  // Mode switches persist + may remount the controlled runtime; re-apply until the snapshot holds.
  let last = '';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await setModeYaw();
    await page.waitForTimeout(250);
    await waitAtlasReady(page);
    await typeScaleField(page, 'zoom', String(zoom.zoomPercent));
    await typeScaleField(page, 'coords', `${target.x} ${target.z}`);
    const r = await check();
    if (!r.modeYawOk) await setModeYaw();
    await page.waitForTimeout(250);
    const r2 = await check();
    last = r2.detail;
    if (r2.ok) break;
  }
  expect((await check()).ok, `camera applied for ${cam.id}/${zoom.id}: ${last}`).toBeTruthy();
  await page.waitForTimeout(600);
  return target;
}

/** Select a quality profile through the product switch and wait for the remounted runtime. */
async function selectProfile(page: Page, profile: ProfileId): Promise<void> {
  const select = page.locator('[data-atlas-graphics-preset-select]').first();
  await expect(select).toBeVisible({ timeout: 30_000 });
  if ((await select.inputValue()) !== profile) await select.selectOption(profile);
  await expect(page.locator('[data-atlas-native-3d-host]').first()).toHaveAttribute('data-atlas-graphics-preset', profile, {
    timeout: 60_000,
  });
  await waitAtlasReady(page);
}

/**
 * Hide HTML chrome over the WebGL stage (G04 selector set) via an injected
 * stylesheet, so overlays re-rendered after a controlled-runtime remount stay
 * hidden too. Canonical place labels are HTML (not renderer output) and are
 * judged separately (readability criteria), not in these canvas captures.
 */
const CHROME_SELECTORS = [
  '[data-atlas-dungeon-forge-3d]', '[data-atlas-dungeon-forge]', '[data-atlas-maps-rail]', '[data-atlas-tool-rail]',
  '[data-atlas-prototype-bar]', '.map-label', '.map-labels', '[data-map-pin]', '.hotspot', '.scale-widget',
  '.action-tools', '.mode-chip', '[data-atlas-map-pin]', '[data-unified-chrome]', '[data-atlas-surface-actions]',
  '[data-atlas-surface-bar]', '[data-atlas-missing-detail]', '.toast', '#notice', '#side', '#inspector',
  '[data-atlas-surface-toggle]', 'div:has(> [data-atlas-surface-toggle])', '[data-atlas-graphics-preset-select]',
];
async function hideChrome(page: Page, hide: boolean): Promise<void> {
  await page.evaluate(
    ({ on, css }) => {
      document.getElementById('v01-capture-hide')?.remove();
      if (!on) return;
      const style = document.createElement('style');
      style.id = 'v01-capture-hide';
      style.textContent = `${css} { visibility: hidden !important; }`;
      document.head.appendChild(style);
    },
    { on: hide, css: CHROME_SELECTORS.join(', ') },
  );
  await page.waitForTimeout(200);
}

/** Observable image metrics computed from the PNG itself (decoded in-page, no extra deps). */
async function imageMetrics(page: Page, png: Buffer, other?: Buffer): Promise<ImageMetrics & { diffRatio?: number; maxDelta?: number }> {
  return page.evaluate(
    async ({ a, b, maxChannelDelta }) => {
      const decode = async (b64: string) => {
        const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
        const bmp = await createImageBitmap(blob);
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('2d context unavailable');
        ctx.drawImage(bmp, 0, 0);
        return ctx.getImageData(0, 0, bmp.width, bmp.height);
      };
      const img = await decode(a);
      const { width, height, data } = img;
      const n = width * height;
      const luma = new Float32Array(n);
      const colors = new Map<number, number>();
      let sum = 0;
      for (let i = 0; i < n; i += 1) {
        const r = data[i * 4], g = data[i * 4 + 1], bl = data[i * 4 + 2];
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * bl;
        luma[i] = y;
        sum += y;
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (bl >> 3);
        colors.set(key, (colors.get(key) ?? 0) + 1);
      }
      const mean = sum / n;
      let varSum = 0;
      for (let i = 0; i < n; i += 1) varSum += (luma[i] - mean) ** 2;
      let edges = 0;
      for (let yy = 1; yy < height - 1; yy += 1) {
        for (let xx = 1; xx < width - 1; xx += 1) {
          const i = yy * width + xx;
          const gx = luma[i + 1] - luma[i - 1];
          const gy = luma[i + width] - luma[i - width];
          if (Math.hypot(gx, gy) > 24) edges += 1;
        }
      }
      let dominant = 0;
      colors.forEach((v) => { if (v > dominant) dominant = v; });
      const out: Record<string, number> = {
        width, height,
        lumaMean: Math.round(mean * 100) / 100,
        lumaStdDev: Math.round(Math.sqrt(varSum / n) * 100) / 100,
        distinctColors: colors.size,
        edgeDensity: Math.round((edges / n) * 10000) / 10000,
        dominantColorShare: Math.round((dominant / n) * 10000) / 10000,
      };
      if (b) {
        const other = await decode(b);
        let diff = 0, maxDelta = 0;
        if (other.width !== width || other.height !== height) { diff = n; maxDelta = 255; }
        else for (let i = 0; i < n; i += 1) {
          const d = Math.max(
            Math.abs(data[i * 4] - other.data[i * 4]),
            Math.abs(data[i * 4 + 1] - other.data[i * 4 + 1]),
            Math.abs(data[i * 4 + 2] - other.data[i * 4 + 2]),
          );
          if (d > maxDelta) maxDelta = d;
          if (d > maxChannelDelta) diff += 1;
        }
        out.diffRatio = Math.round((diff / n) * 10000) / 10000;
        out.maxDelta = maxDelta;
      }
      return out as ImageMetrics & { diffRatio?: number; maxDelta?: number };
    },
    { a: png.toString('base64'), b: other?.toString('base64') ?? null, maxChannelDelta: contract.tolerances.repeatCapture.maxChannelDelta },
  );
}

async function sampleFrames(page: Page): Promise<{ p50: number; p95: number }> {
  const frames = await page.evaluate(
    async ({ samples, warmup }) => {
      const b = window.__sagatreeAtlas;
      if (!b) throw new Error('__sagatreeAtlas missing');
      const start = ((b.getCameraState().yawRad * 180) / Math.PI + 360) % 360;
      const out: number[] = [];
      let last = performance.now();
      for (let i = 0; i < samples + warmup; i += 1) {
        b.setYaw(start + (i % 2 === 0 ? 0.25 : -0.25));
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        const now = performance.now();
        if (i >= warmup) out.push(now - last);
        last = now;
      }
      b.setYaw(start);
      return out;
    },
    { samples: FRAME_SAMPLES, warmup: WARMUP_FRAMES },
  );
  const sorted = [...frames].sort((x, y) => x - y);
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  return { p50: Math.round(pct(50) * 10) / 10, p95: Math.round(pct(95) * 10) / 10 };
}

test.describe('ATL3-V01 visual contract baseline (#1295)', () => {
  test('host protocol self-test PASS', () => {
    expect(existsSync(SELF_TEST)).toBeTruthy();
    const out = execFileSync(process.execPath, [SELF_TEST], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('atl3-v01-visual-contract self-test: PASS');
  });

  test('browser-host: Custom-WebGL baseline captures for Dornhain + Krypta', async ({ page }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
    test.setTimeout(900_000);
    rmSync(EVIDENCE, { recursive: true, force: true });
    mkdirSync(EVIDENCE, { recursive: true });
    const sha = buildSha();
    const viewportOf = (id: ViewportSpec['id']) => must(contract.viewports.find((v) => v.id === id), `${id} viewport`);
    const desktop = viewportOf('desktop');
    await page.setViewportSize({ width: desktop.width, height: desktop.height });
    const { worldId, origin } = await openDornhainAtlas3d(page);

    // 0) Quality switch is a product setting with the documented default (fresh device = no stored choice).
    const switchDefault = await page.locator('[data-atlas-graphics-preset-select]').first().inputValue();
    expect(switchDefault, 'quality switch default').toBe(contract.qualitySwitch.default);

    // 1) Stored map data == contract fingerprint (fixed stored data, not a test-only scene).
    const mapsRes = await page.request.get(`/api/v1/worlds/${worldId}/atlas/maps`, { headers: { Origin: origin } });
    expect(mapsRes.ok()).toBeTruthy();
    const maps = ((await mapsRes.json()) as { maps?: Array<{ id: string; title: string }> }).maps ?? [];
    const storedData: Array<{ sceneId: string; mapId: string; fingerprint: string; seed: unknown; heightfield: boolean; dungeon: unknown }> = [];
    for (const scene of contract.scenes) {
      const map = maps.find((m) => m.title === scene.mapTitleDe);
      expect(map, `stored map ${scene.mapTitleDe}`).toBeTruthy();
      const mapId = must(map, `stored map ${scene.mapTitleDe}`).id;
      const detail = await page.request.get(`/api/v1/worlds/atlas/maps/${mapId}`, { headers: { Origin: origin } });
      expect(detail.ok()).toBeTruthy();
      const raw = (await detail.json()) as { map?: Record<string, unknown> } & Record<string, unknown>;
      const vm = (raw.map ?? raw) as { generatorMeta?: { seed?: unknown; dungeon?: unknown; unifiedCanvas?: Record<string, unknown> } };
      expect(vm.generatorMeta?.seed, `${scene.id} seed`).toBe(scene.mapSeedKey);
      const fp = featureFingerprint(vm.generatorMeta?.unifiedCanvas ?? {});
      const uc = (vm.generatorMeta?.unifiedCanvas ?? {}) as Record<string, unknown>;
      const parts = ['rooms', 'walls', 'doors', 'objects', 'strokes', 'heightfield']
        .map((k) => `${k}=${Array.isArray(uc[k]) ? (uc[k] as unknown[]).length : uc[k] ? 'set' : 'none'}:${createHash('sha256').update(canonicalJson(uc[k] ?? null)).digest('hex').slice(0, 8)}`)
        .join(' ');
      expect(fp, `${scene.id} stored data fingerprint (${parts})`).toBe(scene.dataFingerprint);
      storedData.push({
        sceneId: scene.id, mapId, fingerprint: fp, seed: vm.generatorMeta?.seed,
        heightfield: Boolean(vm.generatorMeta?.unifiedCanvas?.heightfield), dungeon: vm.generatorMeta?.dungeon ?? null,
      });
    }
    const mapIdOf = (sceneId: string) => must(storedData.find((s) => s.sceneId === sceneId), `stored map for ${sceneId}`).mapId;

    const renderers: Partial<Record<ProfileId, Awaited<ReturnType<typeof detectRenderer>>>> = {};
    const captures: CaptureRow[] = [];
    const perf: Array<{ sceneId: string; profile: ProfileId; p50: number; p95: number; ceilingMs: number; rendererKind: RendererKind }> = [];
    const meshSets: Record<string, string[]> = {};
    const repeat: Array<{ file: string; diffRatio: number; maxDelta: number }> = [];
    const devices: Array<{ viewport: string; profile: ProfileId; sceneId: string; canvas: { w: number; h: number }; overflowX: number }> = [];

    const capture = async (scene: SceneSpec, cam: CameraSpec, zoom: ZoomLevel, viewport: ViewportSpec, profile: ProfileId) => {
      const renderer = must(renderers[profile], `renderer for ${profile}`);
      const target = await applyCamera(page, cam, zoom);
      const actual = must(await bridge(page).camera(), 'camera state');
      const st = must(await bridge(page).state(), 'atlas state');
      const geometry = st.geometry ?? [];
      await hideChrome(page, true);
      const canvas = page.locator('[data-atlas-native-3d-host] canvas:not(.hidden)').first();
      const png = await canvas.screenshot({ animations: 'disabled' });
      await hideChrome(page, false);
      const file = `v01__${scene.id}__map-${slug(mapIdOf(scene.id))}__${cam.id}__${zoom.id}__${sha}__${slug(renderer.preset)}-${renderer.kind}__${viewport.id}.png`;
      expect(file, 'screenshot name contract').toMatch(nameRe);
      expect(renderer.preset, `${file}: runtime preset`).toBe(profile);
      writeFileSync(join(EVIDENCE, file), png);
      const metrics = await imageMetrics(page, png);
      expect(metrics.distinctColors, `${file} not blank (colors)`).toBeGreaterThanOrEqual(contract.tolerances.nonBlank.minDistinctColors);
      expect(metrics.lumaStdDev, `${file} not blank (contrast)`).toBeGreaterThanOrEqual(contract.tolerances.nonBlank.minLumaStdDev);
      expect(geometry.length, `${file} meshes`).toBeGreaterThan(0);
      captures.push({
        file, profile, sceneId: scene.id, mapId: mapIdOf(scene.id), camera: cam.id, zoomId: zoom.id, viewport: viewport.id,
        target, actual, meshes: geometry.length,
        triangles: geometry.reduce((s, g) => s + (Number(g.triangles) || 0), 0), metrics,
      });
      meshSets[`${profile}|${viewport.id}|${scene.id}|${cam.id}|${zoom.id}`] = geometry.map((g) => g.name).sort();
      return png;
    };

    // 2) Capture blocks from the contract profile matrix (product quality switch, not a runtime hook).
    const zoomsFor = (scene: SceneSpec, row: ProfileRow) =>
      row.zoomIds === 'all' ? scene.zoomLevels : scene.zoomLevels.filter((z) => row.zoomIds !== 'all' && row.zoomIds.some((p) => z.id.startsWith(`${p}-`)));
    for (const row of contract.profileMatrix) {
      const viewport = viewportOf(row.viewport);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(400);
      await selectProfile(page, row.profile);
      renderers[row.profile] = await detectRenderer(page);
      const cams = contract.cameras.filter((c) => row.cameras.includes(c.id));
      for (const scene of contract.scenes) {
        await openScene(page, scene);
        const zooms = zoomsFor(scene, row);
        expect(zooms.length, `${row.profile}/${row.viewport}/${scene.id} zoom rows`).toBeGreaterThan(0);
        for (const cam of cams) {
          for (const zoom of zooms) {
            const png = await capture(scene, cam, zoom, viewport, row.profile);
            if (viewport.id === 'desktop' && cam.id === 'ortho-topdown' && zoom === zooms[0]) {
              // Reproducibility: same camera re-applied after a perspective round trip (per profile).
              await applyCamera(page, contract.cameras[2], scene.zoomLevels[2]);
              await applyCamera(page, cam, zoom);
              await hideChrome(page, true);
              const again = await page.locator('[data-atlas-native-3d-host] canvas:not(.hidden)').first().screenshot({ animations: 'disabled' });
              await hideChrome(page, false);
              mkdirSync(join(EVIDENCE, 'repeat'), { recursive: true });
              const repeatFile = must(captures.at(-1), 'last capture').file;
              writeFileSync(join(EVIDENCE, 'repeat', repeatFile), again);
              const m = await imageMetrics(page, png, again);
              repeat.push({ file: repeatFile, diffRatio: m.diffRatio ?? 1, maxDelta: m.maxDelta ?? 255 });
            }
          }
        }
        if (viewport.id === 'desktop') {
          await applyCamera(page, contract.cameras[1], zooms[0]);
          const f = await sampleFrames(page);
          perf.push({ sceneId: scene.id, profile: row.profile, ...f, ceilingMs: contract.ciSoftwareCeiling.frameP95Ms, rendererKind: renderers[row.profile]?.kind ?? 'unknown' });
        } else {
          const dims = await page.evaluate(() => {
            const c = document.querySelector('[data-atlas-native-3d-host] canvas:not(.hidden)') as HTMLCanvasElement | null;
            const r = c?.getBoundingClientRect();
            return { w: Math.round(r?.width ?? 0), h: Math.round(r?.height ?? 0), overflowX: document.documentElement.scrollWidth - window.innerWidth };
          });
          devices.push({ viewport: viewport.id, profile: row.profile, sceneId: scene.id, canvas: { w: dims.w, h: dims.h }, overflowX: dims.overflowX });
          expect(dims.w, `${viewport.id} canvas width`).toBeGreaterThanOrEqual(200);
          expect(dims.overflowX, `${viewport.id} horizontal overflow (AU-01)`).toBeLessThanOrEqual(1);
        }
      }
    }
    // Leave the device on the product default again.
    await page.setViewportSize({ width: desktop.width, height: desktop.height });
    await selectProfile(page, contract.qualitySwitch.default);

    // 3) Same scene graph across camera modes (no second scene per camera), per profile/viewport/zoom.
    const groups = new Map<string, string[]>();
    for (const [key, names] of Object.entries(meshSets)) {
      const [profile, viewport, sceneId, , zoomId] = key.split('|');
      const g = `${profile}|${viewport}|${sceneId}|${zoomId}`;
      groups.set(g, [...(groups.get(g) ?? []), JSON.stringify(names)]);
    }
    const sameSceneAcrossCameras = [...groups.values()].every((sets) => sets.every((x) => x === sets[0]));

    // 3b) Stale-matrix guard (Codex P2): output must still match the committed baseline the Soll/Ist matrix
    // was evaluated against. If the renderer changed (better or worse), fail until the baseline is re-captured
    // and the matrix re-evaluated (self-test pins matrixEvaluation.baselineDigest).
    const baselineDir = join(root, contract.baseline.dir);
    const normName = (f: string) => f.split('__').filter((_, i) => i !== 2 && i !== 5).join('__'); // drop map id + build sha
    const committed = new Map<string, string>();
    if (existsSync(baselineDir)) {
      for (const f of readdirSync(baselineDir)) if (f.endsWith('.png')) committed.set(normName(f), f);
    }
    const baselineDrift: Array<{ file: string; baseline: string | null; diffRatio: number }> = [];
    for (const c of captures) {
      const base = committed.get(normName(c.file)) ?? null;
      if (!base) {
        baselineDrift.push({ file: c.file, baseline: null, diffRatio: 1 });
        continue;
      }
      const m = await imageMetrics(page, readFileSync(join(EVIDENCE, c.file)), readFileSync(join(baselineDir, base)));
      const diffRatio = m.diffRatio ?? 1;
      if (diffRatio > contract.tolerances.baselineDrift.maxDiffPixelRatio) baselineDrift.push({ file: c.file, baseline: base, diffRatio });
    }
    const expectedTotal = contract.profileMatrix.reduce(
      (n, row) => n + contract.scenes.reduce((m, sc) => m + zoomsFor(sc, row).length * row.cameras.length, 0),
      0,
    );
    const byProfile = Object.fromEntries(
      (['high', 'balanced', 'lite'] as const).map((p) => [p, captures.filter((c) => c.profile === p).length]),
    );
    const balancedRenderer = must(renderers.balanced, 'balanced renderer');
    const manifest = {
      format: 'atl3-v01-baseline-capture-v2',
      issue: 1295,
      buildSha: sha,
      at: new Date().toISOString(),
      renderer: balancedRenderer,
      renderers,
      measurementClass:
        balancedRenderer.kind === 'hardware-webgl' ? 'hardware-webgl' : 'software-rendering (not a GPU product measurement)',
      contractFormat: contract.format,
      qualitySwitch: { default: switchDefault },
      storedData,
      captures,
      repeatCapture: repeat,
      perf,
      devices,
      sameSceneAcrossCameras,
      baselineDrift,
      counts: {
        desktop: captures.filter((c) => c.viewport === 'desktop' && c.profile === 'balanced').length,
        expectedDesktop: contract.scenes.reduce((s, sc) => s + sc.zoomLevels.length * contract.cameras.length, 0),
        byProfile,
        expectedTotal,
        total: captures.length,
      },
    };
    writeFileSync(join(EVIDENCE, 'capture-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    expect(manifest.counts.desktop).toBe(manifest.counts.expectedDesktop);
    expect(manifest.counts.total).toBe(expectedTotal);
    expect(sameSceneAcrossCameras, 'same mesh set across camera modes').toBeTruthy();
    expect(
      baselineDrift,
      'renderer output drifted from the committed V01 baseline: re-capture baseline/ and re-evaluate the Soll/Ist matrix (stale GAP/PARTIAL/MET)',
    ).toEqual([]);
    for (const r of repeat) {
      expect(r.diffRatio, `${r.file} repeat capture`).toBeLessThanOrEqual(contract.tolerances.repeatCapture.maxDiffPixelRatio);
    }
    for (const p of perf) {
      const budget = p.rendererKind === 'hardware-webgl' ? 33.3 : p.ceilingMs;
      expect(p.p95, `${p.sceneId}/${p.profile} frame p95 (${p.rendererKind})`).toBeLessThanOrEqual(budget);
    }
  });
});
