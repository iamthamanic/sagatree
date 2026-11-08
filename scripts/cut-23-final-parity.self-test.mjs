#!/usr/bin/env node
/**
 * cut-23-final-parity.self-test — Final host-only parity closer (#1158).
 * Location: scripts/cut-23-final-parity.self-test.mjs
 *
 * Machine-inspectable: feature-matrix has zero PARITY_MISSING, inventory check
 * PASS, host compose is product default, Soft-DENY product fingerprints cleared
 * for host-verified surfaces, and desktop claims stay honest under GATE-05.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;

function assert(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

const matrix = JSON.parse(
  readFileSync(join(root, '.qa/evidence/cutover-parity/feature-matrix.json'), 'utf8'),
);
assert(matrix.counts?.PARITY_MISSING === 0, `PARITY_MISSING must be 0, got ${matrix.counts?.PARITY_MISSING}`);
assert(
  (matrix.counts?.HOST_VERIFIED ?? 0) + (matrix.counts?.LEGACY_UNUSED ?? 0) === matrix.counts?.total,
  'HOST_VERIFIED + LEGACY_UNUSED must equal total when PARITY_MISSING=0',
);

for (const row of matrix.rows) {
  if (row.classification === 'PARITY_MISSING') {
    assert(false, `unexpected PARITY_MISSING row ${row.stableKey}`);
  }
  if (row.classification === 'HOST_VERIFIED') {
    assert(
      typeof row.evidenceTest === 'string' && row.evidenceTest.length > 0,
      `HOST_VERIFIED ${row.stableKey} needs evidenceTest`,
    );
  }
}

execFileSync(process.execPath, ['scripts/cutover-parity-inventory-check.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

const rootCompose = readFileSync(join(root, 'docker-compose.yml'), 'utf8');
assert(
  /deployment\/docker-compose\.host\.yml/.test(rootCompose),
  'CUT-23 requires CUT-22 host compose default',
);
assert(
  !/supabase\/docker|image:\s*supabase\//i.test(rootCompose),
  'root compose must not pull product Supabase images',
);

const residual = readFileSync(join(root, 'docs/architecture/fe-host-09-residual-supabase.md'), 'utf8');
assert(/Residual allowlist/.test(residual), 'residual allowlist doc present');
assert(/CUT-21|archived/i.test(residual), 'residual doc records archive/cutover status');

// Soft-DENY UX fingerprints (German "noch nicht verfügbar") must not remain in
// active product infrastructure. The shared deny helper is the only allowlist.
const softDenyAllow = new Set(['src/infrastructure/host/host-product-deny.ts']);
function walkTs(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) walkTs(p, out);
    else if (name.isFile() && name.name.endsWith('.ts') && !name.name.endsWith('.d.ts')) {
      out.push(p);
    }
  }
  return out;
}
for (const abs of walkTs(join(root, 'src/infrastructure'))) {
  const rel = relative(root, abs).split('\\').join('/');
  if (softDenyAllow.has(rel)) continue;
  const src = readFileSync(abs, 'utf8');
  if (/im Host-Modus noch nicht verfügbar/i.test(src)) {
    assert(false, `Soft-DENY UX fingerprint in product code: ${rel}`);
  }
}

// Desktop GATE-05 honesty: APPROVED unlocks MIG-703 PoC, not silent cross-OS ship.
const approvalsPath = join(
  root,
  '.qa/evidence/stack-migration-prep/architecture-approvals.json',
);
assert(existsSync(approvalsPath), 'architecture-approvals.json missing');
const approvals = JSON.parse(readFileSync(approvalsPath, 'utf8'));
const gate05 = approvals?.decisions?.['GATE-05'];
const status = String(gate05?.status ?? 'UNKNOWN').toUpperCase();
assert(existsSync(join(root, 'docs/ops/desktop/README.md')), 'desktop ops README required');
const desk = readFileSync(join(root, 'docs/ops/desktop/README.md'), 'utf8');
assert(/GATE-05/.test(desk), 'desktop README references GATE-05');
assert(/DESKTOP-PRODUCT-STORE|Product\/Store RELEASE/i.test(desk), 'desktop README separates store RELEASE');
if (status === 'APPROVED') {
  assert(
    existsSync(join(root, '.qa/evidence/stack-migration-prep/pocs/gate-05/report.json')),
    'GATE-05 APPROVED requires PoC report.json on disk',
  );
  assert(
    /does not claim linux\/win32|NOT RUN|Non-claims/i.test(desk),
    'desktop README must refuse NOT-RUN platform ship claims',
  );
} else {
  assert(/GATE-05/.test(desk), 'desktop README documents deferred GATE-05');
}

const cut22 = join(root, 'scripts/cut-22-host-runtime-contracts.self-test.mjs');
assert(existsSync(cut22), 'CUT-22 self-test must exist (depends on #1157)');

if (failures > 0) {
  console.error(`\ncut-23-final-parity.self-test: ${failures} failure(s)`);
  process.exit(1);
}
console.log(
  'cut-23-final-parity.self-test: PASS (matrix clear; inventory OK; Soft-DENY clear; desktop claims honest)',
);
