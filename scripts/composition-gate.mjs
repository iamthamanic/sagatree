#!/usr/bin/env node
/**
 * Composition Gate — requires a fresh CLEAR/SKIPPED proof when producer→consumer hops change.
 * Location: scripts/composition-gate.mjs
 *
 * Squash-merge note: PR tip SHAs are not ancestors of the squash commit on main.
 * Push/main-push modes therefore also accept a CLEAR proof whose BASE_SHA matches the
 * push-before parent and that landed in the same range as the hop-relevant product code
 * (optionally with hop blob equality when the recorded proof HEAD is still resolvable).
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const toolingFiles = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
]);

function git(args, cwd = root) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function hasRef(ref, cwd = root) {
  try {
    git(['cat-file', '-e', `${ref}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

function isZeroSha(value) {
  return !value || /^0+$/.test(value);
}

function isPushLikeMode(mode) {
  return mode === 'push' || mode === 'main-push-fallback' || mode === 'parent-fallback';
}

export function resolveRange(env = process.env, cwd = root) {
  const eventName = env.GITHUB_EVENT_NAME ?? '';
  const prBaseSha = env.COMPOSITION_GATE_PR_BASE_SHA ?? '';
  const pushBeforeSha = env.COMPOSITION_GATE_PUSH_BEFORE_SHA ?? '';

  if (eventName === 'pull_request' && !isZeroSha(prBaseSha) && hasRef(prBaseSha, cwd)) {
    try {
      return {
        base: git(['merge-base', 'HEAD', prBaseSha], cwd),
        mode: 'pull-request',
      };
    } catch {
      // Fall through when PR base is not an ancestor (shallow / rewritten history).
    }
  }

  if (eventName === 'push' && !isZeroSha(pushBeforeSha) && hasRef(pushBeforeSha, cwd)) {
    try {
      git(['diff', '--name-only', '--diff-filter=ACMR', `${pushBeforeSha}..HEAD`, '--', '.'], cwd);
      return { base: git(['rev-parse', pushBeforeSha], cwd), mode: 'push' };
    } catch {
      // github.event.before can point at a replaced tip not present in this clone.
    }
  }

  const baseRef = env.GITHUB_BASE_REF ?? '';
  const currentRef = env.GITHUB_REF_NAME ?? '';

  if (baseRef && hasRef(`origin/${baseRef}`, cwd)) {
    return {
      base: git(['merge-base', 'HEAD', `origin/${baseRef}`], cwd),
      mode: 'pull-request-fallback',
    };
  }

  if (currentRef === 'main' && hasRef('HEAD^', cwd)) {
    return { base: git(['rev-parse', 'HEAD^'], cwd), mode: 'main-push-fallback' };
  }

  if (hasRef('origin/main', cwd)) {
    return {
      base: git(['merge-base', 'HEAD', 'origin/main'], cwd),
      mode: 'branch-fallback',
    };
  }

  if (hasRef('main', cwd)) {
    return {
      base: git(['merge-base', 'HEAD', 'main'], cwd),
      mode: 'local-main-fallback',
    };
  }

  if (hasRef('HEAD^', cwd)) {
    return { base: git(['rev-parse', 'HEAD^'], cwd), mode: 'parent-fallback' };
  }

  return undefined;
}

export function changedFiles(base, cwd = root) {
  try {
    const output = git(['diff', '--name-only', '--diff-filter=ACMR', `${base}..HEAD`, '--', '.'], cwd);
    return output ? output.split('\n').filter(Boolean) : [];
  } catch (error) {
    throw new Error(
      `Composition Gate could not list changes for ${base}..HEAD: ${error instanceof Error ? error.message : error}`,
    );
  }
}

function isToolingOrDocs(path) {
  if (path.startsWith('.qa/')) return true;
  if (path.startsWith('.github/')) return true;
  if (path.startsWith('scripts/')) return true;
  if (path.endsWith('.md')) return true;
  return toolingFiles.has(path);
}

function classify(path) {
  const zones = new Set();

  if (/^(supabase\/functions|src\/supabase\/functions|server|api)\//.test(path)) {
    zones.add('backend');
  }
  if (/(^|\/)(migrations?|schema|database)(\/|$)|\.sql$/i.test(path)) {
    zones.add('persistence');
  }
  if (/(^|\/)services?\//i.test(path)) zones.add('service');
  if (path.startsWith('src/components/') || /\.tsx$/.test(path)) zones.add('ui');
  if (/(worker|outbox|queue|webhook|cron|notification|mailer|email)/i.test(path)) {
    zones.add('side-effect');
  }

  const moduleMatch = path.match(/^src\/modules\/([^/]+)\//);
  if (moduleMatch) zones.add(`domain:${moduleMatch[1]}`);

  return zones;
}

export function analyze(files) {
  if (files.length === 0) {
    return { requiresProof: false, reason: 'no changed files', zones: [] };
  }

  if (files.every(isToolingOrDocs)) {
    return {
      requiresProof: false,
      reason: 'tooling/docs/QA-only diff; no business event hop chain',
      zones: ['tooling'],
    };
  }

  const zones = new Set();
  for (const file of files) {
    for (const zone of classify(file)) zones.add(zone);
  }

  const domainZones = [...zones].filter((zone) => zone.startsWith('domain:'));
  const hasSideEffect = zones.has('side-effect');
  const hasService = zones.has('service');
  const hasBackendOrPersistence = zones.has('backend') || zones.has('persistence');
  const crossesDomains = domainZones.length > 1;

  if (hasSideEffect) {
    return {
      requiresProof: true,
      reason: 'side-effect/worker/webhook/queue-style path changed',
      zones: [...zones],
    };
  }

  if (hasService || hasBackendOrPersistence) {
    return {
      requiresProof: true,
      reason: 'service, backend, or persistence hop changed',
      zones: [...zones],
    };
  }

  if (crossesDomains) {
    return {
      requiresProof: true,
      reason: 'diff crosses multiple domain modules',
      zones: [...zones],
    };
  }

  return {
    requiresProof: false,
    reason: 'single-hop application diff without downstream side-effect path',
    zones: [...zones],
  };
}

function isAncestor(ancestor, descendant, cwd = root) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function proofOnlyChangesSince(sha, headSha, cwd = root) {
  const output = git(['diff', '--name-only', '--diff-filter=ACMR', `${sha}..${headSha}`, '--', '.'], cwd);
  if (!output) return true;
  const files = output.split('\n').filter(Boolean);
  return files.every(
    (path) =>
      path.startsWith('.qa/runs/') ||
      path.startsWith('.qa/acceptance/') ||
      path.startsWith('.qa/evidence/stack-migration-prep/completion/'),
  );
}

function extract(text, expression) {
  return text.match(expression)?.[1]?.trim();
}

function isHopRelevantPath(path) {
  if (isToolingOrDocs(path)) return false;
  const zones = classify(path);
  return (
    zones.has('backend') ||
    zones.has('persistence') ||
    zones.has('service') ||
    zones.has('side-effect') ||
    [...zones].some((zone) => zone.startsWith('domain:'))
  );
}

function hopBlobsMatch(proofHead, headSha, files, cwd = root) {
  const hopFiles = files.filter(isHopRelevantPath);
  if (hopFiles.length === 0) return false;
  for (const file of hopFiles) {
    try {
      const atProof = git(['rev-parse', `${proofHead}:${file}`], cwd);
      const atHead = git(['rev-parse', `${headSha}:${file}`], cwd);
      if (atProof !== atHead) return false;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Stable attestation of hop-relevant blobs at a commit (sorted path → git blob id).
 * Used for squash-merge freshness when the PR tip SHA is no longer fetchable.
 */
