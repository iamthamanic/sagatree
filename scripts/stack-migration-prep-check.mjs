#!/usr/bin/env node
/** Fail-closed local preparation checks. No GitHub writes and no release approval. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateMigrationPlan } from './stack-migration-contract-validation.mjs';

const root = process.cwd();
const evidence = '.qa/evidence/stack-migration-prep';
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const cache = new Map();
const repoPath = (path) => typeof path === 'string' && resolve(root, path).startsWith(`${root}${sep}`) ? resolve(root, path) : null;
const io = {
  exists: (path) => Boolean(repoPath(path) && existsSync(repoPath(path))),
  read: (path) => {
    const absolute = repoPath(path);
    if (!absolute) throw new Error('Source reference escapes repository');
    if (!cache.has(absolute)) cache.set(absolute, readFileSync(absolute));
    return cache.get(absolute);
  },
};

const inputs = {
  intake: read('.qa/intake/local-first-stack-migration-issues.json'),
  issueMap: read(`${evidence}/github-issue-map.json`),
  dependencyPlan: read(`${evidence}/dependency-enforcement-plan.json`),
  registry: read(`${evidence}/published-issue-registry.json`),
  rpcInventory: read('.qa/intake/rpc-contracts/inventory.json'),
  edgeInventory: read('.qa/intake/edge-infra-contracts/inventory.json'),
  approvals: read(`${evidence}/architecture-approvals.json`),
};
const result = validateMigrationPlan(inputs, io);
if (result.errors.length) {
  console.error(`stack-migration-prep-check: FAIL (${result.errors.length})\n${result.errors.map((entry) => `- ${entry}`).join('\n')}`);
  process.exit(1);
}
// A valid JSON plan is insufficient if GitHub bodies, design files or reports drift.
execFileSync(process.execPath, ['scripts/stack-migration-issue-contracts.mjs'], { stdio: 'inherit' });
// Fingerprints do not bind derived signatures, overloads or caller coverage.
// Recompute those facts from the actual AST and pinned PostgreSQL parser.
const python = process.env.STACK_MIGRATION_PYTHON || 'python3';
execFileSync(process.execPath, ['scripts/stack-migration-rpc-callers.mjs', '--check'], { stdio: 'inherit' });
for (const script of ['verify-postgres', 'extract', 'docs']) execFileSync(python, [`scripts/stack-migration-rpc-${script}.py`, '--check'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/stack-migration-edge-source-contracts.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/stack-migration-edge-contracts.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/stack-migration-contract-validation.test.mjs'], { stdio: 'inherit' });
console.log(`stack-migration-prep-check: PASS (contracts=${inputs.intake.issues.length}, RPC=${inputs.rpcInventory.rpcs.length}, Edge=${inputs.edgeInventory.edges.length}, Infra=${inputs.edgeInventory.infrastructure.length}; execution-blocked=${result.warnings.length}; architecture-approved=0)`);
console.log('Scope: local structure, source-derived RPC/Edge contracts, checked fingerprints and regression tests. This is not deployed-state verification, implementation acceptance, or cutover approval.');
