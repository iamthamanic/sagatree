#!/usr/bin/env node
/**
 * Idempotent GitHub sync for the 90 canonical migration issue contracts.
 * Reads issue-publish-plan.json + rendered design bodies; updates title/body/labels only.
 * Does not create issues, delete comments, or invent new identities.
 *
 * Usage:
 *   node scripts/stack-migration-issue-publish.mjs --dry-run
 *   node scripts/stack-migration-issue-publish.mjs --write
 *   node scripts/stack-migration-issue-publish.mjs --write --verify
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { baselineSha, buildMigrationPlan, publishEntry } from './stack-migration-issue-rendering.mjs';
import { validatePublicationEntry } from './stack-migration-publish-payload.mjs';
import { migrationRepository } from './stack-migration-identities.mjs';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const evidence = '.qa/evidence/stack-migration-prep';
const write = process.argv.includes('--write');
const verify = process.argv.includes('--verify');
const dryRun = !write;

function ghJson(args) {
  const out = execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(out);
}

function setEqual(left, right) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

const previous = read('.qa/intake/local-first-stack-migration-issues.json');
const registry = read(`${evidence}/published-issue-registry.json`);
const { intake } = buildMigrationPlan({
  previous,
  registry,
  rpcInventory: read('.qa/intake/rpc-contracts/inventory.json'),
  edgeInventory: read('.qa/intake/edge-infra-contracts/inventory.json'),
  splits: read('.qa/intake/rpc-contracts/split-groups.json'),
});
const byId = new Map(intake.issues.map((issue) => [issue.localId, issue]));
const manifest = read(`${evidence}/issue-publish-plan.json`);
const expectedManifest = {
  schemaVersion: 2,
  repository: migrationRepository,
  baselineSha,
  issues: intake.issues.map((issue) => publishEntry(issue, byId)),
};
if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest)) {
  throw new Error('issue-publish-plan.json drifts from reconstructed canonical contracts; run stack-migration-issue-contracts.mjs --write first');
}

const progress = {
  schemaVersion: 1,
  repository: migrationRepository,
  mode: write ? 'write' : 'dry-run',
  startedAt: new Date().toISOString(),
  total: manifest.issues.length,
  updated: 0,
  unchanged: 0,
  failed: [],
  issues: [],
};

for (const entry of manifest.issues) {
  const issue = byId.get(entry.localId);
  const body = readFileSync(entry.bodyFile, 'utf8');
  validatePublicationEntry({ repository: manifest.repository, entry, issue, byId, body });
  const remote = ghJson([
    'issue', 'view', String(entry.issueNumber),
    '--repo', migrationRepository,
    '--json', 'number,title,body,labels,state',
  ]);
  const remoteLabels = (remote.labels ?? []).map((label) => label.name).sort();
  const expectedLabels = [...entry.labels].sort();
  const titleOk = remote.title === entry.title;
  const bodyOk = remote.body === body;
  const labelsOk = setEqual(remoteLabels, expectedLabels);
  const row = {
    localId: entry.localId,
    number: entry.issueNumber,
    state: remote.state,
    titleOk,
    bodyOk,
    labelsOk,
    sha256: entry.sha256,
    action: 'none',
  };
  if (titleOk && bodyOk && labelsOk) {
    progress.unchanged += 1;
    row.action = 'unchanged';
  } else if (dryRun) {
    row.action = 'would-update';
    progress.updated += 1;
  } else {
    try {
      // Replace labels with the exact canonical set (removes stale runner/design labels).
      execFileSync('gh', [
        'issue', 'edit', String(entry.issueNumber),
        '--repo', migrationRepository,
        '--title', entry.title,
        '--body-file', entry.bodyFile,
        ...expectedLabels.flatMap((label) => ['--add-label', label]),
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      // gh cannot remove labels in one edit pass reliably across versions — reconcile removals.
      const stale = remoteLabels.filter((label) => !expectedLabels.includes(label));
      for (const label of stale) {
        execFileSync('gh', [
          'issue', 'edit', String(entry.issueNumber),
          '--repo', migrationRepository,
          '--remove-label', label,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
      }
      progress.updated += 1;
      row.action = 'updated';
    } catch (cause) {
      progress.failed.push({ number: entry.issueNumber, localId: entry.localId, error: String(cause?.stderr || cause.message || cause) });
      row.action = 'failed';
    }
  }
  progress.issues.push(row);
  process.stdout.write(`${row.action}\t#${row.number}\t${row.localId}\ttitle=${titleOk}\tbody=${bodyOk}\tlabels=${labelsOk}\n`);
}

progress.finishedAt = new Date().toISOString();
const receiptPath = `${evidence}/github-contract-sync.json`;

if (verify || write) {
  const mismatches = [];
  for (const entry of manifest.issues) {
    const remote = ghJson([
      'issue', 'view', String(entry.issueNumber),
      '--repo', migrationRepository,
      '--json', 'number,title,body,labels,state',
    ]);
    const body = readFileSync(entry.bodyFile, 'utf8');
    const remoteLabels = (remote.labels ?? []).map((label) => label.name).sort();
    const expectedLabels = [...entry.labels].sort();
    const ok = remote.title === entry.title && remote.body === body && setEqual(remoteLabels, expectedLabels);
    if (!ok) {
      mismatches.push({
        localId: entry.localId,
        number: entry.issueNumber,
        titleOk: remote.title === entry.title,
        bodyOk: remote.body === body,
        labelsOk: setEqual(remoteLabels, expectedLabels),
        state: remote.state,
      });
    }
  }
  const receipt = {
    schemaVersion: 2,
    repository: migrationRepository,
    status: mismatches.length === 0 ? 'synchronized-and-verified' : 'drift-detected',
    lastVerifiedAt: new Date().toISOString(),
    correctionOrder: '2026-10-23-readiness-evidence-sync',
    evidenceMeaning: 'Fresh verify after readiness classification (DONE/READY with completionEvidence). Not production cutover approval.',
    syncedCount: manifest.issues.length - mismatches.length,
    pendingCount: mismatches.length,
    focus: mismatches.slice(0, 20),
    mismatches,
    publishProgress: {
      updated: progress.updated,
      unchanged: progress.unchanged,
      failed: progress.failed.length,
      mode: progress.mode,
    },
  };
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  if (mismatches.length) {
    console.error(`sync verify failed: ${mismatches.length} mismatches`);
    process.exit(1);
  }
  console.log(`stack-migration-issue-publish: verified 90/90; receipt ${receiptPath}`);
}

writeFileSync(`${evidence}/issue-publish-progress-2026-10-23.json`, `${JSON.stringify(progress, null, 2)}\n`);
if (progress.failed.length) {
  console.error(`publish failures: ${progress.failed.length}`);
  process.exit(1);
}
console.log(`stack-migration-issue-publish: ${progress.mode} updated=${progress.updated} unchanged=${progress.unchanged} failed=${progress.failed.length}`);

if (import.meta.url === pathToFileURL(process.argv[1]).href && !existsSync(receiptPath) && dryRun) {
  // dry-run without --verify still exits 0 after printing the plan diff
}
