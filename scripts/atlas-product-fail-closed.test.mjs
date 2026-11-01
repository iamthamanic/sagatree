/**
 * Rot-Phase / fail-closed canary for ATLAS-LIVE-E2E (#770).
 * Proves product-run rejects under-count, skip, flaky, and nonzero exit;
 * green recovery is CI atlas-isolated-product 3/3 (Actions run 41201202311).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { atlasProductReportFailsClosed } from './stack-migration-db/product-fail-closed.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const productRun = readFileSync(join(here, 'stack-migration-db/product-run.mjs'), 'utf8');

test('product-run calls fail-closed helper at the report gate (not import-only)', () => {
  assert.match(
    productRun,
    /if \(atlasProductReportFailsClosed\(/,
    'product-run must call fail-closed helper at the report gate',
  );
});

test('3/3 clean green must pass fail-closed gate', () => {
  assert.equal(
    atlasProductReportFailsClosed({
      playwrightExitCode: 0,
      browser: { expected: 3, unexpected: 0, skipped: 0, flaky: 0 },
    }),
    false,
  );
});

test('nonzero Playwright exit must fail closed (rot)', () => {
  assert.equal(
    atlasProductReportFailsClosed({
      playwrightExitCode: 1,
      browser: { expected: 3, unexpected: 0, skipped: 0, flaky: 0 },
    }),
    true,
  );
});

test('expected < 3 must fail closed (rot)', () => {
  assert.equal(
    atlasProductReportFailsClosed({
      playwrightExitCode: 0,
      browser: { expected: 2, unexpected: 0, skipped: 0, flaky: 0 },
    }),
    true,
  );
});

test('skipped tests must fail closed (rot)', () => {
  assert.equal(
    atlasProductReportFailsClosed({
      playwrightExitCode: 0,
      browser: { expected: 3, unexpected: 0, skipped: 1, flaky: 0 },
    }),
    true,
  );
});

test('flaky tests must fail closed (rot)', () => {
  assert.equal(
    atlasProductReportFailsClosed({
      playwrightExitCode: 0,
      browser: { expected: 3, unexpected: 0, skipped: 0, flaky: 1 },
    }),
    true,
  );
});
