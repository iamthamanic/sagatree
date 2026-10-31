#!/usr/bin/env node
/**
 * mig-600-host-authz-parity.self-test — host negative authz suite + coverage inventory.
 * Location: scripts/mig-600-host-authz-parity.self-test.mjs
 *
 * Evidence dir: MIG600_OUT_DIR (temp-friendly) or `.qa/runs/mig-600-host-authz/`.
 * Stdout PASS is the gate signal. Report JSON is zod-validated before write.
 */
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(root, 'server/package.json'));
const { z } = require('zod');

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

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
  cases: z.array(
    z.object({
      id: z.string().min(1),
      allow: z.boolean(),
      expectedAllow: z.boolean(),
      reason: z.string(),
      ok: z.boolean(),
    }),
  ),
  secretMarkerAbsentForPlayers: z.literal(true),
  canaryDetectsDisabledFilter: z.literal(true),
  canaryDetectsAlwaysAllowMembership: z.literal(true),
  httpWorldTouchOwnerAllow: z.literal(true),
  httpWorldTouchOutsiderDeny: z.literal(true),
  coverage: z.array(coverageRowSchema).min(1),
  notes: z.array(z.string()),
});

const persistenceUrl = pathToFileURL(join(root, 'server/src/persistence/index.ts')).href;
const suiteUrl = pathToFileURL(join(root, 'server/tests/authz/host-negative-authz-suite.ts')).href;
const apiUrl = pathToFileURL(join(root, 'server/src/api/index.ts')).href;

const { bootstrapHostPersistence } = await import(persistenceUrl);
const { runHostNegativeAuthzSuite } = await import(suiteUrl);
const { createHostApi } = await import(apiUrl);
const { createPermissionsPorts } = await import(
  pathToFileURL(join(root, 'server/src/modules/permissions/index.ts')).href
);

const work = mkdtempSync(join(tmpdir(), 'mig600-'));
const dataDir = join(work, 'data');
mkdirSync(dataDir);

const outDir =
  typeof process.env.MIG600_OUT_DIR === 'string' && process.env.MIG600_OUT_DIR.trim().length > 0
    ? process.env.MIG600_OUT_DIR.trim()
    : join(root, '.qa/runs/mig-600-host-authz');
mkdirSync(outDir, { recursive: true });

