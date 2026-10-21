import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const output = args.includes('--output') ? resolve(args[args.indexOf('--output') + 1]) : join(here, 'artifacts/canary');
await mkdir(output, { recursive: true });
async function run(name, inject) {
  const destination = join(output, name);
  const child = spawn(process.execPath, [join(here, 'run.mjs'), '--canary-only', '--output', destination,
    ...(inject ? ['--inject-policy-regression'] : [])], { stdio: 'inherit' });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  const report = JSON.parse(await readFile(join(destination, 'report.json'), 'utf8'));
  assert.equal(report.error, undefined, 'A setup failure is not a successful canary');
  assert.equal(report.cleanupError, undefined);
  assert.equal(report.mode, 'rls-canary-only');
  assert.equal(report.tests.length, 1);
  assert.equal(report.tests[0].id, 'PAR-10');
  assert.equal(report.tests[0].status, inject ? 'failed' : 'passed');
  assert.equal(code, inject ? 1 : 0);
  if (inject) assert.match(report.tests[0].error, /PAR-10 detected an actual RLS policy allowing a foreign owner/);
  return { code, result: report.tests[0] };
}
const clean = await run('clean', false);
const regression = await run('injected-allow-policy', true);
await writeFile(join(output, 'canary-report.json'), JSON.stringify({
  status: 'passed', meaning: 'The actual SQL/RLS test passes on the clean fixture and fails on the intentionally opened policy.',
  securityParityApproved: false, clean, regression,
}, null, 2) + '\n');
console.log('PASS: Actual RLS policy canary detected the intentionally introduced regression.');
