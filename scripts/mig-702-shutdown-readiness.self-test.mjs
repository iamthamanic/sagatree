#!/usr/bin/env node
/**
 * mig-702-shutdown-readiness.self-test — Dornhain Supabase shutdown gate (#851).
 * Location: scripts/mig-702-shutdown-readiness.self-test.mjs
 */
import { mkdtempSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
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
      repoRoot: root,
      predecessors: [
        {
          localId: 'MIG-700',
          completionEvidencePath: 'x',
          result: 'PASS',
          evidenceExists: true,
          evidenceSha256: 'a'.repeat(64),
        },
        {
          localId: 'MIG-701',
          completionEvidencePath: 'x',
          result: 'PASS',
          evidenceExists: true,
          evidenceSha256: 'b'.repeat(64),
        },
        {
          localId: 'ATLAS-LIVE-E2E',
          completionEvidencePath: 'x',
          result: 'PASS',
          evidenceExists: true,
          evidenceSha256: 'c'.repeat(64),
        },
        {
          localId: 'MIG-603',
          completionEvidencePath: 'x',
          result: 'PASS',
          evidenceExists: true,
          evidenceSha256: 'd'.repeat(64),
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
    drill.blockedWithoutEvidence.blockers.some(
      (b) => b.code === 'missing-predecessor-evidence',
    ),
    'label spoof blocked',
  );

  assert(!drill.blockedEmptyMatrix.shutdownReady, 'empty matrix → blocked');
  assert(
    drill.blockedEmptyMatrix.blockers.some((b) => b.code === 'empty-call-matrix'),
    'empty-call-matrix',
  );

  assert(!drill.blockedWithSupabaseLeftover.shutdownReady, 'supabase leftover → blocked');
  assert(drill.blockedWithSupabaseLeftover.supabaseBlockerCount >= 1, 'supabase count');

  assert(!drill.blockedBrokenCatalog.shutdownReady, 'broken catalog → blocked');

  assert(drill.readyWithFreigabe.shutdownReady, 'full proof → shutdownReady');
  assert(
    drill.readyWithFreigabe.productiveShutdownAuthorized,
    'Freigabe → productive authorized',
  );
  assert(drill.readyWithFreigabe.catalogIntact, 'Dornhain catalog intact');
  assert(drill.readyWithFreigabe.boundRelease?.releaseId === 'CUTOVER-DORHAIN', 'bound release');

  assert(drill.archive.sha256.length === 64, 'archive sha256');
  assert(drill.archive.approval?.evidenceFile, 'archive stores approval path');
  assert(existsSync(archiveDir), 'archive dir');
  const files = readdirSync(archiveDir).filter((f) => f.startsWith('shutdown-decision-'));
  assert(files.length >= 1, 'shutdown decision archived');
  const { z } = await import('zod');
  const archiveSchema = z.object({
    approval: z.object({
      actor: z.string().min(1),
      evidenceFile: z.string().min(1),
      releaseId: z.literal('CUTOVER-DORHAIN'),
      status: z.literal('APPROVED_DRILL_AND_SHUTDOWN_AFTER_PROOF'),
    }),
  });
  const archived = archiveSchema.parse(
    JSON.parse(readFileSync(join(archiveDir, files[0]), 'utf8')),
  );
  assert(archived.approval.actor === 'iamthamanic', 'archive actor');
  assert(
    archived.approval.evidenceFile ===
      'docs/architecture/migration-owner-release-2026-11-01-dornhain.md',
    'archive Freigabe path',
  );

  console.log('PASS: mig-702-shutdown-readiness.self-test');
} finally {
  rmSync(archiveDir, { recursive: true, force: true });
}