export function computeHopDigest(headSha, files, cwd = root) {
  const hopFiles = [...files.filter(isHopRelevantPath)].sort();
  if (hopFiles.length === 0) return undefined;
  const hash = createHash('sha256');
  for (const file of hopFiles) {
    try {
      const blob = git(['rev-parse', `${headSha}:${file}`], cwd);
      hash.update(`${file}\0${blob}\n`);
    } catch {
      return undefined;
    }
  }
  return hash.digest('hex');
}

function hopDigestMatches(text, headSha, files, cwd = root) {
  const claimed = extract(text, /^\s*-\s*HOP_DIGEST:\s*([0-9a-f]{64})\s*$/mi);
  if (!claimed) return false;
  const actual = computeHopDigest(headSha, files, cwd);
  return Boolean(actual) && claimed === actual;
}

function proofLandedInRange(proofPath, files, cwd = root) {
  const rel = relative(cwd, proofPath).split('\\').join('/');
  return files.includes(rel);
}

function baseCompatible(proofBase, baseSha, mode, cwd = root) {
  if (proofBase === baseSha) return true;
  // Push after squash: main may have advanced past the PR's recorded merge-base.
  // Accept when the proof base is a true ancestor of the push-before tip.
  return isPushLikeMode(mode) && hasRef(proofBase, cwd) && isAncestor(proofBase, baseSha, cwd);
}

