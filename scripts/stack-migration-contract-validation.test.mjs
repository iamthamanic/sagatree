import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateMigrationPlan } from './stack-migration-contract-validation.mjs';
import { buildMigrationPlan, publishEntry, renderIssue } from './stack-migration-issue-rendering.mjs';
import { validatePublicationEntry } from './stack-migration-publish-payload.mjs';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const evidence = '.qa/evidence/stack-migration-prep';
const original = {
  intake: read('.qa/intake/local-first-stack-migration-issues.json'),
  issueMap: read(`${evidence}/github-issue-map.json`),
  dependencyPlan: read(`${evidence}/dependency-enforcement-plan.json`),
  registry: read(`${evidence}/published-issue-registry.json`),
  rpcInventory: read('.qa/intake/rpc-contracts/inventory.json'),
  edgeInventory: read('.qa/intake/edge-infra-contracts/inventory.json'),
  approvals: read(`${evidence}/architecture-approvals.json`),
};
const bytes = new Map();
const io = {
  exists: (path) => typeof path === 'string' && existsSync(resolve(path)),
  read: (path) => { if (!bytes.has(path)) bytes.set(path, readFileSync(path)); return bytes.get(path); },
};
const clone = () => structuredClone(original);
const issue = (input, id) => input.intake.issues.find((entry) => entry.localId === id);
const plan = (input, id) => input.dependencyPlan.plan.find((entry) => entry.localId === id);
const errors = (input, customIo = io) => validateMigrationPlan(input, customIo).errors;
const rejects = (input, pattern, customIo) => assert.ok(errors(input, customIo).some((entry) => pattern.test(entry)), `Expected ${pattern}; got ${errors(input, customIo).join('\n')}`);

function setStatus(input, id, status) {
  const current = issue(input, id);
  current.status = status;
  current.labels = current.labels.filter((label) => !['agent-ready', 'agent-blocked', 'needs-design'].includes(label));
  if (status === 'ready') current.labels.push('agent-ready');
  else if (status !== 'done') current.labels.push('agent-blocked');
  const target = plan(input, id);
  Object.assign(target, { status, runnerBlock: !['ready', 'done'].includes(status), labels: [...current.labels] });
  input.intake.coverage.issuesReady = input.intake.issues.filter((entry) => entry.status === 'ready').length;
  input.intake.coverage.issuesBlockedOrNeedsDesign = input.intake.issues.filter((entry) => ['blocked', 'needs-design'].includes(entry.status)).length;
}

test('the complete published plan validates without an implementation or architecture approval claim', () => {
  assert.deepEqual(errors(original), []);
  assert.equal(original.intake.coverage.legacyFrontendRpcs, 57);
  assert.equal(original.intake.issues.filter((entry) => entry.status === 'ready').length, 0);
});

test('rejects ready through blocked transitive predecessors even if labels and counts agree', () => {
  const input = clone(); setStatus(input, 'MIG-301', 'ready');
  rejects(input, /MIG-301: ready despite incomplete predecessor/);
});

test('rejects empty objects in text sections (old truthiness bypass)', () => {
  const input = clone(); issue(input, 'MIG-301').contractSections.sicherheit = {};
  rejects(input, /contractSections.sicherheit must be nonblank text/);
});

test('rejects whitespace-only sections', () => {
  const input = clone(); issue(input, 'MIG-301').contractSections.vorher = '  \n\t';
  rejects(input, /contractSections.vorher must be nonblank text/);
});

test('backticks do not turn generic boilerplate into behavioral acceptance', () => {
  const input = clone(); const target = issue(input, 'MIG-001');
  target.acceptance = ['No new TypeScript escape hatches `anything`', 'No escape hatches `another-thing`', 'Touched files: zero type escape hatches (typed-strict / Boy Scout).'];
  target.contractSections.tests = [...target.acceptance];
  rejects(input, /insufficient operation-specific criteria/);
});

test('MIG-002 has no special exception for incomplete baseline predecessors', () => {
  const input = clone(); setStatus(input, 'MIG-002', 'ready');
  rejects(input, /MIG-002: ready despite incomplete predecessor MIG-001/);
});

test('deleting an entire required issue is detected across both identity sets and topology', () => {
  const input = clone(); input.intake.issues = input.intake.issues.filter((entry) => entry.localId !== 'MIG-703');
  rejects(input, /missing required issue MIG-703/);
  rejects(input, /exactly the same IDs/);
  rejects(input, /topoOrder must include every issue exactly once/);
});

test('rejects negative GitHub issue numbers even when all copies agree', () => {
  const input = clone(); issue(input, 'MIG-301').githubIssue = -801;
  input.issueMap['MIG-301'] = -801; input.registry.issues['MIG-301'] = -801; plan(input, 'MIG-301').githubIssue = -801;
  rejects(input, /unique positive safe integers/);
});

test('rejects a changed source fingerprint instead of trusting source-verified text', () => {
  const input = clone(); input.edgeInventory.edges[0].verification.sourceFiles[0].sha256 = '0'.repeat(64);
  rejects(input, /source changed since verification/);
});

