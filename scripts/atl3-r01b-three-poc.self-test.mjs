#!/usr/bin/env node
/**
 * ATL3-R01B — Three.js equal-fidelity PoC + conditional GO-ADR (#1296).
 * Location: scripts/atl3-r01b-three-poc.self-test.mjs
 *
 * Locks: GO is fail-closed behind owner approval + hardware evidence (R02–R05 stay closed); ADR-ST-10/#1266
 * immutable; custom WebGL stays the only productive renderer; the PoC is isolated (no product import, no write
 * path); committed browser evidence proves same data, ID parity, picking, edit path, restore, load error;
 * V01 leftovers fixed in the custom runtime; zero type escape hatches.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const jiti = createJiti(import.meta.url);
const target = jiti(join(root, 'src/domains/world/atlas/atlas-renderer-target.ts'));
const rows = [];
const row = (name, detail) => rows.push(`${name}: PASS — ${detail}`);

/* 1) Domain decision — fail-closed conditional GO. */
const d = target.ATLAS_R01B_RENDERER_DECISION;
assert.equal(d.issue, 1296);
assert.equal(d.adr, 'ADR-ST-11');
assert.equal(d.verdict, 'GO');
assert.equal(d.proposedOwner, 'three-r01b-scene');
assert.equal(d.productiveOwner, 'custom-webgl-prototype-runtime');
assert.equal(target.ATLAS_PRODUCT_3D_TARGET, 'custom-webgl-prototype-runtime', 'custom WebGL stays productive');
assert.deepEqual([...d.followOnIssues], [1267, 1268, 1269, 1270]);
assert.deepEqual({ ...d.gates }, { ownerApproval: 'pending', hardwareEvidence: 'pending' }, 'gates pending until owner + hardware');
assert.equal(target.atlasR01bAllowsFollowOnRendererWork(), false, 'R02–R05 stay closed');
const pass = { ...d, gates: { ownerApproval: 'passed', hardwareEvidence: 'passed' } };
assert.equal(target.atlasR01bAllowsFollowOnRendererWork(pass), true);
for (const gates of [{ ownerApproval: 'passed', hardwareEvidence: 'pending' }, { ownerApproval: 'pending', hardwareEvidence: 'passed' }, { ownerApproval: 'passed', hardwareEvidence: 'failed' }]) {
  assert.equal(target.atlasR01bAllowsFollowOnRendererWork({ ...d, gates }), false, `fail-closed ${JSON.stringify(gates)}`);
}
assert.equal(target.atlasR01bAllowsFollowOnRendererWork({ ...pass, verdict: 'NO-GO' }), false);
assert.equal(target.ATLAS_R01_RENDERER_HYBRID_DECISION.verdict, 'NO-GO', '#1266 decision immutable');
assert.equal(target.atlasR01AllowsFollowOnRendererWork(), false);
assert.equal(target.ATLAS_RENDERER_DECISION.retireParallelIn, 'atl3-r02-adapter', 'retireParallelIn updated with the ADR (H01-3)');
for (const p of d.evidencePaths) assert.ok(existsSync(join(root, p)), `evidence path ${p}`);
const indexSrc = read('src/domains/world/atlas/index.ts');
for (const n of ['ATLAS_R01B_RENDERER_DECISION', 'atlasR01bAllowsFollowOnRendererWork']) assert.ok(indexSrc.includes(n), `barrel exports ${n}`);
row('decision-fail-closed', 'GO pending owner+hardware → follow-on false; ADR-ST-10/#1266 unchanged');

/* 2) ADR + docs. */
const adr = read('docs/architecture/ADR-ST-11-atl3-r01b-three-renderer-go.md');
for (const n of ['GO (conditional)', 'ADR-ST-10', '#1296', '#1267', '#1268', '#1269', '#1270', '## Rollback', '## Gates', 'hardwareBudgets', 'Owner approval', 'Hardware evidence', 'SwiftShader', 'content density', 'retireParallelIn', 'No dual product mounts']) {
  assert.ok(adr.toLowerCase().includes(n.toLowerCase()), `ADR mentions ${n}`);
}
assert.ok(read('docs/architecture/ADR-ST-10-atl2-r01-custom-webgl-product-sot.md').includes('**NO-GO (Option A).**'), 'ADR-ST-10 immutable');
const index = read('docs/architecture/atlas-v2-architecture.md');
assert.ok(index.includes('ADR-ST-11') && !/Three\.js\s+(?:is|ist)\s+(?:the\s+)?(?:productive|produktiv)/i.test(index));
const acc = read('.qa/acceptance/atl3-r01b-three-equal-fidelity-adr.md');
assert.ok(acc.includes('ADR-ST-10') && acc.includes('#1296') && acc.includes('ADR-ST-11'));
assert.ok(read('.qa/design/atl3-r01b-three-equal-fidelity-adr.md').includes('Decision log'));
assert.ok(read('scripts/test-gate.mjs').includes('scripts/atl3-r01b-three-poc.self-test.mjs'), 'wired in test-gate');
row('adr-docs', 'ADR-ST-11 gates/rollback/reopen table; index + acceptance consistent');

