/**
 * atl3-r01b-three-poc — ATL3-R01B (#1296) isolated Three.js PoC vs productive custom WebGL.
 * Location: e2e/atl3-r01b-three-poc.spec.ts
 *
 * Read-only research evidence for the GO/NO-GO ADR (ADR-ST-11):
 *  - same STORED Golden data (Dornhain block heightfield + Dungeon-Forge Krypta) fetched from the
 *    real host API, fingerprint-checked against the ATL3-V01 contract;
 *  - same cameras: every desktop high/balanced capture of the committed V01 baseline is re-rendered
 *    by the PoC at the exact recorded camera snapshot and canvas size (A/B pairs);
 *  - metrics: cold load, texture decode, shader compile, first frame, rAF p50/p95, draw calls,
 *    triangles, JS heap, context loss/restore, 2D↔3D id parity, raycast picking;
 *  - edit path: a real 2D stamp edit in the product (autosave PUT held → no DB write) is fed to the
 *    PoC and must appear with the same canonical id.
 * The PoC is bundled at test time (esbuild IIFE) into a blank page — never product-mounted.
 * SwiftShader numbers are informational only (no hardware perf claims).
 */
import { expect, test, type Page, type Route } from '@playwright/test';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createJiti } from 'jiti';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { atlasWorldId, focusAtlasNavTitle, openDornhainAtlas3d, waitAtlas3dReady } from './helpers/atlas-host';
// Type-only imports: also bring the harness `window.__r01bThreePoc` declaration into scope (no runtime import).
import type {} from '../src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-harness';
import type { R01bPbrAtlas, R01bPbrTextureSet } from '../src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-runtime';
import type { R01bMapScale, R01bPbrKind } from '../src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-scene';

const root = process.cwd();
const HOST = process.env.SAGATREE_BROWSER_E2E_HOST === '1';
const jiti = createJiti(import.meta.url);
const CONTRACT = join(root, '.qa/fixtures/atl3-v01-visual-contract/golden-scenes.json');
const V01_BASELINE = join(root, '.qa/evidence/atl3-v01-visual-contract/baseline');
const V8_REFERENCE = join(root, '.qa/research/atl3-r01b/atlas-v8-reference.html');
const HARNESS = join(root, 'src/infrastructure/world/atlas-r01b-three-poc/r01b-poc-harness.ts');
const RUN = join(root, '.qa/evidence/atl3-r01b-three-poc/run');
const FRAME_SAMPLES = 48;

type CameraId = 'ortho-topdown' | 'diorama-oblique' | 'perspective';
type Scene = { id: string; mapTitleDe: string; mapKind: string; navDrill: readonly string[]; dataFingerprint: string; lookFamily: 'outdoor' | 'indoor' };
type Contract = { scenes: readonly Scene[]; tolerances: { nonBlank: { minDistinctColors: number; minLumaStdDev: number } } };
type Snapshot = { mode: CameraId; x: number; z: number; span: number; yawRad: number; pitchRad: number };
type ImageMetrics = { width: number; height: number; lumaMean: number; lumaStdDev: number; distinctColors: number; edgeDensity: number; dominantColorShare: number };
type V01Capture = { file: string; profile: string; sceneId: string; camera: CameraId; zoomId: string; viewport: string; actual: Snapshot; meshes: number; triangles: number; metrics: ImageMetrics };
type V01Manifest = { captures: readonly V01Capture[]; perf: ReadonlyArray<{ sceneId: string; profile: string; p50: number; p95: number }> };
type StoredMap = { generatorMeta?: { seed?: unknown; unifiedCanvas?: Record<string, unknown> } };

const contract = JSON.parse(readFileSync(CONTRACT, 'utf8')) as Contract;

function buildSha(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short=10', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown000';
  }
}

