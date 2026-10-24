import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const headSha = git(['rev-parse', 'HEAD']);
const toolingFiles = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
]);

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function hasRef(ref) {
  try {
    git(['cat-file', '-e', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function isZeroSha(value) {
  return !value || /^0+$/.test(value);
}

function resolveRange() {
  const eventName = process.env.GITHUB_EVENT_NAME ?? '';
  const prBaseSha = process.env.COMPOSITION_GATE_PR_BASE_SHA ?? '';
  const pushBeforeSha = process.env.COMPOSITION_GATE_PUSH_BEFORE_SHA ?? '';

  if (eventName === 'pull_request' && !isZeroSha(prBaseSha) && hasRef(prBaseSha)) {
    try {
      return {
        base: git(['merge-base', 'HEAD', prBaseSha]),
        mode: 'pull-request',
      };
    } catch {
      // Fall through when PR base is not an ancestor (shallow / rewritten history).
    }
  }

  if (eventName === 'push' && !isZeroSha(pushBeforeSha) && hasRef(pushBeforeSha)) {
    try {
      // Ensure the range is usable before committing to push-before mode.
      git(['diff', '--name-only', '--diff-filter=ACMR', `${pushBeforeSha}..HEAD`, '--', '.']);
      return { base: git(['rev-parse', pushBeforeSha]), mode: 'push' };
    } catch {
      // github.event.before can point at a replaced tip not present in this clone.
    }
  }

  const baseRef = process.env.GITHUB_BASE_REF ?? '';
  const currentRef = process.env.GITHUB_REF_NAME ?? '';

  if (baseRef && hasRef(`origin/${baseRef}`)) {
    return {
      base: git(['merge-base', 'HEAD', `origin/${baseRef}`]),
      mode: 'pull-request-fallback',
    };
  }

  if (currentRef === 'main' && hasRef('HEAD^')) {
    return { base: git(['rev-parse', 'HEAD^']), mode: 'main-push-fallback' };
  }

  if (hasRef('origin/main')) {
    return {
      base: git(['merge-base', 'HEAD', 'origin/main']),
      mode: 'branch-fallback',
    };
  }

  if (hasRef('main')) {
    return {
      base: git(['merge-base', 'HEAD', 'main']),
      mode: 'local-main-fallback',
    };
  }

  if (hasRef('HEAD^')) {
    return { base: git(['rev-parse', 'HEAD^']), mode: 'parent-fallback' };
  }

  return undefined;
}

function changedFiles(base) {
  try {
    const output = git(['diff', '--name-only', '--diff-filter=ACMR', `${base}..HEAD`, '--', '.']);
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

function analyze(files) {
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

function isAncestor(ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: root,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function proofOnlyChangesSince(sha) {
  const output = git(['diff', '--name-only', '--diff-filter=ACMR', `${sha}..HEAD`, '--', '.']);
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

function validateProof(path, baseSha) {
  const text = readFileSync(path, 'utf8');
  const proofHead = extract(text, /^\s*-\s*HEAD_SHA:\s*([0-9a-f]{40})\s*$/mi);
  const proofBase = extract(text, /^\s*-\s*BASE_SHA:\s*([0-9a-f]{40})\s*$/mi);
  const verdict = extract(text, /^\s*-\s*Verdict:\s*(CLEAR|SKIPPED|FLAGGED|BLOCKED)\s*$/mi);

  if (!proofHead || !proofBase || !verdict) return undefined;
  if (!['CLEAR', 'SKIPPED'].includes(verdict)) return undefined;
  if (proofBase !== baseSha) return undefined;
  if (!hasRef(proofHead)) return undefined;

  const freshForHead =
    proofHead === headSha ||
    (isAncestor(proofHead, headSha) && proofOnlyChangesSince(proofHead));
  if (!freshForHead) return undefined;

  const requiredSections = ['## Event', '## Hop chain', '## Simulations', '## Flags'];
  if (!requiredSections.every((section) => text.includes(section))) return undefined;

  if (verdict === 'CLEAR') {
    const simulations = ['N-actors', 'Invalid/missing', 'Two consumers / crash'];
    if (!simulations.every((simulation) => text.toLowerCase().includes(simulation.toLowerCase()))) {
      return undefined;
    }
  }

  if (verdict === 'SKIPPED') {
    const skipReason = extract(text, /## Skip reason\s*\n+([^\n]+)/i);
    if (!skipReason || /^n\/?a$/i.test(skipReason)) return undefined;
  }

  return { path, proofHead, verdict };
}

function findValidProof(baseSha) {
  const proofDirectory = join(root, '.qa', 'runs');
  if (!existsSync(proofDirectory)) return undefined;

  const candidates = readdirSync(proofDirectory)
    .filter((name) => /^composition-gate-.*\.md$/i.test(name))
    .map((name) => join(proofDirectory, name));

  for (const candidate of candidates) {
    const proof = validateProof(candidate, baseSha);
    if (proof) return proof;
  }

  return undefined;
}

function emitSummary(lines) {
  const summary = lines.join('\n');
  console.log(summary);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) appendFileSync(summaryPath, `${summary}\n`, 'utf8');
}

const range = resolveRange();
if (!range) {
  console.error('Composition Gate blocked: no reproducible diff base could be resolved.');
  process.exit(1);
}

const files = changedFiles(range.base);
const analysis = analyze(files);

if (!analysis.requiresProof) {
  emitSummary([
    '## Composition Gate — SKIPPED',
    `- HEAD_SHA: ${headSha}`,
    `- BASE_SHA: ${range.base}`,
    `- Range mode: ${range.mode}`,
    `- Reason: ${analysis.reason}`,
    `- Changed files: ${files.length}`,
  ]);
  process.exit(0);
}

const proof = findValidProof(range.base);
if (!proof) {
  emitSummary([
    '## Composition Gate — FLAGGED',
    `- HEAD_SHA: ${headSha}`,
    `- BASE_SHA: ${range.base}`,
    `- Range mode: ${range.mode}`,
    `- Reason: ${analysis.reason}`,
    `- Zones: ${analysis.zones.join(', ') || 'unknown'}`,
    '- Required: a fresh `.qa/runs/composition-gate-<slug>.md` proof with CLEAR/SKIPPED verdict.',
  ]);
  process.exit(1);
}

emitSummary([
  `## Composition Gate — ${proof.verdict}`,
  `- HEAD_SHA: ${headSha}`,
  `- BASE_SHA: ${range.base}`,
  `- Proof: ${proof.path.replace(`${root}/`, '')}`,
  `- Proof code SHA: ${proof.proofHead}`,
  `- Reason: ${analysis.reason}`,
]);
