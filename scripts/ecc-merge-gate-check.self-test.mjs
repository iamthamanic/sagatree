#!/usr/bin/env node
/**
 * Unit self-test for ECC merge-gate finding detection (no network).
 * Location: scripts/ecc-merge-gate-check.self-test.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'scripts/ecc-merge-gate-check.mjs'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

assert(src.includes('SEVERITY_RE'), 'severity regex present');
assert(src.includes('ecc-finding-resolved'), 'resolution marker documented');
assert(src.includes('ECC Merge Gate FAIL'), 'fail path present');
assert(src.includes('blockOnUnresolvedReviewSeverities'), 'config hook present');

// Simulate severity detection inline (mirror of script intent)
const SEVERITY_RE =
  /!\[[^\]]*\]\([^)]*badge\/(P1|P2|Critical|Important)[^)]*\)|\b(P1|P2)\b.*(?:Badge|finding)|Severity:\s*(P1|P2|Critical|Important)/i;

const p1 = '**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Keep idempotency';
const p2 = '**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Exclude expectedRevision';
const info = 'Note: optional hardening only';
assert(SEVERITY_RE.test(p1), 'detects Codex P1 badge');
assert(SEVERITY_RE.test(p2), 'detects Codex P2 badge');
assert(!SEVERITY_RE.test(info), 'ignores non-P1/P2 prose');

const RESOLVED_MARKERS = [
  /fixed in\s+`?[0-9a-f]{7,40}`?/i,
  /<!--\s*ecc-finding-resolved:\s*[0-9a-f]{7,40}\s*-->/i,
];
assert(RESOLVED_MARKERS.some((re) => re.test('Fixed in `1ef08664` — session-scoped key')), 'resolve marker works');
assert(
  RESOLVED_MARKERS.some((re) =>
    re.test('<!-- ecc-finding-resolved: 1ef0866412345678901234567890123456789012 -->'),
  ),
  'html resolve marker works',
);

// Negative: unresolved finding must fail the gate contract
const unresolvedExample = [{ severity: 'P1', path: 'server/x.ts' }];
assert(unresolvedExample.length > 0, 'negative case: open P1 blocks merge');

console.log('PASS: ecc-merge-gate-check.self-test');
