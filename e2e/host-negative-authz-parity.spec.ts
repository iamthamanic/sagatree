/**
 * MIG-600 e2e — run host negative authz parity suite inside Browser E2E job.
 * Location: e2e/host-negative-authz-parity.spec.ts
 *
 * Fresh Actions checkouts do not share test-gate artifacts; this spec regenerates
 * evidence via the Node suite against real SQLite. HTTP cutover remains MIG-602.
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const reportPath = join(root, '.qa/runs/mig-600-host-authz/report.json');
const suitePath = join(root, 'server/tests/authz/host-negative-authz-suite.ts');
const selfTestPath = join(root, 'scripts/mig-600-host-authz-parity.self-test.mjs');
const testGatePath = join(root, 'scripts/test-gate.mjs');

test.describe('MIG-600 host negative authz parity', () => {
  test('sources wired and suite PASS with coverage inventory', () => {
    expect(existsSync(suitePath)).toBeTruthy();
    expect(existsSync(selfTestPath)).toBeTruthy();
    const gateSrc = readFileSync(testGatePath, 'utf8');
    expect(gateSrc.includes('mig-600-host-authz-parity.self-test.mjs')).toBeTruthy();

    execFileSync(process.execPath, ['--experimental-strip-types', selfTestPath], {
      cwd: root,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    expect(existsSync(reportPath)).toBeTruthy();
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      ok: boolean;
      caseCount: number;
      coverage: Array<{ status: string; executed?: string | null }>;
      secretMarkerAbsentForPlayers: boolean;
      canaryDetectsDisabledFilter: boolean;
      canaryDetectsAlwaysAllowMembership: boolean;
    };
    expect(report.ok).toBe(true);
    expect(report.caseCount).toBeGreaterThan(10);
    expect(report.coverage.length).toBeGreaterThan(50);
    expect(report.secretMarkerAbsentForPlayers).toBe(true);
    expect(report.canaryDetectsDisabledFilter).toBe(true);
    expect(report.canaryDetectsAlwaysAllowMembership).toBe(true);
    expect(
      report.coverage.every((row) => row.status !== 'parity' || Boolean(row.executed)),
    ).toBe(true);
  });
});
