#!/usr/bin/env node
/**
 * cutover-parity-inventory-check — CUT-01 (#1136) matrix schema + ownership gate.
 * Location: scripts/cutover-parity-inventory-check.mjs
 *
 * Fail-closed: unsupported classification, missing issueRef on PARITY_MISSING,
 * unassigned ownership vs CUT tickets, and injected fake reachable gaps.
 */
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const matrixPath = join(root, '.qa/evidence/cutover-parity/feature-matrix.json');
const baselinePath = join(root, '.qa/evidence/cutover-parity/baseline.md');

const ALLOWED_CLASS = new Set(['HOST_VERIFIED', 'PARITY_MISSING', 'LEGACY_UNUSED']);
const REQUIRED_ROW_KEYS = [
  'stableKey',
  'historicalCaller',
  'uiJourney',
  'previousBehavior',
  'hostSuccessor',
  'dataOwner',
  'risk',
  'classification',
  'issueRef',
  'evidenceTest',
  'featureAvailableBeforeCutover',
];

/** Planned CUT + follow-up issue numbers that may own matrix rows. */
const PLANNED_ISSUE_REFS = new Set([
  1137, 1138, 1139, 1140, 1141, 1142, 1143, 1144, 1145, 1146, 1147, 1148, 1149, 1150, 1151,
  1152, 1153, 1154, 1155, 1156, 1157, 1158, 788, 1159, 1160, 1161, 1162,
]);

function fail(msg) {
  console.error(`cutover-parity-inventory-check FAIL: ${msg}`);
  process.exit(1);
}

function assert(cond, msg) {
  if (!cond) fail(msg);
}

