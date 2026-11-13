/**
 * atl2-e01-primary-maps — Browser wrapper for E01 hierarchy protocol (#1219).
 * Location: e2e/atl2-e01-primary-maps.spec.ts
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const selfTest = join(root, 'scripts/atl2-e01-primary-maps.self-test.mjs');

test.describe('ATL2-E01 primary maps hierarchy', () => {
  test('host protocol self-test PASS (CLEAR)', () => {
    expect(existsSync(selfTest)).toBeTruthy();
    const stdout = execFileSync(process.execPath, [selfTest], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    expect(stdout).toContain('atl2-e01-primary-maps self-test: PASS');
    expect(stdout).toContain('CLEAR');
    const report = readFileSync(join(root, '.qa/runs/atl2-e01-primary-maps.md'), 'utf8');
    expect(report).toContain('Verdict: **CLEAR**');
    expect(report).toContain('continent → country → place → building → room');
  });
});
