#!/usr/bin/env node
/**
 * composition-gate.self-test — squash/push freshness, evidence-only, stale proof, missing proof.
 * Location: scripts/composition-gate.self-test.mjs
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  analyze,
  computeHopDigest,
  evaluateCompositionGate,
} from './composition-gate.mjs';

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'comp-gate-test',
      GIT_AUTHOR_EMAIL: 'comp-gate@test',
      GIT_COMMITTER_NAME: 'comp-gate-test',
      GIT_COMMITTER_EMAIL: 'comp-gate@test',
    },
  }).trim();
}

function initRepo() {
  const cwd = mkdtempSync(join(tmpdir(), 'comp-gate-'));
  git(cwd, ['init']);
  git(cwd, ['checkout', '-b', 'main']);
  writeFileSync(join(cwd, 'README.md'), '# fixture\n');
  mkdirSync(join(cwd, 'server', 'src'), { recursive: true });
  writeFileSync(join(cwd, 'server', 'src', 'app.ts'), 'export const v = 1;\n');
  mkdirSync(join(cwd, '.qa', 'runs'), { recursive: true });
  git(cwd, ['add', '.']);
  git(cwd, ['commit', '-m', 'base']);
  return cwd;
}

function clearProof({ headSha, baseSha, hopDigest, slug = 'fixture' }) {
  const digestLine = hopDigest ? `- HOP_DIGEST: ${hopDigest}\n` : '';
  return `# Composition Gate — ${slug}

- HEAD_SHA: ${headSha}
- BASE_SHA: ${baseSha}
${digestLine}- Date: 2026-10-24
- Verdict: CLEAR

## Event

Authorized command crosses producer → persistence.

## Hop chain

1. Producer
2. Authorize
3. Persist
4. Consumer

## Simulations

### N-actors
One commit wins.

### Invalid/missing
Deny paths do not persist.

### Two consumers / crash
Crash leaves no orphan rows.

## Flags

None.
`;
}

function changed(cwd, base) {
  const out = git(cwd, ['diff', '--name-only', '--diff-filter=ACMR', `${base}..HEAD`, '--', '.']);
  return out ? out.split('\n').filter(Boolean) : [];
}

const root = new URL('..', import.meta.url).pathname;
const workspaces = [];

try {
  // --- 1) Evidence/docs-only: SKIPPED, no proof required ---
  {
    const cwd = initRepo();
    workspaces.push(cwd);
    const base = git(cwd, ['rev-parse', 'HEAD']);
    writeFileSync(join(cwd, '.qa', 'runs', 'note.md'), 'evidence only\n');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'evidence']);
    const head = git(cwd, ['rev-parse', 'HEAD']);
    const files = changed(cwd, base);
    assert(analyze(files).requiresProof === false, 'evidence-only must not require proof');
    const result = evaluateCompositionGate({
      baseSha: base,
      headSha: head,
      mode: 'push',
      files,
      cwd,
    });
    assert(result.status === 'SKIPPED', `evidence-only → SKIPPED, got ${result.status}`);
    console.log('PASS: evidence-only commit SKIPPED');
  }

  // --- 2) Backend without proof: FLAGGED ---
  {
    const cwd = initRepo();
    workspaces.push(cwd);
    const base = git(cwd, ['rev-parse', 'HEAD']);
    writeFileSync(join(cwd, 'server', 'src', 'app.ts'), 'export const v = 2;\n');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'backend no proof']);
    const head = git(cwd, ['rev-parse', 'HEAD']);
    const files = changed(cwd, base);
    const result = evaluateCompositionGate({
      baseSha: base,
      headSha: head,
      mode: 'push',
      files,
      cwd,
    });
    assert(result.status === 'FLAGGED', `backend without proof → FLAGGED, got ${result.status}`);
    console.log('PASS: backend without proof FLAGGED');
  }

  // --- 3) Stale proof (wrong BASE): FLAGGED ---
  {
    const cwd = initRepo();
    workspaces.push(cwd);
    const orphanBase = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const base = git(cwd, ['rev-parse', 'HEAD']);
    writeFileSync(join(cwd, 'server', 'src', 'app.ts'), 'export const v = 3;\n');
    const proofPath = join(cwd, '.qa', 'runs', 'composition-gate-stale.md');
    writeFileSync(
      proofPath,
      clearProof({ headSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', baseSha: orphanBase }),
    );
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'stale proof base']);
    const head = git(cwd, ['rev-parse', 'HEAD']);
    const files = changed(cwd, base);
    const result = evaluateCompositionGate({
      baseSha: base,
      headSha: head,
      mode: 'push',
      files,
      cwd,
    });
    assert(result.status === 'FLAGGED', `stale BASE proof → FLAGGED, got ${result.status}`);
    console.log('PASS: stale proof BASE FLAGGED');
  }

  // --- 4) Successful squash-style push: CLEAR (proof HEAD ≠ merge SHA, tip GC'd) ---
  {
    const cwd = initRepo();
    workspaces.push(cwd);
    const base = git(cwd, ['rev-parse', 'HEAD']);
    const proofPath = join(cwd, '.qa', 'runs', 'composition-gate-squash.md');

    git(cwd, ['checkout', '-b', 'pr-tip']);
    writeFileSync(join(cwd, 'server', 'src', 'app.ts'), 'export const v = 4;\n');
    writeFileSync(proofPath, clearProof({ headSha: base, baseSha: base }));
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'pr tip']);
    const prTip = git(cwd, ['rev-parse', 'HEAD']);
    writeFileSync(proofPath, clearProof({ headSha: prTip, baseSha: base }));
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'proof matches pr tip']);
    const prTipFinal = git(cwd, ['rev-parse', 'HEAD']);
    writeFileSync(proofPath, clearProof({ headSha: prTipFinal, baseSha: base }));
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'proof head exact']);
    const prRecorded = git(cwd, ['rev-parse', 'HEAD']);

    git(cwd, ['checkout', 'main']);
    git(cwd, ['merge', '--squash', 'pr-tip']);
    // Keep recorded proof HEAD as the (non-ancestor after squash) PR tip SHA,
    // and attest hop blobs so freshness survives tip GC.
    // Attest hop blobs so freshness survives tip GC (P1).
    const blob = git(cwd, ['hash-object', 'server/src/app.ts']);
    const hopDigest = createHash('sha256').update(`server/src/app.ts\0${blob}\n`).digest('hex');
    writeFileSync(
      proofPath,
      clearProof({ headSha: prRecorded, baseSha: base, hopDigest }),
    );
    git(cwd, ['add', '-A']);
    git(cwd, ['commit', '-m', 'squash merge (#999)']);
    const squashHead = git(cwd, ['rev-parse', 'HEAD']);
    const files = changed(cwd, base);
    const expectedDigest = computeHopDigest(squashHead, files, cwd);
    assert(expectedDigest === hopDigest, `hop digest must match staged blobs (${expectedDigest})`);

    let isAnc = true;
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', prRecorded, squashHead], {
        cwd,
        stdio: 'ignore',
      });
    } catch {
      isAnc = false;
    }
    assert(isAnc === false, 'squash HEAD must not have PR tip as ancestor');

    git(cwd, ['branch', '-D', 'pr-tip']);
    try {
      git(cwd, ['reflog', 'expire', '--expire=now', '--all']);
      git(cwd, ['gc', '--prune=now', '--quiet']);
    } catch {
      /* gc optional */
    }

    assert(files.some((f) => f.startsWith('server/')), 'squash includes backend');
    assert(
      files.includes('.qa/runs/composition-gate-squash.md'),
      'squash includes composition proof',
    );

    const result = evaluateCompositionGate({
      baseSha: base,
      headSha: squashHead,
      mode: 'push',
      files,
      cwd,
    });
    assert(result.status === 'CLEAR', `squash push with hop digest → CLEAR, got ${result.status}`);
    console.log('PASS: squash-merge push CLEAR');
  }

  // --- 4b) Squash without hop digest and tip GC'd → FLAGGED (P1 regression) ---
  {
    const cwd = initRepo();
    workspaces.push(cwd);
    const base = git(cwd, ['rev-parse', 'HEAD']);
    const proofPath = join(cwd, '.qa', 'runs', 'composition-gate-weak.md');
    git(cwd, ['checkout', '-b', 'pr-weak']);
    writeFileSync(join(cwd, 'server', 'src', 'app.ts'), 'export const v = 44;\n');
    writeFileSync(proofPath, clearProof({ headSha: base, baseSha: base }));
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'pr weak']);
    const tip = git(cwd, ['rev-parse', 'HEAD']);
    writeFileSync(proofPath, clearProof({ headSha: tip, baseSha: base }));
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'proof no digest']);
    const tip2 = git(cwd, ['rev-parse', 'HEAD']);
    git(cwd, ['checkout', 'main']);
    git(cwd, ['merge', '--squash', 'pr-weak']);
    writeFileSync(proofPath, clearProof({ headSha: tip2, baseSha: base }));
    git(cwd, ['add', '-A']);
    git(cwd, ['commit', '-m', 'squash weak']);
    const squashHead = git(cwd, ['rev-parse', 'HEAD']);
    git(cwd, ['branch', '-D', 'pr-weak']);
    try {
      git(cwd, ['reflog', 'expire', '--expire=now', '--all']);
      git(cwd, ['gc', '--prune=now', '--quiet']);
    } catch {
      /* optional */
    }
    const files = changed(cwd, base);
    const result = evaluateCompositionGate({
      baseSha: base,
      headSha: squashHead,
      mode: 'push',
      files,
      cwd,
    });
    assert(
      result.status === 'FLAGGED',
      `squash without digest after tip GC → FLAGGED, got ${result.status}`,
    );
    console.log('PASS: squash without hop digest FLAGGED after tip GC');
  }

  // --- 4c) Ancestral proof BASE (main advanced) + hop digest → CLEAR (P2) ---
  {
    const cwd = initRepo();
    workspaces.push(cwd);
    const proofBase = git(cwd, ['rev-parse', 'HEAD']);
    writeFileSync(join(cwd, 'README.md'), '# advanced\n');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'main advances']);
    const pushBefore = git(cwd, ['rev-parse', 'HEAD']);
    writeFileSync(join(cwd, 'server', 'src', 'app.ts'), 'export const v = 45;\n');
    const blob = git(cwd, ['hash-object', 'server/src/app.ts']);
    const hopDigest = createHash('sha256').update(`server/src/app.ts\0${blob}\n`).digest('hex');
    const proofPath = join(cwd, '.qa', 'runs', 'composition-gate-ancestor-base.md');
    writeFileSync(
      proofPath,
      clearProof({
        headSha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        baseSha: proofBase,
        hopDigest,
      }),
    );
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'squash with ancestral proof base']);
    const head = git(cwd, ['rev-parse', 'HEAD']);
    const files = changed(cwd, pushBefore);
    let isAnc = false;
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', proofBase, pushBefore], {
        cwd,
        stdio: 'ignore',
      });
      isAnc = true;
    } catch {
      isAnc = false;
    }
    assert(isAnc, 'setup: proof base must be ancestor of push-before');
    const result = evaluateCompositionGate({
      baseSha: pushBefore,
      headSha: head,
      mode: 'push',
      files,
      cwd,
    });
    assert(
      result.status === 'CLEAR',
      `ancestral BASE + hop digest → CLEAR, got ${result.status}`,
    );
    console.log('PASS: ancestral proof BASE with hop digest CLEAR');
  }

  // --- 5) PR mode still rejects missing proof HEAD (no silent GC path) ---
  {
    const cwd = initRepo();
    workspaces.push(cwd);
    const base = git(cwd, ['rev-parse', 'HEAD']);
    writeFileSync(join(cwd, 'server', 'src', 'app.ts'), 'export const v = 5;\n');
    const missingHead = 'dddddddddddddddddddddddddddddddddddddddd';
    writeFileSync(
      join(cwd, '.qa', 'runs', 'composition-gate-pr.md'),
      clearProof({ headSha: missingHead, baseSha: base }),
    );
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'pr with fake head']);
    const head = git(cwd, ['rev-parse', 'HEAD']);
    const files = changed(cwd, base);
    const result = evaluateCompositionGate({
      baseSha: base,
      headSha: head,
      mode: 'pull-request',
      files,
      cwd,
    });
    assert(result.status === 'FLAGGED', `PR mode fake HEAD → FLAGGED, got ${result.status}`);
    console.log('PASS: pull-request mode rejects unresolved proof HEAD');
  }

  // --- 6) Lineage path: proof HEAD is ancestor; only proof/QA files since ---
  {
    const cwd = initRepo();
    workspaces.push(cwd);
    const base = git(cwd, ['rev-parse', 'HEAD']);
    writeFileSync(join(cwd, 'server', 'src', 'app.ts'), 'export const v = 6;\n');
    const proofPath = join(cwd, '.qa', 'runs', 'composition-gate-exact.md');
    writeFileSync(proofPath, clearProof({ headSha: base, baseSha: base }));
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'backend + draft proof']);
    const codeHead = git(cwd, ['rev-parse', 'HEAD']);
    writeFileSync(proofPath, clearProof({ headSha: codeHead, baseSha: base }));
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'proof matches code head']);
    // Proof-only follow-up (acceptance note) while proof HEAD stays on codeHead.
    mkdirSync(join(cwd, '.qa', 'acceptance'), { recursive: true });
    writeFileSync(join(cwd, '.qa', 'acceptance', 'fixture.md'), 'ok\n');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'acceptance only']);
    const finalHead = git(cwd, ['rev-parse', 'HEAD']);
    const files = changed(cwd, base);
    const result = evaluateCompositionGate({
      baseSha: base,
      headSha: finalHead,
      mode: 'pull-request',
      files,
      cwd,
    });
    assert(
      result.status === 'CLEAR',
      `ancestor + proof-only refresh → CLEAR, got ${result.status}`,
    );
    console.log('PASS: PR merge lineage freshness CLEAR');
  }

  console.log('PASS: composition-gate.self-test');
} finally {
  for (const cwd of workspaces) {
    rmSync(cwd, { recursive: true, force: true });
  }
}

void root;
void pathToFileURL;