function requiredSectionsOk(text, verdict) {
  const requiredSections = ['## Event', '## Hop chain', '## Simulations', '## Flags'];
  if (!requiredSections.every((section) => text.includes(section))) return false;

  if (verdict === 'CLEAR') {
    const simulations = ['N-actors', 'Invalid/missing', 'Two consumers / crash'];
    if (!simulations.every((simulation) => text.toLowerCase().includes(simulation.toLowerCase()))) {
      return false;
    }
    // Acceptance-tier honesty: CLEAR proofs must state the tier and not claim feature E2E
    // from an isolated unit surface. Deferred integration must name a successor or "none".
    if (!/Acceptance tier|acceptance tier|SLICE DONE|host-integration|isolated-contract/i.test(text)) {
      // Soft-require via Hop chain / Flags language: allow legacy proofs that declare
      // explicit "Deferred integration:" or host mount call sites instead.
      const hasDeferred = /Deferred integration:\s*\S+/i.test(text);
      const hasCallSite =
        /createHost|bootstrap\/|create-app|route-registry|onCommitted|attachSession/i.test(text);
      if (!hasDeferred && !hasCallSite) return false;
    }
  }

  if (verdict === 'SKIPPED') {
    const skipReason = extract(text, /## Skip reason\s*\n+([^\n]+)/i);
    if (!skipReason || /^n\/?a$/i.test(skipReason)) return false;
  }

  return true;
}

/**
 * @param {object} args
 * @param {string} args.path
 * @param {string} args.baseSha
 * @param {string} args.headSha
 * @param {string} args.mode
 * @param {string[]} args.files
 * @param {string} [args.cwd]
 */
export function validateProof({ path, baseSha, headSha, mode, files, cwd = root }) {
  const text = readFileSync(path, 'utf8');
  const proofHead = extract(text, /^\s*-\s*HEAD_SHA:\s*([0-9a-f]{40})\s*$/mi);
  const proofBase = extract(text, /^\s*-\s*BASE_SHA:\s*([0-9a-f]{40})\s*$/mi);
  const verdict = extract(text, /^\s*-\s*Verdict:\s*(CLEAR|SKIPPED|FLAGGED|BLOCKED)\s*$/mi);

  if (!proofHead || !proofBase || !verdict) return undefined;
  if (!['CLEAR', 'SKIPPED'].includes(verdict)) return undefined;
  if (!baseCompatible(proofBase, baseSha, mode, cwd)) return undefined;
  if (!requiredSectionsOk(text, verdict)) return undefined;

  const proofHeadExists = hasRef(proofHead, cwd);

  const lineageFresh =
    proofBase === baseSha &&
    (proofHead === headSha ||
      (proofHeadExists && isAncestor(proofHead, headSha, cwd) && proofOnlyChangesSince(proofHead, headSha, cwd)));

  // Squash / rewritten history: require verifiable hop blob identity (digest or
  // still-resolvable proof tip blobs). Never accept merely because a proof file landed.
  const squashFresh =
    isPushLikeMode(mode) &&
    proofLandedInRange(path, files, cwd) &&
    (hopDigestMatches(text, headSha, files, cwd) ||
      (proofHeadExists && hopBlobsMatch(proofHead, headSha, files, cwd)));

  if (!lineageFresh && !squashFresh) return undefined;
  // Pull requests still require a resolvable proof HEAD (no silent GC path).
  if (!isPushLikeMode(mode) && !proofHeadExists) return undefined;

  return { path, proofHead, verdict };
}

export function findValidProof({ baseSha, headSha, mode, files, cwd = root, proofDirectory }) {
  const dir = proofDirectory ?? join(cwd, '.qa', 'runs');
  if (!existsSync(dir)) return undefined;

  const candidates = readdirSync(dir)
    .filter((name) => /^composition-gate-.*\.md$/i.test(name))
    .map((name) => join(dir, name));

  for (const candidate of candidates) {
    const proof = validateProof({ path: candidate, baseSha, headSha, mode, files, cwd });
    if (proof) return proof;
  }

  return undefined;
}

export function evaluateCompositionGate({ baseSha, headSha, mode, files, cwd = root, proofDirectory }) {
  const analysis = analyze(files);
  if (!analysis.requiresProof) {
    return { status: 'SKIPPED', analysis, proof: undefined };
  }
  const proof = findValidProof({ baseSha, headSha, mode, files, cwd, proofDirectory });
  if (!proof) {
    return { status: 'FLAGGED', analysis, proof: undefined };
  }
  return { status: proof.verdict, analysis, proof };
}

function emitSummary(lines) {
  const summary = lines.join('\n');
  console.log(summary);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `${summary}\n`, 'utf8');
}

