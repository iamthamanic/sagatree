/**
 * atl2-e02 — Browser wrapper for ParentSpatialAnchor protocol (#1220).
 * Location: e2e/atl2-e02-parent-spatial-anchor.spec.ts
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const selfTest = join(root, 'scripts/atl2-e02-parent-spatial-anchor.self-test.mjs');

test.describe('ATL2-E02 ParentSpatialAnchor', () => {
  test('host/domain protocol self-test PASS (CLEAR)', () => {
    expect(existsSync(selfTest)).toBeTruthy();
    const stdout = execFileSync(process.execPath, [selfTest], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    expect(stdout).toContain('atl2-e02-parent-spatial-anchor self-test: PASS');
    expect(stdout).toContain('CLEAR');
    const report = readFileSync(join(root, '.qa/runs/atl2-e02-parent-spatial-anchor.md'), 'utf8');
    expect(report).toContain('Verdict: **CLEAR**');
    expect(report).toContain('custom-webgl-prototype-runtime');
    expect(report).toMatch(/HEAD: `[0-9a-f]{40}`/);
    expect(report).toContain('IV-01');
    const headMatch = report.match(/HEAD: `([0-9a-f]{40})`/);
    expect(headMatch?.[1]).toBeTruthy();
    const tip = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    expect(() =>
      execFileSync('git', ['merge-base', '--is-ancestor', headMatch![1], tip], { cwd: root }),
    ).not.toThrow();
  });
});