test('rejects missing operation-specific inventory tests', () => {
  const input = clone(); input.edgeInventory.edges.find((entry) => entry.function === 'session-media-token').requiredTests = [];
  rejects(input, /session-media-token: missing operation-specific tests/);
});

test('removing the typed dynamic RPC names is a coverage failure', () => {
  const input = clone(); input.rpcInventory.rpcs = input.rpcInventory.rpcs.filter((entry) => !entry.rpc.startsWith('promote_session_outcome_to_'));
  rejects(input, /RPC: inventory coverage must be exactly 57/);
});

test('duplicate RPC ownership across legacy coordinators fails', () => {
  const input = clone(); issue(input, 'MIG-352').rpcNames.push(issue(input, 'MIG-351').rpcNames[0]);
  rejects(input, /RPC cluster ownership must cover every RPC exactly once/);
});

test('deleting a child ticket cannot leave a falsely complete RPC plan', () => {
  const input = clone(); input.intake.issues = input.intake.issues.filter((entry) => entry.localId !== 'RPC-SESSION-ACCESS');
  rejects(input, /18 RPC child issues must own all 57 RPCs exactly once/);
});

test('an agent-authored approval cannot unlock a fully completed ancestor graph', () => {
  const input = clone();
  const mark = (id, visited = new Set()) => {
    if (visited.has(id)) return; visited.add(id);
    const entry = issue(input, id); for (const dep of entry.dependsOn) mark(dep, visited);
    setStatus(input, id, 'done'); entry.completionEvidence = '.qa/evidence/stack-migration-prep/baseline.md';
    if (id.startsWith('GATE-')) input.approvals.decisions[id] = { status: 'APPROVED', actorType: 'agent', actor: 'test-agent', sourceUrl: 'https://github.com/iamthamanic/sagatree/issues/773', evidenceFile: entry.completionEvidence };
  };
  for (const dep of issue(input, 'MIG-301').dependsOn) mark(dep);
  setStatus(input, 'MIG-301', 'ready');
  rejects(input, /missing explicit human architecture approval/);
});

test('a done label without completion evidence is not completion', () => {
  const input = clone(); setStatus(input, 'MIG-002', 'done');
  rejects(input, /MIG-002: done without completion evidence/);
});

test('desktop PoC cannot be moved before browser CI and operations', () => {
  const input = clone(); issue(input, 'GATE-05').dependsOn = ['MIG-001'];
  rejects(input, /Desktop PoC must be deferred/);
});

test('shutdown cannot lose Atlas or observation-window guards', () => {
  const input = clone(); issue(input, 'MIG-702').dependsOn = ['MIG-700'];
  rejects(input, /Supabase shutdown must retain Atlas and observation-window predecessors/);
});

test('cycles fail with explicit diagnostics rather than unbounded recursion', () => {
  const input = clone(); issue(input, 'MIG-001').dependsOn = ['MIG-301'];
  rejects(input, /dependency cycle/);
});

test('malformed dependency arrays fail closed', () => {
  const input = clone(); issue(input, 'MIG-301').dependsOn = { bogus: true };
  rejects(input, /dependsOn must contain unique nonempty IDs/);
});

test('nonexistent design and assertion sources fail', () => {
  const input = clone(); const target = issue(input, 'MIG-301');
  target.designFile = '.qa/design/nonexistent-migration-contract.md';
  target.assertions[0].sourceRefs = ['src/does-not-exist.ts'];
  rejects(input, /designFile must resolve/); rejects(input, /assertion source not found/);
});

test('coordinated removal of MIG-501 from every mutable inventory cannot redefine coverage', () => {
  const input = clone();
  input.intake.issues = input.intake.issues.filter((entry) => entry.localId !== 'MIG-501');
  delete input.issueMap['MIG-501']; delete input.registry.issues['MIG-501'];
  input.dependencyPlan.plan = input.dependencyPlan.plan.filter((entry) => entry.localId !== 'MIG-501');
  for (const entry of input.intake.issues) entry.dependsOn = entry.dependsOn.filter((id) => id !== 'MIG-501');
  rejects(input, /missing required issue MIG-501/);
  assert.throws(() => buildMigrationPlan({ previous: input.intake, ...input, splits: read('.qa/intake/rpc-contracts/split-groups.json') }), /reviewed 90 issue identities/);
});

test('all copies agreeing on a different positive GitHub number cannot redirect publication', () => {
  const input = clone(); const id = 'MIG-301';
  issue(input, id).githubIssue = 99999; input.issueMap[id] = 99999; input.registry.issues[id] = 99999; plan(input, id).githubIssue = 99999;
  rejects(input, /reviewed publication boundary/);
});

test('architecture approvals are checked while every ticket is blocked', () => {
  const input = clone();
  input.approvals.decisions['GATE-01'] = { status: 'APPROVED', actorType: 'agent', actor: 'test-agent', sourceUrl: 'not-a-url', evidenceFile: 'nonexistent' };
  rejects(input, /GATE-01: missing explicit human architecture approval/);
  rejects(input, /architecture approval is not authorized/);
});

