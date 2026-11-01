#!/usr/bin/env node
/**
 * mig-703-tauri-integration.self-test — desktop unlock + lifecycle + bridge (#852).
 * Location: scripts/mig-703-tauri-integration.self-test.mjs
 *
 * Same shape as MIG-700/701/702 self-tests: wired into `npm run test-gate`.
 * Lifecycle intentionally exercises the real gate-05 sidecar stand-in on the
 * current host (other platforms stay NOT RUN).
 */
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

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
  createDefaultFsModeHooks,
  archiveSchema,
} = await import(desktopUrl);

// 1) Without APPROVED → blocked
{
  const fakeRoot = mkdtempSync(join(tmpdir(), 'mig703-locked-'));
  const approvalsDir = join(fakeRoot, '.qa/evidence/stack-migration-prep');
  mkdirSync(approvalsDir, { recursive: true });
  const adrRel = 'docs/architecture/ADR-ST-09-gate-05-tauri-sidecar.md';
  mkdirSync(join(fakeRoot, 'docs/architecture'), { recursive: true });
  writeFileSync(join(fakeRoot, adrRel), '# fake adr\n');
  writeFileSync(
    join(approvalsDir, 'architecture-approvals.json'),
    `${JSON.stringify(
      {
        decisions: {
          'GATE-05': {
            status: 'APPROVED_TO_EXECUTE',
            actorType: 'human',
            actor: 'iamthamanic',
            evidenceFile: adrRel,
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

// Directory / traversal / absolute evidence must not unlock
{
  const fakeRoot = mkdtempSync(join(tmpdir(), 'mig703-evil-evidence-'));
  const outsideDir = mkdtempSync(join(tmpdir(), 'mig703-outside-'));
  const outsideFile = join(outsideDir, 'outside.md');
  writeFileSync(outsideFile, '# outside\n');
  const approvalsDir = join(fakeRoot, '.qa/evidence/stack-migration-prep');
  mkdirSync(approvalsDir, { recursive: true });
  mkdirSync(join(fakeRoot, 'docs'), { recursive: true });

  const writeApprovals = (evidenceFile) => {
    writeFileSync(
      join(approvalsDir, 'architecture-approvals.json'),
      `${JSON.stringify(
        {
          decisions: {
            'GATE-05': {
              status: 'APPROVED',
              actorType: 'human',
              actor: 'iamthamanic',
              evidenceFile,
            },
          },
        },
        null,
        2,
      )}\n`,
    );
  };

  writeApprovals('docs');
  assert(!evaluateDesktopUnlock({ repoRoot: fakeRoot }).unlocked, 'directory evidenceFile must not unlock');

  // Sibling escape: file next to fakeRoot referenced via ../
  const sibling = join(fakeRoot, '..', `mig703-sibling-${process.pid}.md`);
  writeFileSync(sibling, '# sibling\n');
  writeApprovals(`../${basename(sibling)}`);
  assert(!evaluateDesktopUnlock({ repoRoot: fakeRoot }).unlocked, 'relative traversal evidence must not unlock');

  writeApprovals(outsideFile);
  assert(!evaluateDesktopUnlock({ repoRoot: fakeRoot }).unlocked, 'absolute evidence path must not unlock');

  rmSync(sibling, { force: true });
  rmSync(fakeRoot, { recursive: true, force: true });
  rmSync(outsideDir, { recursive: true, force: true });
}

{
  const unlocked = evaluateDesktopUnlock({ repoRoot: root });
  assert(unlocked.unlocked, `expected unlock: ${unlocked.blocker}`);
  assert(unlocked.gate05Status === 'APPROVED', 'GATE-05 APPROVED');
}

// 2) Bridge negatives — trusted context is separate from payload
{
  const foreign = handleBridgeMessage(
    { op: 'host.health', nonce: 'abcdefgh' },
    { origin: 'https://evil.example', expectedNonce: 'abcdefgh' },
  );
  assert(!foreign.ok && foreign.code === 'foreign-origin', 'foreign origin denied');

  const manipulated = handleBridgeMessage(
    { op: 'host.health', nonce: 'abcdefgh' },
    { origin: 'tauri://localhost', expectedNonce: 'zzzzzzzz' },
  );
  assert(!manipulated.ok && manipulated.code === 'manipulated-message', 'nonce mismatch denied');

  // Caller cannot self-attest by putting expectedNonce in the payload
  const selfAttest = handleBridgeMessage(
    { op: 'host.health', nonce: 'abcdefgh', expectedNonce: 'abcdefgh', origin: 'tauri://localhost' },
    { origin: 'https://evil.example', expectedNonce: 'host-issued-nonce-01' },
  );
  assert(!selfAttest.ok, 'payload cannot supply trusted origin/nonce');

  const unknown = handleBridgeMessage(
    { op: 'host.shell.exec', nonce: 'abcdefgh' },
    { origin: 'tauri://localhost', expectedNonce: 'abcdefgh' },
  );
  assert(!unknown.ok && unknown.code === 'unknown-op', 'unknown op denied');

  const ok = handleBridgeMessage(
    { op: 'host.health', nonce: 'abcdefgh' },
    { origin: 'http://localhost:1420', expectedNonce: 'abcdefgh' },
  );
  assert(ok.ok && ok.op === 'host.health', 'allowlisted op on localhost:port ok');

  for (const badOrigin of ['tauri:', 'tauri:opaque']) {
    const denied = handleBridgeMessage(
      { op: 'host.health', nonce: 'abcdefgh' },
      { origin: badOrigin, expectedNonce: 'abcdefgh' },
    );
    assert(
      !denied.ok && denied.code === 'foreign-origin',
      `host-less ${badOrigin} must be foreign-origin`,
    );
  }
}

// Update-rollback FAIL / NOT RUN via injectable FS hooks (no production sabotage switch)
{
  const failWork = mkdtempSync(join(tmpdir(), 'mig703-fail-'));
  try {
    const stored = new Map();
    let chmodCount = 0;
    const failingHooks = {
      supportsPosixModes: true,
      chmod: (path, mode) => {
        stored.set(path, mode);
        chmodCount += 1;
      },
      modeOf: (path) => {
        // Sequence: 2 initial + 2 corrupt + 2 restore = 6. Lie only after restore.
        if (chmodCount >= 6) return 0o666;
        return stored.get(path) ?? 0o600;
      },
    };
    const failed = runUpdateRollbackDrill({ workDir: failWork, fsHooks: failingHooks });
    assert(!failed.ok, 'injected mode mismatch must yield ok=false');
    assert(failed.modeCheck === 'FAIL', 'modeCheck FAIL via injected hooks');
    const archived = archiveSchema.parse(JSON.parse(readFileSync(failed.archivePath, 'utf8')));
    assert(archived.result === 'fail', 'archive records fail');
  } finally {
    cleanupWorkDir(failWork);
  }
}

{
  const winWork = mkdtempSync(join(tmpdir(), 'mig703-win-'));
  try {
    const winish = createDefaultFsModeHooks('win32');
    const report = runUpdateRollbackDrill({ workDir: winWork, fsHooks: winish });
    assert(report.ok, 'win32-hooks drill still restores JSON permissions');
    assert(report.modeCheck === 'NOT RUN', 'win32-hooks modeCheck is honest NOT RUN');
  } finally {
    cleanupWorkDir(winWork);
  }
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
  assert(rollback.modeCheck !== 'FAIL', 'filesystem modes PASS or honest NOT RUN on win32');
  if (createDefaultFsModeHooks().supportsPosixModes) {
    assert(rollback.modeCheck === 'PASS', 'POSIX filesystem modes restored');
  } else {
    assert(rollback.modeCheck === 'NOT RUN', 'win32 mode check stays NOT RUN');
  }
  const archived = archiveSchema.parse(JSON.parse(readFileSync(rollback.archivePath, 'utf8')));
  assert(archived.result === 'rollback-ok', 'archive records rollback-ok');
} finally {
  cleanupWorkDir(work);
}

console.log('PASS: mig-703-tauri-integration.self-test');