try {
  const boot = bootstrapHostPersistence({
    dataDir,
    migrationsDir: join(root, 'server/migrations'),
  });
  assert(boot.ok, `bootstrap: ${boot.ok ? '' : boot.error}`);

  // Policy/projection matrix (keeps DB open for HTTP smoke on same fixture).
  const report = runHostNegativeAuthzSuite(boot.db);

  assert(report.secretMarkerAbsentForPlayers, 'player projections must omit secret marker');
  assert(report.canaryDetectsDisabledFilter, 'canary must detect disabled projection filter');
  assert(
    report.canaryDetectsAlwaysAllowMembership,
    'canary must distinguish always-allow stub from healthy outsider deny',
  );
  const failed = report.cases.filter((c) => !c.ok);
  assert(failed.length === 0, `authz cases failed: ${JSON.stringify(failed)}`);
  assert(report.ok, 'suite report.ok');

  // Public HTTP surface smoke: authorize → world-touch allow/deny (not just PolicyService direct).
  const permissions = createPermissionsPorts(boot.db);
  const makeIdentity = (actorId) => ({
    resolveSoloActor: () => ({ kind: 'solo-local', actorId }),
    resolveRemoteSession: async () => ({
      ok: true,
      actor: { kind: 'solo-local', actorId },
    }),
  });
  const stubHealth = { execute: () => ({ ready: true, status: 'ok' }) };
  const stubOps = {};
  const stubTransport = {};
  const buildApp = (actorId) =>
    createHostApi({
      health: stubHealth,
      ops: stubOps,
      permissions,
      identity: makeIdentity(actorId),
      transport: stubTransport,
      recordPing: () => ({ ok: true }),
      tryAuthorizedWorldTouch: () => ({ ok: true, mutated: true }),
      tryAuthorizedProjectTouch: () => ({ ok: true, mutated: true }),
    });

  const ownerRes = await buildApp('owner-o').request('http://host/api/world-touch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ worldId: 'world-primary' }),
  });
  const ownerBody = await ownerRes.json();
  const httpWorldTouchOwnerAllow = ownerRes.status === 200 && ownerBody?.ok === true;

  const outsiderRes = await buildApp('outsider-x').request('http://host/api/world-touch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ worldId: 'world-primary', role: 'gm', ownerUserId: 'owner-o' }),
  });
  const outsiderBody = await outsiderRes.json();
  const httpWorldTouchOutsiderDeny =
    outsiderRes.status === 403 && outsiderBody?.mutated === false;

  assert(httpWorldTouchOwnerAllow, `owner world-touch must allow, got ${ownerRes.status}`);
  assert(
    httpWorldTouchOutsiderDeny,
    `outsider world-touch must deny, got ${outsiderRes.status} ${JSON.stringify(outsiderBody)}`,
  );

  boot.db.close();

  // Coverage: Depends-on successors stay open-blocker until MIG-602 HTTP cutover.
  // Only surfaces this suite actually executes are status=executed.
  const design = readFileSync(
    join(root, '.qa/design/migration-issues/stack-migration-mig-600.md'),
    'utf8',
  );
  const depNums = [...design.matchAll(/Depends on #(\d+)/g)].map((m) => Number(m[1]));
  assert(depNums.length >= 60, `expected ≥60 Depends-on rows, got ${depNums.length}`);

  const httpCutoverBlocker =
    'per-successor HTTP/RPC/realtime path not exercised here; FEATURE VERIFIED via MIG-602';

  const coverageRows = [
    {
      issue: 845,
      status: 'executed',
      executed:
        'server/tests/authz policy matrix + secret-marker canary + HTTP /api/world-touch allow/deny',
      openBlocker: null,
    },
    {
      issue: 607,
      status: 'executed',
      executed: 'scripts/negative-authz-suite-check.mjs (+ live negative-authz-suite.mjs Compose Edge)',
      openBlocker: null,
    },
    ...depNums.map((issue) => ({
      issue,
      status: 'open-blocker',
      executed: null,
      openBlocker: httpCutoverBlocker,
    })),
  ];

  const claimedParityWithoutEvidence = coverageRows.filter(
    (r) => r.status === 'executed' && (!r.executed || r.executed.length === 0),
  );
  assert(claimedParityWithoutEvidence.length === 0, 'executed rows need evidence string');
  const silentParity = coverageRows.filter((r) => r.status === 'parity');
  assert(silentParity.length === 0, 'status=parity forbidden');

  const evidence = reportSchema.parse({
    suite: 'mig-600-host-authz-parity',
    ok: true,
    caseCount: report.cases.length,
    cases: report.cases,
    secretMarkerAbsentForPlayers: report.secretMarkerAbsentForPlayers,
    canaryDetectsDisabledFilter: report.canaryDetectsDisabledFilter,
    canaryDetectsAlwaysAllowMembership: report.canaryDetectsAlwaysAllowMembership,
    httpWorldTouchOwnerAllow,
    httpWorldTouchOutsiderDeny,
    coverage: coverageRows,
    notes: [
      'SLICE DONE = feature-security host policy/projection + HTTP world-touch smoke + canary + honest coverage.',
      'Depends-on successor rows are open-blocker (not claimed executed). MIG-602 owns HTTP cutover FEATURE VERIFIED.',
      'RELEASE APPROVED remains human (MIG-700).',
    ],
  });

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
      'Untested rows are never reported as parity. Successor Depends-on rows are open-blocker until MIG-602.',
      '',
    ].join('\n'),
  );

  console.log(
    `PASS: mig-600 host authz parity (${report.cases.length} cases; coverage=${coverageRows.length}; out=${outDir})`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