test('a local human claim cannot change preparation authorization', () => {
  const input = clone();
  input.approvals.decisions['GATE-01'] = { status: 'APPROVED', actorType: 'human', actor: 'claimed-human', sourceUrl: 'https://github.com/iamthamanic/sagatree/issues/784#issuecomment-123', evidenceFile: 'AGENTS.md' };
  rejects(input, /architecture approval is not authorized/);
  setStatus(input, 'MIG-001', 'ready');
  rejects(input, /runner execution is not authorized/);
});

test('nonexistent completion evidence and unrelated existing prose are not acceptance', () => {
  const input = clone(); setStatus(input, 'MIG-002', 'done');
  issue(input, 'MIG-002').completionEvidence = 'nonexistent.json';
  rejects(input, /done without completion evidence/);
  issue(input, 'MIG-002').completionEvidence = 'AGENTS.md';
  rejects(input, /done without completion evidence/);
});

test('Edge prerequisites retain repository and internal Recap ownership', () => {
  const input = clone();
  issue(input, 'MIG-421').dependsOn = issue(input, 'MIG-421').dependsOn.filter((id) => !['MIG-012', 'RPC-SESSION-RECAP'].includes(id));
  rejects(input, /MIG-421: missing inventoried prerequisite MIG-012/);
  rejects(input, /MIG-421: missing inventoried prerequisite RPC-SESSION-RECAP/);
});

test('unknown internal RPC dependencies are not silently filtered from the graph', () => {
  const input = clone();
  input.edgeInventory.edges.find((entry) => entry.function === 'session-recap').rpcUsed.push('unknown_helper');
  rejects(input, /unmapped RPC dependency unknown_helper/);
});

test('publication binds labels, title, repository, issue number and content together', () => {
  const byId = new Map(original.intake.issues.map((entry) => [entry.localId, entry]));
  const current = byId.get('MIG-001');
  const base = { repository: original.registry.repository, entry: publishEntry(current, byId), issue: current, byId, body: renderIssue(current, byId) };
  assert.doesNotThrow(() => validatePublicationEntry(base));
  const mutations = [
    (value) => { value.entry.labels = value.entry.labels.map((label) => label === 'agent-blocked' ? 'agent-ready' : label); },
    (value) => { value.entry.title = 'Changed title'; },
    (value) => { value.repository = 'other/repository'; },
    (value) => { value.entry.issueNumber = 783; },
    (value) => { value.entry.bodyFile = 'AGENTS.md'; },
    (value) => { value.body += '\nChanged body'; },
  ];
  for (const mutate of mutations) { const value = structuredClone(base); mutate(value); assert.throws(() => validatePublicationEntry(value)); }
});

test('MIG-402/#818 preserves every requiredTest from both co-owned Edge contracts (no bullet-count truncation)', () => {
  const { intake } = buildMigrationPlan({
    previous: original.intake,
    registry: original.registry,
    rpcInventory: original.rpcInventory,
    edgeInventory: original.edgeInventory,
    splits: read('.qa/intake/rpc-contracts/split-groups.json'),
  });
  const mig402 = intake.issues.find((entry) => entry.localId === 'MIG-402');
  assert.ok(mig402, 'MIG-402 must exist');
  const creds = original.edgeInventory.edges.find((entry) => entry.function === 'ai-provider-credentials');
  const ollama = original.edgeInventory.edges.find((entry) => entry.function === 'ollama-settings');
  assert.equal(creds.implementationIssue, 818);
  assert.equal(ollama.implementationIssue, 818);
  const missing = [...creds.requiredTests, ...ollama.requiredTests].filter((test) => !mig402.acceptance.includes(test));
  assert.deepEqual(missing, [], `truncated requiredTests on MIG-402: ${missing.map((t) => t.slice(0, 60)).join(' | ')}`);
  assert.ok(mig402.acceptance.length >= creds.requiredTests.length + ollama.requiredTests.length + 1);
  const markers = [/429/, /rate|quota/i, /503|encryption|encrypt/i, /storage|persist/i, /apiKey|secret_ciphertext|hasApiKey/i];
  for (const marker of markers) {
    assert.ok(mig402.acceptance.some((line) => marker.test(line)), `MIG-402 acceptance must retain ${marker}`);
  }
  // Simulated truncation regression: capping co-owned tests must fail validation coverage.
  const input = clone();
  const target = issue(input, 'MIG-402');
  const kept = [...creds.requiredTests.slice(0, 2), ...ollama.requiredTests.slice(0, 2)];
  target.assertions = kept.map((then) => ({
    given: 'truncated fixture',
    when: 'truncated case',
    then,
    sourceRefs: ['.qa/intake/edge-infra-contracts/edge-ai-provider-credentials.md'],
  }));
  target.acceptance = [...kept, 'Touched files: zero type escape hatches (typed-strict / Boy Scout).'];
  target.contractSections.tests = [...target.acceptance];
  rejects(input, /MIG-402: missing binding Edge requiredTest/);
});
