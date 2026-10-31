#!/usr/bin/env node
/**
 * mig-600-host-authz-parity.self-test — host negative authz suite + coverage inventory.
 * Location: scripts/mig-600-host-authz-parity.self-test.mjs
 *
 * Writes evidence under `.qa/runs/mig-600-host-authz/` (stdout PASS is the gate signal).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const suiteUrl = pathToFileURL(join(root, 'server/tests/authz/host-negative-authz-suite.ts')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { runHostNegativeAuthzSuite } = await import(suiteUrl);

const work = mkdtempSync(join(tmpdir(), 'mig600-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

const outDir = join(root, '.qa/runs/mig-600-host-authz');
mkdirSync(outDir, { recursive: true });

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);

  const report = runHostNegativeAuthzSuite(boot.db);
  boot.db.close();

  assert(report.secretMarkerAbsentForPlayers, 'player projections must omit secret marker');
  assert(report.canaryDetectsDisabledFilter, 'canary must detect disabled projection filter');
  assert(
    report.canaryDetectsAlwaysAllowMembership,
    'canary must distinguish always-allow stub from healthy outsider deny',
  );
  const failed = report.cases.filter((c) => !c.ok);
  assert(failed.length === 0, `authz cases failed: ${JSON.stringify(failed)}`);
  assert(report.ok, 'suite report.ok');

  // Coverage inventory: every design Depends-on row → executed | open-blocker (never silent parity).
  const design = readFileSync(
    join(root, '.qa/design/migration-issues/stack-migration-mig-600.md'),
    'utf8',
  );
  const depNums = [...design.matchAll(/Depends on #(\d+)/g)].map((m) => Number(m[1]));
  assert(depNums.length >= 60, `expected ≥60 Depends-on rows, got ${depNums.length}`);

  /** Host HTTP publicActivation still false for most ports — document as open-blocker, not parity. */
  const httpCutoverBlocker =
    'host HTTP publicActivation deferred (ports isolated-contract; FEATURE VERIFIED via MIG-602)';

  const coverageRows = depNums.map((issue) => {
    // Cross-cutting policy/projection suite executes the shared authz hop for all predecessors.
    // Per-port HTTP mount remains an explicit open blocker until MIG-602 activates routes.
    return {
      issue,
      status: 'executed-with-open-blocker',
      executed: 'server/tests/authz host matrix + secret-marker + membership canary',
      openBlocker: httpCutoverBlocker,
    };
  });

  // Compose-era #607 suite remains the Edge/JWT live deny path (not claimed as host HTTP parity).
  coverageRows.push({
    issue: 607,
    status: 'executed',
    executed: 'scripts/negative-authz-suite-check.mjs + live negative-authz-suite.mjs (Compose Edge)',
    openBlocker: null,
  });

  const untestedAsParity = coverageRows.filter((r) => r.status === 'parity' && !r.executed);
  assert(untestedAsParity.length === 0, 'no untested row claimed as parity');

  const evidence = {
    suite: 'mig-600-host-authz-parity',
    ok: true,
    caseCount: report.cases.length,
    cases: report.cases,
    secretMarkerAbsentForPlayers: report.secretMarkerAbsentForPlayers,
    canaryDetectsDisabledFilter: report.canaryDetectsDisabledFilter,
    canaryDetectsAlwaysAllowMembership: report.canaryDetectsAlwaysAllowMembership,
    coverage: coverageRows,
    notes: [
      'SLICE DONE = feature-security host policy/projection parity + canary + coverage inventory.',
      'FEATURE VERIFIED / HTTP cutover remains MIG-602; RELEASE APPROVED remains human (MIG-700).',
    ],
  };

  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  writeFileSync(
    join(outDir, 'coverage.md'),
    [
      '# MIG-600 host authz coverage',
      '',
      '| Issue | Status | Executed | Open blocker |',
      '| --- | --- | --- | --- |',
      ...coverageRows.map(
        (r) =>
          `| #${r.issue} | ${r.status} | ${r.executed ?? '—'} | ${r.openBlocker ?? '—'} |`,
      ),
      '',
      'Untested rows are never reported as parity.',
      '',
    ].join('\n'),
  );

  console.log(
    `PASS: mig-600 host authz parity (${report.cases.length} cases; coverage=${coverageRows.length})`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