/** Same canonical feature fingerprint as ATL3-V01 (parse → serialize → sorted-key JSON). */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
const unifiedDoc = jiti(join(root, 'src/domains/world/atlas/unified-canvas-doc.ts')) as {
  parseUnifiedCanvasDoc: (raw: unknown) => Record<string, unknown> | null;
  serializeUnifiedCanvasDoc: (doc: Record<string, unknown>) => Record<string, unknown>;
};
function featureFingerprint(rawDoc: Record<string, unknown>): string {
  const parsed = unifiedDoc.parseUnifiedCanvasDoc(rawDoc);
  if (!parsed) return 'unparseable';
  const doc = unifiedDoc.serializeUnifiedCanvasDoc(parsed);
  const pick = { rooms: doc.rooms ?? [], walls: doc.walls ?? [], doors: doc.doors ?? [], objects: doc.objects ?? [], strokes: doc.strokes ?? [], heightfield: doc.heightfield ?? null };
  return createHash('sha256').update(canonicalJson(pick)).digest('hex').slice(0, 16);
}

function docIds(raw: Record<string, unknown>): string[] {
  const ids: string[] = [];
  for (const k of ['rooms', 'strokes', 'walls', 'doors', 'objects']) {
    const list = raw[k];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') ids.push(item.id);
    }
  }
  return ids.sort();
}

function pct(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] * 10) / 10;
}

function textureSet(v: unknown, kind: R01bPbrKind): R01bPbrTextureSet {
  if (v && typeof v === 'object' && 'map' in v && 'normal' in v && 'rough' in v
    && typeof v.map === 'string' && typeof v.normal === 'string' && typeof v.rough === 'string') {
    return { map: v.map, normal: v.normal, rough: v.rough };
  }
  throw new Error(`V8 pbrAtlas: ${kind} incomplete`);
}

/** Strictly parse V8's embedded `pbrAtlas` JSON (10 kinds × map/normal/rough data URLs). */
function parseV8Atlas(raw: unknown): R01bPbrAtlas {
  const rec = new Map<string, unknown>(raw && typeof raw === 'object' ? Object.entries(raw) : []);
  const get = (k: R01bPbrKind): R01bPbrTextureSet => textureSet(rec.get(k), k);
  return {
    grass: get('grass'), dirt: get('dirt'), moss: get('moss'), rock: get('rock'), wall: get('wall'),
    wood: get('wood'), roof: get('roof'), cobble: get('cobble'), plaster: get('plaster'), gravel: get('gravel'),
  };
}

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`${what} missing`);
  return value;
}

/** ATL3-V01 image metrics (same algorithm) so custom vs PoC numbers are comparable. */
async function imageMetrics(page: Page, png: Buffer): Promise<ImageMetrics> {
  return page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
    const bmp = await createImageBitmap(blob);
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.drawImage(bmp, 0, 0);
    const { width, height, data } = ctx.getImageData(0, 0, bmp.width, bmp.height);
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
        if (Math.hypot(luma[i + 1] - luma[i - 1], luma[i + width] - luma[i - width]) > 24) edges += 1;
      }
    }
    let dominant = 0;
    colors.forEach((v) => { if (v > dominant) dominant = v; });
    return {
      width, height,
      lumaMean: Math.round(mean * 100) / 100,
      lumaStdDev: Math.round(Math.sqrt(varSum / n) * 100) / 100,
      distinctColors: colors.size,
      edgeDensity: Math.round((edges / n) * 10000) / 10000,
      dominantColorShare: Math.round((dominant / n) * 10000) / 10000,
    };
  }, png.toString('base64'));
}

async function toSurface(page: Page, mode: '2d' | '3d'): Promise<void> {
  const target = page.locator(`[data-atlas-surface-mode="${mode}"]`).first();
  await expect(page.locator('[data-atlas-surface-mode="2d"], [data-atlas-surface-mode="3d"]').first()).toBeVisible({ timeout: 60_000 });
  await expect
    .poll(async () => {
      if ((await target.count()) > 0) return 1;
      await page.locator('[data-atlas-surface-toggle]').first().click();
      await page.waitForTimeout(1_000);
      return (await target.count()) > 0 ? 1 : 0;
    }, { timeout: 60_000, intervals: [500, 2_000, 4_000] })
    .toBe(1);
  if (mode === '3d') await waitAtlas3dReady(page);
}