/* 3) PoC isolation: only the e2e spec (type-only) references it; no write path. */
const POC = 'src/infrastructure/world/atlas-r01b-three-poc';
const walk = (dir) => readdirSync(join(root, dir)).flatMap((f) => {
  const rel = join(dir, f);
  if (f === 'node_modules' || f.startsWith('.')) return [];
  return statSync(join(root, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx|mjs|js)$/.test(f) ? [rel] : [];
});
const importers = ['src', 'server'].filter((d0) => existsSync(join(root, d0))).flatMap(walk)
  .filter((f) => !f.startsWith(POC) && /(?:from\s+|import\s*\(\s*)['"][^'"]*atlas-r01b-three-poc/.test(read(f)));
assert.deepEqual(importers, [], 'no product module imports the R01B PoC');
const pocFiles = walk(POC);
assert.ok(pocFiles.length >= 4);
const ESCAPE = /\bas any\b|as unknown as|@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable/;
for (const f of [...pocFiles, 'e2e/atl3-r01b-three-poc.spec.ts']) {
  const src = read(f);
  assert.ok(!ESCAPE.test(src), `${f}: no type escape hatches`);
  if (f.startsWith(POC)) assert.ok(!/\bfetch\(|XMLHttpRequest|supabase|\.rpc\(/.test(src), `${f}: no network/write path`);
}
const spec = read('e2e/atl3-r01b-three-poc.spec.ts');
assert.ok(/import type \{\} from '..\/src\/infrastructure\/world\/atlas-r01b-three-poc\/r01b-poc-harness'/.test(spec), 'spec imports harness type-only');
assert.ok(spec.includes("route.abort()") || spec.includes('held'), 'edit path PUT held (no DB write)');
assert.ok(spec.includes("tier === 'desktop-reference'") && spec.includes('!software && budget'), 'hardware budgets enforced on real GPUs');
row('poc-isolated', `${pocFiles.length} PoC files, 0 product importers, 0 escape hatches`);

/* 4) Committed browser evidence. */
const ev = JSON.parse(read('.qa/evidence/atl3-r01b-three-poc/results.json'));
const contract = JSON.parse(read('.qa/fixtures/atl3-v01-visual-contract/golden-scenes.json'));
assert.equal(ev.issue, 1296);
for (const s of contract.scenes) {
  const got = ev.storedData.find((x) => x.sceneId === s.id);
  assert.equal(got?.fingerprint, s.dataFingerprint, `${s.id}: same stored data as V01`);
}
assert.ok(ev.captures.length >= 20, 'captures mirror V01 views');
for (const cam of ['ortho-topdown', 'diorama-oblique', 'perspective']) assert.ok(ev.captures.some((c) => c.camera === cam), `camera ${cam}`);
for (const vp of ['desktop', 'tablet', 'phone']) assert.ok(ev.captures.some((c) => c.viewport === vp), `viewport ${vp}`);
assert.ok(ev.captures.every((c) => c.customFile && c.metrics.distinctColors > 0), 'each capture paired with its V01 custom frame');
assert.ok(ev.idParity.length === 2 && ev.idParity.every((p) => p.equal && p.docIds === p.pocIds), '2D/3D id parity');
assert.ok(ev.picking.every((p) => p.hits === p.tried && p.tried > 0), 'picking');
assert.ok(ev.contextLoss.every((c) => c.lost && c.restored), 'context loss/restore');
assert.ok(ev.editPath.idsAfter === ev.editPath.idsBefore + 1 && ev.editPath.planarOffset < 1 && /no write/.test(ev.editPath.dbWrite), 'edit path');
assert.equal(ev.loadError.rejected, true, 'load error rejects');
if (/^software/.test(ev.renderer.kind)) {
  assert.match(ev.measurementClass, /informational/, 'software perf is informational');
  assert.ok(ev.perf.every((p) => p.budgetMode === 'informational'));
} else {
  const b = contract.hardwareBudgets.find((x) => x.tier === 'desktop-reference');
  assert.ok(ev.perf.filter((p) => p.profile === b.preset).every((p) => p.p95 <= b.frameP95Ms), 'hardware p95 within budget');
}
for (const f of ['dornhain-block__diorama-oblique__z1-stadtblock__high.jpg', 'krypta__perspective__z1-raumgruppe__high.jpg']) {
  assert.ok(existsSync(join(root, '.qa/evidence/atl3-r01b-three-poc/ab', f)), `A/B ${f}`);
}
assert.ok(existsSync(join(root, '.qa/research/atl3-r01b/atlas-v8-reference.html')), 'V8 reference in research (not public/)');
assert.ok(!existsSync(join(root, 'public/atlas-v8-reference.html')));
row('evidence', `${ev.captures.length} captures, ${ev.renderer.kind}, ids/picking/restore/edit/load-error OK`);

/* 5) V01 leftovers fixed in the productive custom runtime. */
const rt = read('src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs');
assert.ok(rt.includes('uniform float uFogStart') && /max\(0\.0,vFogDepth-uFogStart\)/.test(rt), '(a) fog starts behind focus');
assert.ok(/const near=Math\.max\(\.2,d\*\.02\)/.test(rt), '(b) perspective near scales with distance');
assert.ok(/POLYGON_OFFSET_FILL/.test(rt) && /dyR=Math\.min\(\.075/.test(rt), '(b)(c) polygon offset + layer spacing');
const crit = Object.fromEntries(contract.criteria.map((c) => [c.id, c.status]));
assert.equal(crit['D-ART-01'], 'MET');
assert.equal(crit['K-ART-01'], 'MET');
row('v01-leftovers', 'fog start, near plane, polygon offset; D-ART-01/K-ART-01 MET');

console.log(rows.join('\n'));
console.log(`atl3-r01b-three-poc self-test: PASS (${rows.length} checks) — ${relative(root, join(root, 'docs/architecture/ADR-ST-11-atl3-r01b-three-renderer-go.md'))}`);