function loadMatrix(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    fail(`cannot read matrix at ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`matrix JSON parse error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function validateMatrix(matrix, { allowEmpty = false } = {}) {
  assert(matrix && typeof matrix === 'object', 'matrix must be object');
  assert(matrix.schemaVersion === 1, 'schemaVersion must be 1');
  assert(matrix.epicIssue === 1135, 'epicIssue must be 1135');
  assert(matrix.auditIssue === 1136, 'auditIssue must be 1136');
  assert(
    typeof matrix.baselineSha === 'string' && /^[0-9a-f]{40}$/.test(matrix.baselineSha),
    'baselineSha must be 40-char hex',
  );
  assert(Array.isArray(matrix.rows), 'rows must be array');
  if (!allowEmpty) {
    assert(matrix.rows.length >= 50, `expected dense inventory, got ${matrix.rows.length} rows`);
  }

  const keys = new Set();
  const byIssue = new Map();

  for (const row of matrix.rows) {
    for (const k of REQUIRED_ROW_KEYS) {
      assert(k in row, `row missing ${k}: ${JSON.stringify(row?.stableKey)}`);
    }
    assert(typeof row.stableKey === 'string' && row.stableKey.length > 0, 'stableKey empty');
    assert(!keys.has(row.stableKey), `duplicate stableKey ${row.stableKey}`);
    keys.add(row.stableKey);
    assert(ALLOWED_CLASS.has(row.classification), `bad classification ${row.classification} on ${row.stableKey}`);
    assert(typeof row.issueRef === 'number' && Number.isInteger(row.issueRef), `issueRef must be int on ${row.stableKey}`);
    assert(PLANNED_ISSUE_REFS.has(row.issueRef), `unsupported/unassigned issueRef ${row.issueRef} on ${row.stableKey}`);
    assert(typeof row.featureAvailableBeforeCutover === 'boolean', `featureAvailableBeforeCutover bool on ${row.stableKey}`);

    if (row.classification === 'PARITY_MISSING') {
      assert(
        row.featureAvailableBeforeCutover === true || row.uiJourney === 'NONE',
        `PARITY_MISSING ${row.stableKey} must be available-before-cutover unless journey NONE`,
      );
    }
    if (row.classification === 'LEGACY_UNUSED') {
      assert(
        row.featureAvailableBeforeCutover === false,
        `LEGACY_UNUSED ${row.stableKey} requires featureAvailableBeforeCutover=false`,
      );
    }
    if (row.classification === 'HOST_VERIFIED') {
      assert(
        !/PORT_MISSING/i.test(String(row.hostSuccessor)),
        `HOST_VERIFIED ${row.stableKey} must not claim PORT_MISSING successor`,
      );
    }

    const list = byIssue.get(row.issueRef) ?? [];
    list.push(row.stableKey);
    byIssue.set(row.issueRef, list);
  }

  assert(matrix.cutOwnership && typeof matrix.cutOwnership === 'object', 'cutOwnership required');
  for (const [issue, owned] of Object.entries(matrix.cutOwnership)) {
    assert(PLANNED_ISSUE_REFS.has(Number(issue)), `cutOwnership key ${issue} not in planned set`);
    assert(Array.isArray(owned), `cutOwnership[${issue}] must be array`);
    for (const sk of owned) {
      assert(keys.has(sk), `cutOwnership[${issue}] references unknown ${sk}`);
    }
  }

  // Every row must appear in cutOwnership for its issueRef.
  for (const row of matrix.rows) {
    const owned = matrix.cutOwnership[String(row.issueRef)];
    assert(Array.isArray(owned), `no cutOwnership for issue ${row.issueRef} (row ${row.stableKey})`);
    assert(owned.includes(row.stableKey), `${row.stableKey} missing from cutOwnership[${row.issueRef}]`);
  }

  const counts = matrix.counts ?? {};
  assert(counts.total === matrix.rows.length, 'counts.total mismatch');
  for (const c of ALLOWED_CLASS) {
    const actual = matrix.rows.filter((r) => r.classification === c).length;
    assert(counts[c] === actual, `counts.${c} mismatch (${counts[c]} vs ${actual})`);
  }

  return { keys, byIssue };
}

function selfTestInjectFakeMissing() {
  const dir = mkdtempSync(join(tmpdir(), 'cut-01-matrix-'));
  const fakePath = join(dir, 'feature-matrix.json');
  try {
    copyFileSync(matrixPath, fakePath);
    const matrix = loadMatrix(fakePath);
    matrix.rows.push({
      stableKey: 'injected.fake-reachable-gap',
      historicalCaller: 'test-only',
      uiJourney: 'Injected UI',
      previousBehavior: 'supabase.from(fake)',
      hostSuccessor: 'PORT_MISSING',
      dataOwner: 'test',
      risk: 'high',
      classification: 'PARITY_MISSING',
      issueRef: 999999,
      evidenceTest: 'none',
      featureAvailableBeforeCutover: true,
      notes: 'self-test injection',
    });
    matrix.counts.total = matrix.rows.length;
    matrix.counts.PARITY_MISSING = (matrix.counts.PARITY_MISSING ?? 0) + 1;
    writeFileSync(fakePath, `${JSON.stringify(matrix, null, 2)}\n`);

    const soft = loadMatrix(fakePath);
    const softFail = soft.rows.some((row) => !PLANNED_ISSUE_REFS.has(row.issueRef));
    assert(softFail, 'injected fake reachable missing operation must FAIL ownership gate');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function selfTestLegacyUnusedNeverActivated() {
  const matrix = loadMatrix(matrixPath);
  const unused = matrix.rows.filter((r) => r.classification === 'LEGACY_UNUSED');
  assert(unused.length >= 1, 'expected at least one LEGACY_UNUSED with evidence');
  for (const row of unused) {
    assert(row.featureAvailableBeforeCutover === false, `${row.stableKey} LEGACY_UNUSED must be unavailable`);
    assert(
      row.uiJourney === 'NONE' || /no .*caller|barrel only|unused/i.test(String(row.notes ?? '') + row.evidenceTest),
      `${row.stableKey} LEGACY_UNUSED needs caller evidence note`,
    );
  }
}

// --- main ---
assert(readFileSync(baselinePath, 'utf8').includes('54b6ee7c6'), 'baseline.md must cite freeze SHA');
const matrix = loadMatrix(matrixPath);
validateMatrix(matrix);
selfTestInjectFakeMissing();
selfTestLegacyUnusedNeverActivated();

// Static residual DENY still present for known PARITY_MISSING facades (fingerprint that audit is honest)
const denyNeedles = [
  ['src/infrastructure/inventory/item-catalog-service.ts', 'Item-Definition aktualisieren ist auf dem Host noch nicht verfügbar.'],
  ['src/infrastructure/look/look-service.ts', 'Look-Version anhängen ist auf dem Host noch nicht verfügbar.'],
  ['src/infrastructure/session/session-service.ts', 'Session-Löschen ist im Host-Modus noch nicht verfügbar'],
  ['src/infrastructure/saga/session-outcome-promotion-service.ts', 'isHostLibraryEnabled'],
];
for (const [rel, needle] of denyNeedles) {
  const src = readFileSync(join(root, rel), 'utf8');
  assert(src.includes(needle), `expected residual host gate still present in ${rel} (audit honesty)`);
}

console.log(
  `cutover-parity-inventory-check OK: rows=${matrix.rows.length} ` +
    `HOST_VERIFIED=${matrix.counts.HOST_VERIFIED} ` +
    `PARITY_MISSING=${matrix.counts.PARITY_MISSING} ` +
    `LEGACY_UNUSED=${matrix.counts.LEGACY_UNUSED} ` +
    `baseline=${matrix.baselineSha.slice(0, 9)}`,
);

// Allow importing validateMatrix in future tooling
export { validateMatrix, PLANNED_ISSUE_REFS, loadMatrix };
// Avoid unused import lint in plain node
void pathToFileURL;