test.describe('ATL3-R01B Three.js PoC vs custom WebGL (#1296)', () => {
  test.describe.configure({ mode: 'serial' });

  test('browser-host: Three PoC on stored Golden Dornhain + Krypta — A/B, metrics, id parity, edit path', async ({ page, context }) => {
    test.skip(!HOST, 'requires browser-e2e-with-host');
    test.setTimeout(600_000);
    expect(existsSync(V8_REFERENCE), 'V8 reference copied into .qa/research').toBeTruthy();
    const manifest = JSON.parse(readFileSync(join(V01_BASELINE, 'capture-manifest.json'), 'utf8')) as V01Manifest;
    mkdirSync(RUN, { recursive: true });

    // 1) Stored data (host API) — identical to what the productive renderer draws.
    await page.setViewportSize({ width: 1280, height: 800 });
    await openDornhainAtlas3d(page);
    const origin = new URL(page.url()).origin;
    const worldId = await atlasWorldId(page);
    const mapsRes = await page.request.get(`/api/v1/worlds/${worldId}/atlas/maps`, { headers: { Origin: origin } });
    expect(mapsRes.ok()).toBeTruthy();
    const maps = ((await mapsRes.json()) as { maps?: Array<{ id: string; title: string }> }).maps ?? [];
    const docs = new Map<string, { mapId: string; raw: Record<string, unknown>; fingerprint: string }>();
    for (const scene of contract.scenes) {
      const mapId = must(maps.find((m) => m.title === scene.mapTitleDe), `stored map ${scene.mapTitleDe}`).id;
      const res = await page.request.get(`/api/v1/worlds/atlas/maps/${mapId}`, { headers: { Origin: origin } });
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as { map?: StoredMap } & StoredMap;
      const raw = must((body.map ?? body).generatorMeta?.unifiedCanvas, `${scene.id} unifiedCanvas`);
      const fingerprint = featureFingerprint(raw);
      expect(fingerprint, `${scene.id} stored data == V01 contract`).toBe(scene.dataFingerprint);
      docs.set(scene.id, { mapId, raw, fingerprint });
    }

    // 2) PoC page: esbuild IIFE of the harness + V8 PBR atlas, blank page (no product chrome/switch).
    const bundle = await build({ entryPoints: [HARNESS], bundle: true, write: false, format: 'iife', target: 'es2020', logLevel: 'silent' });
    const atlasMatch = readFileSync(V8_REFERENCE, 'utf8').match(/<script type="application\/json" id="pbrAtlas">([\s\S]*?)<\/script>/);
    const atlas = parseV8Atlas(JSON.parse(must(atlasMatch?.[1], 'V8 pbrAtlas')));
    const pocPage = await context.newPage();
    const errors: string[] = [];
    pocPage.on('pageerror', (e) => errors.push(e.message));
    await pocPage.setViewportSize({ width: 1280, height: 800 });
    await pocPage.setContent('<!doctype html><html><body style="margin:0;background:#000"><canvas id="r01b" style="display:block"></canvas></body></html>');
    await pocPage.addScriptTag({ content: bundle.outputFiles[0].text });
    const unmasked = await pocPage.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
      return gl && dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown';
    });
    const software = /swiftshader|llvmpipe|softpipe|software/i.test(unmasked);

    const results = {
      format: 'atl3-r01b-three-poc-v1', issue: 1296, buildSha: buildSha(), at: new Date().toISOString(),
      renderer: { unmasked, kind: software ? 'software-webgl' : 'hardware-webgl', three: 'three@0.186.1 (repo dependency)' },
      measurementClass: software ? 'software-webgl (SwiftShader): informational only — no hardware perf / quality claim' : 'hardware-webgl',
      storedData: [...docs].map(([sceneId, d]) => ({ sceneId, mapId: d.mapId, fingerprint: d.fingerprint })),
      load: [] as Array<Record<string, number | string>>,
      captures: [] as Array<Record<string, unknown>>,
      perf: [] as Array<Record<string, number | string>>,
      idParity: [] as Array<Record<string, unknown>>,
      picking: [] as Array<Record<string, unknown>>,
      contextLoss: [] as Array<Record<string, unknown>>,
      heapMb: {} as Record<string, number | null>,
      editPath: {} as Record<string, unknown>,
      loadError: {} as Record<string, unknown>,
      fallback: {
        lite: 'AtlasLite3D Canvas2D projection stays (Three.js has no Canvas2D path); PoC mirrors only WebGL profiles high/balanced',
        webglInitFailure: 'unchanged product path: AtlasNative3dEditor falls back to AtlasLite3D',
      },
    };

    // Every V01 WebGL capture (desktop all cameras/zooms + tablet/phone diorama Z0); lite stays AtlasLite3D.
    const mirrored = manifest.captures.filter((c) => c.profile === 'high' || c.profile === 'balanced');
    expect(mirrored.filter((c) => c.viewport === 'desktop').length, 'V01 desktop high/balanced captures to mirror').toBeGreaterThanOrEqual(20);
    for (const profile of ['high', 'balanced'] as const) {
      const cold = await pocPage.evaluate(async ({ q, a }) => {
        const api = window.__r01bThreePoc;
        if (!api) throw new Error('harness missing');
        const c = document.getElementById('r01b');
        if (c instanceof HTMLCanvasElement) { c.style.width = '992px'; c.style.height = '600px'; }
        return api.create({ canvasId: 'r01b', quality: q, atlas: a });
      }, { q: profile, a: atlas });
      if (profile === 'high') {
        const le = await pocPage.evaluate((a) => window.__r01bThreePoc?.loadErrorProbe(a) ?? null, atlas);
        results.loadError = { ...must(le, 'load error probe'), ms: Math.round(must(le, 'probe').ms) };
        expect(le?.rejected, 'corrupt PBR texture rejects (no hang / partial scene)').toBeTruthy();
      }
      for (const scene of contract.scenes) {
        const d = must(docs.get(scene.id), scene.id);
        const mapScale: R01bMapScale = scene.mapKind === 'settlement' ? 'settlement' : 'interior';
        const rows = mirrored.filter((c) => c.profile === profile && c.sceneId === scene.id);
        expect(rows.length, `${scene.id}/${profile} V01 rows`).toBeGreaterThan(0);
        const set = await pocPage.evaluate(({ raw, s, l }) => window.__r01bThreePoc?.setDoc(raw, s, l) ?? null, { raw: d.raw, s: mapScale, l: scene.lookFamily });
        expect(set?.ok, `${scene.id} doc parsed by domain parser`).toBeTruthy();
        let first = true;
        for (const row of rows) {
          await pocPage.evaluate(({ w, h }) => {
            const c = document.getElementById('r01b');
            if (c instanceof HTMLCanvasElement) { c.style.width = `${w}px`; c.style.height = `${h}px`; }
          }, { w: row.metrics.width, h: row.metrics.height });
          const view = row.actual;
          if (first) {
            const f = await pocPage.evaluate((v) => window.__r01bThreePoc?.first(v) ?? null, view);
            results.load.push({ profile, sceneId: scene.id, coldLoadMs: Math.round(cold.coldLoadMs), textureDecodeMs: Math.round(cold.textureDecodeMs), ...(f ? { shaderCompileMs: Math.round(f.shaderCompileMs * 10) / 10, firstFrameMs: Math.round(f.firstFrameMs), sceneBuildMs: Math.round(f.sceneBuildMs * 10) / 10 } : {}) });
            first = false;
          }
          const info = must(await pocPage.evaluate((v) => window.__r01bThreePoc?.render(v) ?? null, view), 'render info');
          const file = `r01b__${scene.id}__${row.camera}__${row.zoomId}__${profile}-three-poc__${row.viewport}.png`;
          const png = await pocPage.locator('#r01b').screenshot({ path: join(RUN, file), animations: 'disabled' });
          const metrics = await imageMetrics(pocPage, png);
          expect(metrics.distinctColors, `${file} non-blank`).toBeGreaterThanOrEqual(contract.tolerances.nonBlank.minDistinctColors);
          expect(metrics.lumaStdDev, `${file} non-blank`).toBeGreaterThanOrEqual(contract.tolerances.nonBlank.minLumaStdDev);
          results.captures.push({
            file, sceneId: scene.id, camera: row.camera, zoomId: row.zoomId, profile, viewport: row.viewport, view,
            customFile: row.file, three: info, metrics,
            custom: { meshes: row.meshes, triangles: row.triangles, metrics: row.metrics },
          });
        }
        // rAF cadence on the Z1 diorama view (same view family as V01 perf sampling).
        const desktopRows = rows.filter((r) => r.viewport === 'desktop');
        const perfRow = desktopRows.find((r) => r.camera === 'diorama-oblique' && r.zoomId.startsWith('z1')) ?? desktopRows[0] ?? rows[0];
        const fr = must(await pocPage.evaluate(({ v, n }) => window.__r01bThreePoc?.frames(v, n) ?? null, { v: perfRow.actual, n: FRAME_SAMPLES + 8 }), 'frames');
        const deltas = fr.deltas.slice(8);
        const custom = manifest.perf.find((p) => p.sceneId === scene.id && p.profile === profile);
        results.perf.push({ sceneId: scene.id, profile, p50: pct(deltas, 50), p95: pct(deltas, 95), customP50: custom?.p50 ?? -1, customP95: custom?.p95 ?? -1, budgetMode: software ? 'informational' : 'enforced' });

        if (profile === 'high') {
          // 2D↔3D id parity: every canonical id of the stored doc exists in the Three scene.
          const ids = must(await pocPage.evaluate(() => window.__r01bThreePoc?.ids() ?? null), 'ids');
          const want = docIds(d.raw);
          results.idParity.push({ sceneId: scene.id, docIds: want.length, pocIds: ids.length, equal: JSON.stringify(ids) === JSON.stringify(want) });
          expect(ids, `${scene.id} canonical ids rendered 1:1`).toEqual(want);
          // Picking parity: project each object centroid and raycast it back to the same id.
          const z0 = must(desktopRows.find((r) => r.zoomId.startsWith('z0') && r.camera === 'diorama-oblique') ?? desktopRows[0], 'z0 row');
          await pocPage.evaluate(({ w, h }) => {
            const c = document.getElementById('r01b');
            if (c instanceof HTMLCanvasElement) { c.style.width = `${w}px`; c.style.height = `${h}px`; }
          }, { w: z0.metrics.width, h: z0.metrics.height });
          await pocPage.evaluate((v) => window.__r01bThreePoc?.render(v), z0.actual);
          const objects = (Array.isArray(d.raw.objects) ? d.raw.objects : []).flatMap((o) => (o && typeof o === 'object' && 'id' in o && typeof o.id === 'string' ? [o.id] : []));
          const picks = await pocPage.evaluate((list) => {
            const api = window.__r01bThreePoc;
            if (!api) return [];
            return list.map((id) => {
              const c = api.centroidOf(id);
              if (!c) return { id, hit: null };
              const [px, py] = api.project(c[0], c[1], c[2]);
              return { id, hit: api.pick(px, py) };
            });
          }, objects);
          const hits = picks.filter((p) => p.hit === p.id).length;
          results.picking.push({ sceneId: scene.id, tried: picks.length, hits, picks });
          expect(hits, `${scene.id} raycast picks return canonical ids`).toBeGreaterThan(0);
          // Context loss → restore → re-render with the same scene.
          const ctx = must(await pocPage.evaluate((v) => window.__r01bThreePoc?.contextLossRoundTrip(v) ?? null, z0.actual), 'context loss');
          results.contextLoss.push({ sceneId: scene.id, ...ctx, restoreMs: Math.round(ctx.restoreMs) });
          expect(ctx.lost && ctx.restored, `${scene.id} context lost + restored`).toBeTruthy();
          expect(ctx.info.calls, `${scene.id} draws after restore`).toBeGreaterThan(0);
          const restoredPng = await pocPage.locator('#r01b').screenshot({ path: join(RUN, `r01b__${scene.id}__after-context-restore__high-three-poc__desktop.png`) });
          const restoredMetrics = await imageMetrics(pocPage, restoredPng);
          expect(restoredMetrics.distinctColors, `${scene.id} non-blank after restore`).toBeGreaterThanOrEqual(contract.tolerances.nonBlank.minDistinctColors);
          results.heapMb[scene.id] = await pocPage.evaluate(() => window.__r01bThreePoc?.heapMb() ?? null);
        }
      }
    }

    // 3) Edit path: real 2D stamp edit in the product → held autosave PUT → same id in the PoC.
    const dornhain = must(contract.scenes.find((s) => s.id === 'dornhain-block'), 'dornhain scene');
    const held: Route[] = [];
    let putBody: Record<string, unknown> | null = null;
    await page.route((url) => /\/api\/v1\/worlds\/[^/]+\/atlas\/maps(\/|$)/.test(url.pathname), async (route) => {
      const method = route.request().method();
      if (method !== 'PUT' && method !== 'DELETE') { await route.continue(); return; }
      const json: unknown = route.request().postDataJSON();
      if (json && typeof json === 'object' && 'mapId' in json && json.mapId === must(docs.get('dornhain-block'), 'dh').mapId) {
        putBody = json as Record<string, unknown>;
      }
      held.push(route);
    });
    try {
      // The product tab idled in the background while the PoC tab rendered (rAF throttled): foreground it.
      await page.bringToFront();
      await waitAtlas3dReady(page);
      for (const step of dornhain.navDrill) await focusAtlasNavTitle(page, step);
      await toSurface(page, '2d');
      await page.getByRole('button', { name: /Haus/ }).first().click();
      const vp = page.locator('[data-unified-atlas-viewport]').first();
      const box = must(await vp.boundingBox(), '2D viewport');
      await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.58);
      await expect.poll(() => (putBody ? 1 : 0), { timeout: 30_000, message: 'held autosave PUT for Dornhain' }).toBe(1);
      const body = must<Record<string, unknown>>(putBody, 'PUT body');
      const meta = body.generatorMeta;
      const edited = meta && typeof meta === 'object' && 'unifiedCanvas' in meta && meta.unifiedCanvas && typeof meta.unifiedCanvas === 'object'
        ? (meta.unifiedCanvas as Record<string, unknown>)
        : null;
      const editedDoc = must(edited, 'edited unifiedCanvas');
      const before = docIds(must(docs.get('dornhain-block'), 'dh').raw);
      const after = docIds(editedDoc);
      const added = after.filter((id) => !before.includes(id));
      expect(added, 'exactly one new canonical id from the 2D edit').toHaveLength(1);
      const newObj = (Array.isArray(editedDoc.objects) ? editedDoc.objects : []).find((o) => o && typeof o === 'object' && 'id' in o && o.id === added[0]);
      const pos = newObj && typeof newObj === 'object' && 'x' in newObj && 'y' in newObj && typeof newObj.x === 'number' && typeof newObj.y === 'number' ? { x: newObj.x, y: newObj.y } : null;
      const r = must(await pocPage.evaluate(({ raw, id }) => {
        const api = window.__r01bThreePoc;
        if (!api) return null;
        api.setDoc(raw, 'settlement', 'outdoor');
        api.render({ mode: 'diorama-oblique', x: 390, z: 470, span: 220.8, yawRad: 0.349, pitchRad: 1.05 });
        return { ids: api.ids(), centroid: api.centroidOf(id) };
      }, { raw: editedDoc, id: added[0] }), 'edit render');
      await pocPage.locator('#r01b').screenshot({ path: join(RUN, 'r01b__dornhain-block__edit-path__diorama-oblique__high-three-poc__desktop.png') });
      expect(r.ids, 'PoC ids == edited doc ids (no lost / invented objects)').toEqual(after);
      const c = must(r.centroid, 'new object geometry in the Three scene');
      const p = must(pos, 'new object position');
      const planar = Math.hypot(c[0] - p.x, c[2] - p.y);
      results.editPath = { addedId: added[0], doc: p, threeCentroid: c, planarOffset: Math.round(planar * 100) / 100, idsBefore: before.length, idsAfter: after.length, dbWrite: 'held (no write)' };
      expect(planar, 'new 3D object sits at its 2D position').toBeLessThan(40);
    } finally {
      // Close the product page while the PUT is still held so the Golden map is never written.
      await page.close().catch(() => undefined);
      for (const h of held) await h.abort().catch(() => undefined);
    }
    expect(errors, 'no page errors in the PoC').toEqual([]);
    writeFileSync(join(RUN, 'results.json'), `${JSON.stringify(results, null, 2)}\n`);
  });
});
