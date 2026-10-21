#!/usr/bin/env node
/** Read a canonical, metadata-bound payload. Does not call GitHub. */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { baselineSha, bodyHash, buildMigrationPlan, publishEntry } from './stack-migration-issue-rendering.mjs';
import { migrationIssueIdentities, migrationRepository, preparationAuthority } from './stack-migration-identities.mjs';

export function validatePublicationEntry({ repository, entry, issue, byId, body }) {
  if (repository !== migrationRepository || !issue || migrationIssueIdentities[issue.localId] !== entry.issueNumber) throw new Error('Publication target differs from the reviewed repository and issue identity');
  if (JSON.stringify(entry) !== JSON.stringify(publishEntry(issue, byId, repository))) throw new Error('Publication metadata or fingerprint differs from the canonical contract');
  if (!preparationAuthority.runnerExecution && (issue.status === 'ready' || entry.labels.includes('agent-ready'))) throw new Error('Publication cannot activate the migration runner');
  if (bodyHash(body) !== entry.sha256) throw new Error(`Issue #${entry.issueNumber} body changed after rendering`);
  if (body.length > 65536 || body.includes('#unpublished')) throw new Error('Issue body is not publishable');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const number = Number(process.argv[2]);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error('Expected a positive GitHub issue number');
  // Rebuild the expected complete plan first: changing manifest and intake together
  // cannot avoid the reviewed identity, status, dependency and rendering boundary.
  const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
  const evidence = '.qa/evidence/stack-migration-prep';
  const manifest = read(`${evidence}/issue-publish-plan.json`);
  const { intake } = buildMigrationPlan({
    previous: read('.qa/intake/local-first-stack-migration-issues.json'),
    registry: read(`${evidence}/published-issue-registry.json`),
    rpcInventory: read('.qa/intake/rpc-contracts/inventory.json'),
    edgeInventory: read('.qa/intake/edge-infra-contracts/inventory.json'),
    splits: read('.qa/intake/rpc-contracts/split-groups.json'),
  });
  const byId = new Map(intake.issues.map((issue) => [issue.localId, issue]));
  const expectedManifest = { schemaVersion: 2, repository: migrationRepository, baselineSha, issues: intake.issues.map((issue) => publishEntry(issue, byId)) };
  if (JSON.stringify(manifest) !== JSON.stringify(expectedManifest)) throw new Error('Publication manifest differs from the fully reconstructed canonical contracts');
  const entry = manifest.issues.find((issue) => issue.issueNumber === number);
  if (!entry) throw new Error(`Issue #${number} is outside the reviewed migration manifest`);
  const issue = byId.get(entry.localId);
  if (entry.bodyFile !== issue?.designFile) throw new Error('Publication body path differs from the canonical contract');
  const body = readFileSync(entry.bodyFile, 'utf8');
  validatePublicationEntry({ repository: manifest.repository, entry, issue, byId, body });
  console.log(JSON.stringify({ repository_full_name: manifest.repository, issue_number: number, title: entry.title, labels: entry.labels, body }));
}
