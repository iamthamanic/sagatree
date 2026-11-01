#!/usr/bin/env node
/**
 * mig-702-shutdown-readiness.self-test — Dornhain Supabase shutdown gate (#851).
 * Location: scripts/mig-702-shutdown-readiness.self-test.mjs
 */
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname;

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const cutoverUrl = pathToFileURL(join(root, 'server/src/migration/cutover/index.ts')).href;
const {
  evaluateShutdownReadiness,
  runDornhainShutdownReadinessDrill,
} = await import(cutoverUrl);

const archiveDir = mkdtempSync(join(tmpdir(), 'mig702-shutdown-'));

try {
  // Unit: stranger permission negative fails closed
  {
    const report = evaluateShutdownReadiness({
      predecessors: [
        {
          localId: 'MIG-700',
          completionEvidencePath: 'x',
          result: 'PASS',
          evidenceExists: true,
        },
        {
          localId: 'MIG-701',
          completionEvidencePath: 'x',
          result: 'PASS',
          evidenceExists: true,
        },
        {
          localId: 'ATLAS-LIVE-E2E',
          completionEvidencePath: 'x',
          result: 'PASS',
          evidenceExists: true,
        },
        {
          localId: 'MIG-603',
          completionEvidencePath: 'x',
          result: 'PASS',
          evidenceExists: true,
        },
      ],
      callMatrix: [
        {
          operationId: 'host.ok',
          supabaseNetworkCall: false,
          successorVerified: true,
          humanApprovedRetirement: false,
        },
      ],
      restore: {
        catalogIntact: true,
        restoreDrillPass: true,
        archivePath: 'unit',
      },
      permission: {
        strangerUserId: 'stranger',
        strangerCanAuthorizeShutdown: true,
        ownerUserId: 'owner',
        ownerCanAuthorizeShutdown: true,
      },
      humanApproval: null,
    });
    assert(!report.shutdownReady, 'stranger auth must block');
    assert(
      report.blockers.some((b) => b.code === 'permission-negative-failed'),
      'permission-negative-failed',
    );
  }

  const drill = runDornhainShutdownReadinessDrill({
    repoRoot: root,
    archiveDir,
  });

  assert(!drill.blockedWithoutEvidence.shutdownReady, 'no evidence → blocked');
  assert(
    drill.blockedWithoutEvidence.blockers.every((b) =>
      b.detail.includes('agent-done label without completionEvidence'),
    ) ||
      drill.blockedWithoutEvidence.blockers.some(
        (b) => b.code === 'missing-predecessor-evidence',
      ),
    'label spoof blocked',
  );

  assert(!drill.blockedWithSupabaseLeftover.shutdownReady, 'supabase leftover → blocked');
  assert(drill.blockedWithSupabaseLeftover.supabaseBlockerCount >= 1, 'supabase count');

  assert(drill.readyWithFreigabe.shutdownReady, 'full proof → shutdownReady');
  assert(
    drill.readyWithFreigabe.productiveShutdownAuthorized,
    'Freigabe → productive authorized',
  );
  assert(drill.readyWithFreigabe.catalogIntact, 'Dornhain catalog intact');

  assert(drill.archive.sha256.length === 64, 'archive sha256');
  assert(existsSync(archiveDir), 'archive dir');
  const files = readdirSync(archiveDir).filter((f) => f.startsWith('shutdown-decision-'));
  assert(files.length >= 1, 'shutdown decision archived');

  console.log('PASS: mig-702-shutdown-readiness.self-test');
} finally {
  rmSync(archiveDir, { recursive: true, force: true });
}
