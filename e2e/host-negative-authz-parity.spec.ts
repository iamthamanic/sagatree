/**
 * MIG-600 e2e — hermetic host negative authz parity (temp evidence dir + zod parse).
 * Location: e2e/host-negative-authz-parity.spec.ts
 *
 * Runs the Node self-test into an injected temp dir (not shared .qa/runs state).
 * HTTP cutover FEATURE VERIFIED remains MIG-602.
 */
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();
const selfTestPath = join(root, 'scripts/mig-600-host-authz-parity.self-test.mjs');
const suitePath = join(root, 'server/tests/authz/host-negative-authz-suite.ts');
const testGatePath = join(root, 'scripts/test-gate.mjs');
const require = createRequire(join(root, 'server/package.json'));
/** @type {typeof import('zod')} */
const zodMod = require('zod');
const { z } = zodMod;

const coverageRowSchema = z.object({
  issue: z.number().int().positive(),
  status: z.enum(['executed', 'open-blocker']),
  executed: z.string().nullable(),
  openBlocker: z.string().nullable(),
});

const reportSchema = z.object({
  suite: z.literal('mig-600-host-authz-parity'),
  ok: z.literal(true),
  caseCount: z.number().int().positive(),
  secretMarkerAbsentForPlayers: z.literal(true),
  canaryDetectsDisabledFilter: z.literal(true),
  canaryDetectsAlwaysAllowMembership: z.literal(true),
  httpWorldTouchOwnerAllow: z.literal(true),
  httpWorldTouchOutsiderDeny: z.literal(true),
  coverage: z.array(coverageRowSchema).min(50),
});

test.describe('MIG-600 host negative authz parity', () => {
  test('self-test PASS into temp dir; report zod-valid; coverage honest', () => {
    expect(existsSync(suitePath)).toBeTruthy();
    expect(existsSync(selfTestPath)).toBeTruthy();
    const gateSrc = readFileSync(testGatePath, 'utf8');
    expect(gateSrc.includes('mig-600-host-authz-parity.self-test.mjs')).toBeTruthy();

    const outDir = mkdtempSync(join(tmpdir(), 'mig600-e2e-'));
    try {
      const stdout = execFileSync(process.execPath, ['--experimental-strip-types', selfTestPath], {
        cwd: root,
        env: { ...process.env, MIG600_OUT_DIR: outDir },
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      expect(stdout).toContain('PASS: mig-600 host authz parity');

      const raw = readFileSync(join(outDir, 'report.json'), 'utf8');
      const report = reportSchema.parse(JSON.parse(raw));
      expect(report.caseCount).toBeGreaterThan(10);
      expect(report.coverage.some((r) => r.issue === 845 && r.status === 'executed')).toBe(true);
      expect(report.coverage.some((r) => r.status === 'open-blocker')).toBe(true);
      expect(
        report.coverage.every(
          (row) => row.status !== 'executed' || (typeof row.executed === 'string' && row.executed.length > 0),
        ),
      ).toBe(true);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
