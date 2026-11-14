#!/usr/bin/env node
/**
 * Mobile UI quality gate scaffolding (#483).
 * Static checks for Playwright matrix + helpers + baseline docs.
 * Location: scripts/mobile-ui-quality-gate-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;

function read(rel) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

function check(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

const required = [
  'playwright.config.ts',
  'e2e/adaptive-ui-quality.spec.ts',
  'e2e/helpers/adaptive-ui-quality.ts',
  '.qa/design/mobile-ui-quality-gate.md',
];

for (const rel of required) {
  check(existsSync(`${root}/${rel}`), `missing ${rel}`);
}

const config = read('playwright.config.ts');
const helper = read('e2e/helpers/adaptive-ui-quality.ts');
const spec = read('e2e/adaptive-ui-quality.spec.ts');
const pkg = read('package.json');

check(/name: 'mobile-chrome'/.test(config), 'mobile-chrome project');
check(/name: 'tablet-chrome'/.test(config), 'tablet-chrome project');
check(/name: 'chromium'/.test(config), 'chromium desktop project');
check(
  /testMatch: \/\(\?:adaptive-ui-quality\|golden-mobile-journeys(?:\|aiberto-phase-a)?\)\\.spec\\.ts\//.test(
    config,
  ) || /testMatch: \/adaptive-ui-quality\\.spec\\.ts\//.test(config),
  'mobile/tablet testMatch limit (adaptive ± golden journeys ± aiberto-phase-a)',
);
check(/Pixel 7/.test(config), 'Pixel 7 phone device');
check(/iPad Mini/.test(config), 'iPad Mini tablet device');

check(/expectNoHorizontalOverflow/.test(helper), 'overflow helper');
check(/expectMinTouchTargets/.test(helper), 'touch target helper');
check(/auditMissingAccessibleNames/.test(helper), 'a11y name helper');
check(/toHaveScreenshot/.test(spec), 'visual snapshot assertion');
check(/test:e2e:adaptive/.test(pkg), 'npm script test:e2e:adaptive');
check(/test:e2e:adaptive:update-snapshots/.test(pkg), 'npm script snapshot update');

if (failures > 0) {
  console.error(`mobile-ui-quality-gate-check: ${failures} Fehler`);
  process.exit(1);
}
console.log('mobile-ui-quality-gate-check: OK (#483)');