function main() {
  const headSha = git(['rev-parse', 'HEAD']);
  const range = resolveRange();
  if (!range) {
    console.error('Composition Gate blocked: no reproducible diff base could be resolved.');
    process.exit(1);
  }

  const files = changedFiles(range.base);
  const result = evaluateCompositionGate({
    baseSha: range.base,
    headSha,
    mode: range.mode,
    files,
  });

  if (result.status === 'SKIPPED' && !result.proof) {
    emitSummary([
      '## Composition Gate — SKIPPED',
      `- HEAD_SHA: ${headSha}`,
      `- BASE_SHA: ${range.base}`,
      `- Range mode: ${range.mode}`,
      `- Reason: ${result.analysis.reason}`,
      `- Changed files: ${files.length}`,
    ]);
    process.exit(0);
  }

  if (result.status === 'FLAGGED' || !result.proof) {
    emitSummary([
      '## Composition Gate — FLAGGED',
      `- HEAD_SHA: ${headSha}`,
      `- BASE_SHA: ${range.base}`,
      `- Range mode: ${range.mode}`,
      `- Reason: ${result.analysis.reason}`,
      `- Zones: ${result.analysis.zones.join(', ') || 'unknown'}`,
      '- Required: a fresh `.qa/runs/composition-gate-<slug>.md` proof with CLEAR/SKIPPED verdict.',
    ]);
    process.exit(1);
  }

  emitSummary([
    `## Composition Gate — ${result.proof.verdict}`,
    `- HEAD_SHA: ${headSha}`,
    `- BASE_SHA: ${range.base}`,
    `- Proof: ${result.proof.path.replace(`${root}/`, '')}`,
    `- Proof code SHA: ${result.proof.proofHead}`,
    `- Reason: ${result.analysis.reason}`,
  ]);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  main();
}
