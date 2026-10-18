#!/usr/bin/env node
/**
 * unified-atlas-renderer-poc-check — run Hybrid vs Unified Three PoCs and write measured results.
 * Location: scripts/unified-atlas-renderer-poc-check.mjs
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = process.cwd();
const pocDir = join(root, '.qa/evidence/unified-atlas-renderer-poc');
const outJson = join(pocDir, 'results.json');
const shotDir = join(pocDir, 'screenshots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
};

function mustInclude(rel, needles) {
  const text = readFileSync(join(root, rel), 'utf8');
  for (const n of needles) {
    if (!text.includes(n)) throw new Error(`missing ${n} in ${rel}`);
  }
}

// Static presence checks (product domain)
mustInclude('src/domains/world/atlas/map-edit-ops.ts', ['applyMapEdit', 'move_object']);
mustInclude('src/domains/world/atlas/dungeon-generator.ts', [
  'generateDungeon',
  'DUNGEON_GENERATOR_VERSION',
  'validateDungeonConnectivity',
]);
mustInclude('src/domains/world/atlas/THIRD_PARTY_DUNGEON_FORGE.md', ['MIT', 'Majid Manzarpour']);

// Domain logical test (no browser)
const sharedUrl = pathToFileURL(join(pocDir, 'shared-test-world.mjs')).href;
const shared = await import(sharedUrl);
const logical = shared.runLogicalTestCase();
if (!logical.ok) {
  console.error('logical test failed', logical.steps);
  process.exit(1);
}

mkdirSync(shotDir, { recursive: true });

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  let rel = url.pathname === '/' ? '/variant-a-hybrid.html' : url.pathname;
  const file = join(pocDir, rel.replace(/^\//, ''));
  if (!file.startsWith(pocDir) || !existsSync(file)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  const body = readFileSync(file);
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
  res.end(body);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

const browser = await chromium.launch({ headless: true });
const results = {
  environment: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    measuredAt: new Date().toISOString(),
  },
  logicalNode: {
    ok: logical.ok,
    ms: +logical.ms.toFixed(3),
    byteLength: logical.byteLength,
    steps: logical.steps,
  },
  variants: {},
};

async function runVariant(name, path, shotName) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/${path}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => typeof window.__runPoc === 'function', null, { timeout: 30000 });
  await page.evaluate(() => window.__runPoc());
  await page.waitForFunction(() => window.__pocResult && window.__pocResult.logicalOk != null, null, {
    timeout: 60000,
  });
  const result = await page.evaluate(() => window.__pocResult);
  await page.screenshot({ path: join(shotDir, shotName), fullPage: true });
  await page.close();
  if (!result.logicalOk || !result.bidirectionalEditOk) {
    throw new Error(`${name} failed: ${JSON.stringify(result)}`);
  }
  results.variants[name] = result;
}

await runVariant('A-hybrid', 'variant-a-hybrid.html', 'poc-a-hybrid-1440.png');
await runVariant('B-unified-three', 'variant-b-unified.html', 'poc-b-unified-1440.png');

await browser.close();
server.close();

const a = results.variants['A-hybrid'];
const b = results.variants['B-unified-three'];
results.comparison = {
  frameMedianMs: { A: a.frame.medianMs, B: b.frame.medianMs },
  frameP95Ms: { A: a.frame.p95Ms, B: b.frame.p95Ms },
  logicalMs: { A: a.logicalMs, B: b.logicalMs },
  memoryUsedJSHeapMb: {
    A: a.memory?.usedJSHeapMb ?? null,
    B: b.memory?.usedJSHeapMb ?? null,
  },
  brushBatchMs_B_only: b.brushBatchMs ?? null,
  decisionHint:
    a.frame.medianMs <= b.frame.medianMs * 1.35
      ? 'hybrid-favored-for-brush-reuse'
      : 'unified-favored-for-frame-cost',
};

writeFileSync(outJson, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.comparison, null, 2));
console.log(`wrote ${outJson}`);
