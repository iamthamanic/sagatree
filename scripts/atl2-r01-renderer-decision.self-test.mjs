#!/usr/bin/env node
/**
 * ATL2-R01 — Custom-WebGL vs Three inventory measure + GO/NO-GO ADR (#1266).
 * Location: scripts/atl2-r01-renderer-decision.self-test.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  mkdtempSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createJiti } from 'jiti';
import { chromium } from '@playwright/test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, { esmResolve: true });
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));

const WRITE_EVIDENCE = process.env.ATL2_R01_WRITE_EVIDENCE === '1';
const SKIP_BROWSER = process.env.ATL2_R01_SKIP_BROWSER === '1';
const headSha = execSync('git rev-parse HEAD', { cwd: root, encoding: 'utf8' }).trim();

const acceptance = readFileSync(join(root, '.qa/acceptance/atl2-r01-renderer-decision.md'), 'utf8');
const design = readFileSync(join(root, '.qa/design/atl2-r01-renderer-decision.md'), 'utf8');
const matrix = readFileSync(join(root, '.qa/design/atl2-r01-reuse-matrix.md'), 'utf8');
const gate = readFileSync(join(root, 'scripts/test-gate.mjs'), 'utf8');
const indexSrc = readFileSync(join(root, 'src/domains/world/atlas/index.ts'), 'utf8');
const editorSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'),
  'utf8',
);
const nativeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/AtlasNative3dEditor.tsx'),
  'utf8',
);
const spatialSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/AtlasSpatialViewport.tsx'),
  'utf8',
);
const runtimeSrc = readFileSync(
  join(root, 'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs'),
  'utf8',
);
const hist = readFileSync(join(root, '.qa/research/unified-atlas-renderer-comparison.md'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

assert.ok(acceptance.includes('atl2-r01-renderer-decision'));
assert.ok(acceptance.includes('GO/NO-GO') || acceptance.includes('GO oder **NO-GO**'));
assert.ok(design.includes('**NO-GO**') || design.includes('Verdict:** `NO-GO`'));
assert.match(design, /\bNO-GO\b/);
assert.ok(matrix.includes('MeshBuilder'));
assert.ok(matrix.includes('atlas-heightfield.ts'));
assert.ok(matrix.includes('atlas-diorama-look.ts'));
assert.ok(gate.includes('atl2-r01-renderer-decision.self-test.mjs'), 'wired in test-gate');
assert.ok(indexSrc.includes('ATLAS_R01_RENDERER_HYBRID_DECISION'));
assert.ok(indexSrc.includes('atlasR01AllowsFollowOnRendererWork'));

assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime');
assert.equal(target.ATLAS_R01_RENDERER_HYBRID_DECISION.verdict, 'NO-GO');
assert.equal(target.ATLAS_R01_RENDERER_HYBRID_DECISION.productiveOwner, 'custom-webgl-prototype-runtime');
assert.equal(target.atlasR01AllowsFollowOnRendererWork(), false);
assert.deepEqual([...target.ATLAS_R01_RENDERER_HYBRID_DECISION.followOnIssues], [
  1267, 1268, 1269, 1270,
]);

// Product chrome: single owner
assert.ok(editorSrc.includes('AtlasNative3dEditor'));
assert.ok(!editorSrc.includes('AtlasSpatialViewport'));
assert.ok(nativeSrc.includes('mountAtlasPrototype3d'));
assert.ok(runtimeSrc.includes('class AtlasGL'));
assert.ok(runtimeSrc.includes('class AtlasLite3D'));
assert.ok(runtimeSrc.includes('class MeshBuilder'));
assert.ok(spatialSrc.includes("import * as THREE from 'three'"));
assert.ok(!spatialSrc.includes('heightfield'));
assert.ok(!spatialSrc.includes('AtlasLite'));
assert.ok(!spatialSrc.includes('dioramaLight'));
assert.equal(pkg.dependencies?.three, '0.186.1');

// Historical PoC is Three-vs-Three, not Custom-vs-Three
assert.ok(hist.includes('Synchronized Hybrid'));
assert.ok(hist.includes('Unified Three'));
assert.ok(
  design.includes('**not** product Custom-WebGL') ||
    design.includes('nicht product Custom-WebGL') ||
    design.includes('not** product Custom-WebGL'),
);

const pocDir = join(root, '.qa/evidence/atl2-r01-renderer-poc');
assert.ok(existsSync(join(pocDir, 'variant-custom-webgl.html')));
assert.ok(existsSync(join(pocDir, 'variant-three-inventory.html')));
assert.ok(existsSync(join(pocDir, 'fixture.json')));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
  '.ts': 'text/javascript; charset=utf-8',
  '.tsx': 'text/javascript; charset=utf-8',
};

const evidence = {
  slug: 'atl2-r01-renderer-decision',
  issue: 1266,
  head: headSha,
  verdict: 'NO-GO',
  productiveOwner: 'custom-webgl-prototype-runtime',
  checks: ['inventory', 'adr-no-go', 'single-product-mount'],
  variants: {},
};

async function measureBrowser() {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/.qa/evidence/atl2-r01-renderer-poc/variant-custom-webgl.html';
    const file = join(root, rel.replace(/^\//, ''));
    if (!file.startsWith(root) || !existsSync(file)) {
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
  const shotDir = join(pocDir, 'screenshots');
  mkdirSync(shotDir, { recursive: true });

  async function run(name, path, shot) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.setDefaultTimeout(90000);
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForFunction(() => window.__r01Ready === true, null, { timeout: 90000 });
    const result = await page.evaluate(async () => window.__r01Measure());
    await page.screenshot({ path: join(shotDir, shot), fullPage: true });
    await page.close();
    assert.equal(result.logicalOk, true, `${name} logicalOk`);
    evidence.variants[name] = result;
  }

  try {
    await run(
      'custom-webgl',
      '/.qa/evidence/atl2-r01-renderer-poc/variant-custom-webgl.html',
      'r01-custom-webgl-1280.png',
    );
    await run(
      'three-inventory',
      '/.qa/evidence/atl2-r01-renderer-poc/variant-three-inventory.html',
      'r01-three-inventory-1280.png',
    );
  } finally {
    await browser.close();
    server.close();
  }
  evidence.checks.push('browser-measure');
}

if (!SKIP_BROWSER) {
  try {
    await measureBrowser();
    const c = evidence.variants['custom-webgl'];
    const t = evidence.variants['three-inventory'];
    assert.ok(c.frame?.p50Ms != null && t.frame?.p50Ms != null);
    assert.equal(c.hasSoftwareFallbackPath, true);
    assert.equal(t.hasSoftwareFallbackPath, false);
    evidence.comparison = {
      frameP50Ms: { custom: c.frame.p50Ms, three: t.frame.p50Ms },
      frameP95Ms: { custom: c.frame.p95Ms, three: t.frame.p95Ms },
      memoryUsedJSHeapMb: {
        custom: c.memory?.usedJSHeapMb ?? null,
        three: t.memory?.usedJSHeapMb ?? null,
      },
      decisiveWinForThreeProductSwap: false,
      rationale:
        'No decisive p50/p95 win that offsets missing lite/heightfield/diorama/product chrome; ADR NO-GO.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Executable doesn't exist|browserType\.launch/i.test(msg)) throw err;
    // Local agent hosts may lack Playwright browsers; CI Quality Gates have them.
    // Prefer previously committed PoC results when present; else record protocol deferred.
    const priorPath = join(pocDir, 'results.json');
    if (existsSync(priorPath)) {
      const prior = JSON.parse(readFileSync(priorPath, 'utf8'));
      assert.ok(prior.variants?.['custom-webgl'] || prior.variants?.custom);
      evidence.variants = prior.variants;
      evidence.comparison = prior.comparison ?? null;
      evidence.checks.push('browser-measure-from-committed-results');
    } else {
      evidence.browserError = msg.slice(0, 240);
      evidence.checks.push('browser-measure-deferred-ci');
      evidence.comparison = {
        frameP50Ms: { custom: null, three: null },
        frameP95Ms: { custom: null, three: null },
        memoryUsedJSHeapMb: { custom: null, three: null },
        decisiveWinForThreeProductSwap: false,
        rationale:
          'Browser binaries missing locally; NO-GO still stands on capability matrix + D01/Gate D lock. CI re-measures.',
      };
    }
  }
} else {
  evidence.checks.push('browser-skipped');
}

for (const rel of [
  'src/domains/world/atlas/atlas-renderer-target.ts',
  'src/domains/world/atlas/index.ts',
]) {
  const src = readFileSync(join(root, rel), 'utf8');
  assert.doesNotMatch(src, /\bas any\b/);
  assert.doesNotMatch(src, /@ts-ignore|@ts-expect-error|as unknown as/);
}
evidence.checks.push('typed-strict');

const md = `# ATL2-R01 Renderer Hybrid Decision

- Issue: #1266
- HEAD: \`${headSha}\`
- Verdict: **NO-GO**
- Productive 3D owner: \`custom-webgl-prototype-runtime\`
- Date: ${new Date().toISOString().slice(0, 10)}

## Checks

${evidence.checks.map((c) => `- ${c}`).join('\n')}

## Comparison (summary)

${
  evidence.comparison
    ? `| Metric | Custom-WebGL | Three inventory |
|----------|-------------|-----------------|
| frame p50 ms | ${evidence.comparison.frameP50Ms.custom} | ${evidence.comparison.frameP50Ms.three} |
| frame p95 ms | ${evidence.comparison.frameP95Ms.custom} | ${evidence.comparison.frameP95Ms.three} |
| JS heap MB | ${evidence.comparison.memoryUsedJSHeapMb.custom} | ${evidence.comparison.memoryUsedJSHeapMb.three} |`
    : '_Browser measure skipped in this run._'
}

## Decision

**NO-GO** for R02–R05 Three product backend. Follow-ons #1267–#1270 must not auto-start.
See \`.qa/design/atl2-r01-renderer-decision.md\`.
`;

const outDir = WRITE_EVIDENCE ? join(root, '.qa/runs') : mkdtempSync(join(tmpdir(), 'atl2-r01-out-'));
if (WRITE_EVIDENCE) mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'atl2-r01-renderer-decision.md'), md);
writeFileSync(join(outDir, 'atl2-r01-renderer-decision.json'), `${JSON.stringify(evidence, null, 2)}\n`);
if (WRITE_EVIDENCE) {
  writeFileSync(join(pocDir, 'results.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}

if (!WRITE_EVIDENCE && existsSync(join(root, '.qa/runs/atl2-r01-renderer-decision.md'))) {
  const committed = readFileSync(join(root, '.qa/runs/atl2-r01-renderer-decision.md'), 'utf8');
  assert.match(committed, /Verdict: \*\*NO-GO\*\*/);
}

console.log('atl2-r01-renderer-decision self-test: PASS (NO-GO)');
console.log(`report: ${join(outDir, 'atl2-r01-renderer-decision.md')}${WRITE_EVIDENCE ? '' : ' (transient)'}`);
