#!/usr/bin/env node
/**
 * mig-703-tauri-integration.self-test — desktop unlock + lifecycle + bridge (#852).
 * Location: scripts/mig-703-tauri-integration.self-test.mjs
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
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

const desktopUrl = pathToFileURL(join(root, 'desktop/src/index.ts')).href;
const {
  evaluateDesktopUnlock,
  handleBridgeMessage,
  runPlatformLifecycleMatrix,
  runUpdateRollbackDrill,
  cleanupWorkDir,
} = await import(desktopUrl);

// 1) Without APPROVED → blocked (acceptance: no side-effect Tauri from earlier waves)
{
  const fakeRoot = mkdtempSync(join(tmpdir(), 'mig703-locked-'));
  const approvalsDir = join(fakeRoot, '.qa/evidence/stack-migration-prep');
  mkdirSync(approvalsDir, { recursive: true });
  writeFileSync(
    join(approvalsDir, 'architecture-approvals.json'),
    `${JSON.stringify(
      {
        decisions: {
          'GATE-05': {
            status: 'APPROVED_TO_EXECUTE',
            actorType: 'human',
            actor: 'iamthamanic',
            evidenceFile: 'docs/architecture/ADR-ST-09-gate-05-tauri-sidecar.md',
          },
        },
      },
      null,
      2,
    )}\n`,
  );
  const locked = evaluateDesktopUnlock({ repoRoot: fakeRoot });
  assert(!locked.unlocked, 'APPROVED_TO_EXECUTE alone must not unlock MIG-703 desktop');
  assert(locked.blocker && /APPROVED/.test(locked.blocker), 'blocker names APPROVED requirement');
  rmSync(fakeRoot, { recursive: true, force: true });
}

// With real repo APPROVED → unlocked
{
  const unlocked = evaluateDesktopUnlock({ repoRoot: root });
  assert(unlocked.unlocked, `expected unlock: ${unlocked.blocker}`);
  assert(unlocked.gate05Status === 'APPROVED', 'GATE-05 APPROVED');
}

// 2) Bridge negatives
{
  const foreign = handleBridgeMessage({
    origin: 'https://evil.example',
    op: 'host.health',
    nonce: 'abcdefgh',
    expectedNonce: 'abcdefgh',
  });
  assert(!foreign.ok && foreign.code === 'foreign-origin', 'foreign origin denied');

  const manipulated = handleBridgeMessage({
    origin: 'tauri://localhost',
    op: 'host.health',
    nonce: 'abcdefgh',
    expectedNonce: 'zzzzzzzz',
  });
  assert(!manipulated.ok && manipulated.code === 'manipulated-message', 'nonce mismatch denied');

  const unknown = handleBridgeMessage({
    origin: 'tauri://localhost',
    op: 'host.shell.exec',
    nonce: 'abcdefgh',
    expectedNonce: 'abcdefgh',
  });
  assert(!unknown.ok && unknown.code === 'unknown-op', 'unknown op denied');

  const ok = handleBridgeMessage({
    origin: 'tauri://localhost',
    op: 'host.health',
    nonce: 'abcdefgh',
    expectedNonce: 'abcdefgh',
  });
  assert(ok.ok && ok.op === 'host.health', 'allowlisted op ok');
}

// 3) Lifecycle matrix + update/rollback
const work = mkdtempSync(join(tmpdir(), 'mig703-life-'));
try {
  const matrix = await runPlatformLifecycleMatrix({ repoRoot: root });
  assert(matrix.length === 3, 'darwin/linux/win32 rows');
  const runRows = matrix.filter((r) => r.status === 'RUN');
  const notRun = matrix.filter((r) => r.status === 'NOT RUN');
  assert(runRows.length === 1, 'exactly one RUN platform on this host');
  assert(notRun.length === 2, 'other platforms remain NOT RUN open points');
  assert(
    runRows[0].startStop === 'PASS' &&
      runRows[0].restartPersistence === 'PASS' &&
      runRows[0].sidecarFailure === 'PASS',
    'RUN platform lifecycle PASS',
  );

  const rollback = runUpdateRollbackDrill({ workDir: work });
  assert(rollback.ok, 'update/rollback preserves host data + permissions');
  assert(rollback.beforeFingerprint === rollback.afterFingerprint, 'fingerprint restored');
  const archived = JSON.parse(readFileSync(rollback.archivePath, 'utf8'));
  assert(archived.result === 'rollback-ok', 'archive records rollback-ok');
} finally {
  cleanupWorkDir(work);
}

console.log('PASS: mig-703-tauri-integration.self-test');
