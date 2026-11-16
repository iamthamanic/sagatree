#!/usr/bin/env node
/**
 * atl3-r01b-capture-v8 — ATL3-R01B (#1296) reference captures of Ben's "Atlas V8" prototype.
 * Location: scripts/atl3-r01b-capture-v8.mjs
 *
 * Research tooling only (not a gate, not CI): opens the copied reference
 * `.qa/research/atl3-r01b/atlas-v8-reference.html` (three@0.160 from its CDN), sets
 * scene / yaw / tilt / zoom through V8's own localStorage snapshot, and captures the
 * Three.js viewport with the ATL3-V01 camera angles (yaw 20°, diorama 1.05 rad, perspective
 * 0.95 rad; V8 is orthographic only, so "perspective" = its ortho camera at 0.95 rad).
 * V8 content is hand-authored demo data (not the stored Golden maps) — it is the LOOK
 * reference, never a geometry/data reference.
 *
 * Usage: node scripts/atl3-r01b-capture-v8.mjs [outDir]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const out = resolve(process.argv[2] || join(root, '.qa/evidence/atl3-r01b-three-poc/run/v8'));
mkdirSync(out, { recursive: true });
const REF = pathToFileURL(join(root, '.qa/research/atl3-r01b/atlas-v8-reference.html')).href;
const SNAPKEY = 'sagatree-atlas-v8-editable-world';
const YAW = (20 * Math.PI) / 180;
const VIEWS = [
  { scene: 'city', camera: 'diorama-oblique', tiltDeg: (1.05 * 180) / Math.PI },
  { scene: 'city', camera: 'perspective', tiltDeg: (0.95 * 180) / Math.PI },
  { scene: 'crypt', camera: 'diorama-oblique', tiltDeg: (1.05 * 180) / Math.PI },
  { scene: 'crypt', camera: 'perspective', tiltDeg: (0.95 * 180) / Math.PI },
];

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const ready = async () => {
  await page.waitForFunction(() => /THREE\.JS/.test(document.getElementById('threeStatus')?.textContent ?? ''), null, { timeout: 30_000 });
  await page.waitForTimeout(1_500);
};
await page.goto(REF);
await ready();
// Persist a snapshot once (camera reset → saveLocal) so we can rewrite scene/yaw/tilt/zoom.
await page.evaluate(() => document.getElementById('cameraReset')?.click());
const rows = [];
for (const v of VIEWS) {
  const ok = await page.evaluate(({ key, v, yaw }) => {
    const raw = JSON.parse(localStorage.getItem(key) || 'null');
    if (!raw) return false;
    localStorage.setItem(key, JSON.stringify({ ...raw, scene: v.scene, yaw, tilt: v.tiltDeg, zoom: 1.04 }));
    return true;
  }, { key: SNAPKEY, v, yaw: YAW });
  if (!ok) throw new Error('V8 snapshot missing in localStorage');
  await page.reload();
  await ready();
  const file = `v8__${v.scene === 'city' ? 'dornhain-city' : 'krypta'}__${v.camera}__three-0.160-v8-reference__desktop.png`;
  const status = await page.locator('#threeStatus').textContent();
  await page.locator('#threeSurface').screenshot({ path: join(out, file) });
  const renderer = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    return gl && dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown';
  });
  rows.push({ file, ...v, yawDeg: 20, status, renderer });
  console.log('captured', file);
}
writeFileSync(join(out, 'v8-captures.json'), `${JSON.stringify({ format: 'atl3-r01b-v8-captures-v1', source: '.qa/research/atl3-r01b/atlas-v8-reference.html', rows }, null, 2)}\n`);
await browser.close();
