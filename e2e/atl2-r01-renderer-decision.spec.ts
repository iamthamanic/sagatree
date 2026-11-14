/**
 * atl2-r01-renderer-decision — Browser wrapper for R01 GO/NO-GO protocol (#1266).
 * Location: e2e/atl2-r01-renderer-decision.spec.ts
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const selfTest = join(root, 'scripts/atl2-r01-renderer-decision.self-test.mjs');

test.describe('ATL2-R01 Renderer Hybrid Decision', () => {
  test('self-test PASS with explicit NO-GO', () => {
    expect(existsSync(selfTest)).toBeTruthy();
    const stdout = execFileSync(process.execPath, [selfTest], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ATL2_R01_SKIP_BROWSER: process.env.ATL2_R01_SKIP_BROWSER ?? '0' },
      timeout: 180_000,
    });
    expect(stdout).toContain('atl2-r01-renderer-decision self-test: PASS');
    expect(stdout).toContain('NO-GO');
    const report = readFileSync(join(root, '.qa/runs/atl2-r01-renderer-decision.md'), 'utf8');
    expect(report).toContain('Verdict: **NO-GO**');
    expect(report).toContain('custom-webgl-prototype-runtime');
    const adr = readFileSync(join(root, '.qa/design/atl2-r01-renderer-decision.md'), 'utf8');
    expect(adr).toMatch(/\bNO-GO\b/);
    expect(adr).toContain('#1267');
  });
});
