#!/usr/bin/env node
/**
 * docs-runtime-drift-check — Active entry docs must describe host-only product runtime.
 * Location: scripts/docs-runtime-drift-check.mjs
 *
 * Canonical entry/agent docs must describe only the current stack (React/Vite FE,
 * Node/Hono host, Better Auth, Policy Service, SQLite/Drizzle, local assets) and must
 * not name the retired hosted-BaaS stack or a legacy archive as a living path (#1328).
 * Retired setup docs must stay deleted. Dated ADR / owner-decision history under
 * docs/architecture/ is out of scope for this check.
 *
 * Usage:
 *   node scripts/docs-runtime-drift-check.mjs
 *   node scripts/docs-runtime-drift-check.mjs --self-test
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  LEGACY_AUTH_SERVER,
  LEGACY_BAAS,
  LEGACY_REST_GATEWAY,
  legacyStackPattern,
} from './lib/legacy-stack-terms.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const selfTest = process.argv.includes('--self-test');

function fail(msg) {
  console.error(`docs-runtime-drift-check FAIL: ${msg}`);
  process.exit(1);
}

/** Extract a markdown section by ## heading (inclusive until next ##). */
export function sectionByHeading(md, heading) {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, 'mi');
  const m = re.exec(md);
  if (!m) return '';
  const start = m.index;
  const rest = md.slice(start + m[0].length);
  const next = /^##\s+/m.exec(rest);
  return md.slice(start, start + m[0].length + (next ? next.index : rest.length));
}

/**
 * Entry and agent docs/config an agent reads first. They must not present the retired
 * stack (or an archive of it) as current — not even as a "legacy" pointer.
 */
export const ENTRY_DOCS = [
  'README.md',
  'README_SELFHOST.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'server/README.md',
  'src/ARCHITECTURE.md',
  'src/README.md',
  '.cursor/rules/sagatree.mdc',
  '.cursor/.claude/CLAUDE.md',
  '.cursor/.claude/settings.json',
  '.env.example',
  'docker-compose.yml',
  'deployment/docker-compose.host.yml',
  'FEATURE_COMPARISON.md',
  'docs/architecture/host-modular-monolith.md',
  'docs/ops/host-compose-profiles.md',
  '.github/workflows/verify.yml',
  'tsconfig.json',
  'vite.config.ts',
  '.gitignore',
  '.dockerignore',
];

/** Retired setup docs / helpers that described the old stack; they must not come back. */
export const RETIRED_PATHS = [
  'INTEGRATION.md',
  'setup.sh',
  'TEST_RESULTS.md',
  `src/${LEGACY_BAAS.toUpperCase()}_SETUP.md`,
  'src/AUTH_SETUP.md',
  'src/MARKETPLACE_SETUP.md',
  'src/README_ADAPTER_AUDIT.md',
  'src/ADAPTER_AUDIT_FULL.md',
  `src/lib/${LEGACY_BAAS}.ts`,
  `src/lib/${LEGACY_BAAS}-client.ts`,
  `e2e/helpers/${LEGACY_BAAS}-env.ts`,
  `docs/architecture/fe-host-09-residual-${LEGACY_BAAS}.md`,
];

/** A pointer at any `archive/*-legacy` tree counts as a living path. */
const ARCHIVE_POINTER = /archive\/[\w.-]*legacy/i;

/**
 * @param {{ read: (rel: string) => string, exists: (rel: string) => boolean }} fsApi
 */
export function assertActiveDocsConsistent(fsApi) {
  const errors = [];

  const required = [
    'README.md',
    'AGENTS.md',
    'README_SELFHOST.md',
    'src/ARCHITECTURE.md',
    'docs/architecture/host-modular-monolith.md',
    'docs/ops/host-compose-profiles.md',
    'docs/architektur-sqlite-based.md',
    'docker-compose.yml',
    'deployment/docker-compose.host.yml',
  ];
  for (const rel of required) {
    if (!fsApi.exists(rel)) errors.push(`missing required path: ${rel}`);
  }
  if (errors.length) return errors;

  const readme = fsApi.read('README.md');
  const tech = sectionByHeading(readme, 'Tech Stack');
  for (const token of ['Node', 'Hono', 'Better Auth', 'SQLite']) {
    if (!new RegExp(token, 'i').test(tech)) {
      errors.push(`README.md Tech Stack must mention ${token}`);
    }
  }
  // Product backend row must not present the retired auth/REST gateway or Deno Edge as live.
  if (new RegExp(`Backend[^\\n]*(${LEGACY_AUTH_SERVER}|${LEGACY_REST_GATEWAY}|Deno Edge)`, 'i').test(tech)) {
    errors.push('README.md Tech Stack must not list the retired auth/REST gateway or Deno Edge as product Backend');
  }
  if (!/SAGATREE_BETTER_AUTH_SECRET/.test(sectionByHeading(readme, 'Quick Start'))) {
    errors.push('README.md Quick Start must export/set SAGATREE_BETTER_AUTH_SECRET for host:dev');
  }
  if (!/≥?\s*22\.13|>=\s*22\.13|Node\.js \*\*≥22\.13\*\*/i.test(readme)) {
    errors.push('README.md must require Node ≥22.13 for host quick start');
  }

  const agents = fsApi.read('AGENTS.md');
  if (!/SQLite/.test(agents)) errors.push('AGENTS.md must mention SQLite');
  for (const token of ['Hono', 'Better Auth', 'Policy Service']) {
    if (!agents.includes(token)) errors.push(`AGENTS.md must mention ${token}`);
  }

  const selfhost = fsApi.read('README_SELFHOST.md');
  for (const token of ['host-only', 'Better Auth', 'SQLite']) {
    if (!new RegExp(token, 'i').test(selfhost)) {
      errors.push(`README_SELFHOST.md must mention ${token}`);
    }
  }
  if (!/Node\/Hono|Hono/.test(selfhost)) {
    errors.push('README_SELFHOST.md must mention Hono/Node host');
  }
  if (/docker compose up -d(?!.*env\.host)/s.test(selfhost) && !/env\.host/.test(selfhost)) {
    errors.push('README_SELFHOST.md default compose must use deployment/.env.host');
  }

  const arch = fsApi.read('src/ARCHITECTURE.md');
  for (const token of ['Node/Hono', 'Better Auth', 'SQLite']) {
    if (!arch.includes(token)) {
      errors.push(`src/ARCHITECTURE.md must mention ${token} in current framing`);
    }
  }

  const sqliteDoc = fsApi.read('docs/architektur-sqlite-based.md');
  const head = sqliteDoc.slice(0, 1200);
  if (!/Historischer|HISTORISCH|historischer Architekturvorschlag/i.test(head)) {
    errors.push('docs/architektur-sqlite-based.md must be marked historical near the top');
  }
  if (!/README_SELFHOST|host-compose-profiles|host-modular-monolith/i.test(head)) {
    errors.push('docs/architektur-sqlite-based.md must link to current host entry docs');
  }

  const rootCompose = fsApi.read('docker-compose.yml');
  if (!/deployment\/docker-compose\.host\.yml/.test(rootCompose)) {
    errors.push('docker-compose.yml must include deployment/docker-compose.host.yml');
  }

  const legacy = legacyStackPattern('i');
  for (const rel of ENTRY_DOCS) {
    if (!fsApi.exists(rel)) continue;
    const lines = fsApi.read(rel).split('\n');
    lines.forEach((line, index) => {
      if (legacy.test(line)) {
        errors.push(`${rel}:${index + 1} names the retired BaaS stack (entry docs describe the host only)`);
      }
      if (ARCHIVE_POINTER.test(line)) {
        errors.push(`${rel}:${index + 1} points at a legacy archive as a living path`);
      }
    });
  }

  for (const rel of RETIRED_PATHS) {
    if (fsApi.exists(rel)) errors.push(`retired legacy-stack doc/helper must stay deleted: ${rel}`);
  }

  return errors;
}

function repoFsApi() {
  return {
    exists: (rel) => existsSync(join(root, rel)),
    read: (rel) => readFileSync(join(root, rel), 'utf8'),
  };
}

function writeTree(base, files) {
  for (const [rel, body] of Object.entries(files)) {
    const full = join(base, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, body);
  }
}

function runSelfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'docs-runtime-drift-'));
  const fixtureFs = {
    exists: (rel) => existsSync(join(dir, rel)),
    read: (rel) => readFileSync(join(dir, rel), 'utf8'),
  };
  const Baas = LEGACY_BAAS[0].toUpperCase() + LEGACY_BAAS.slice(1);
  try {
    // Positive fixture — mirrors invariants (minimal), no retired-stack names anywhere.
    writeTree(dir, {
      'README.md':
        'Node.js **≥22.13**\n\n## Tech Stack\n\n| Backend (Produkt) | Node host · Hono · Better Auth · SQLite |\n\n## Quick Start\n\nexport SAGATREE_BETTER_AUTH_SECRET=...\nnpm run host:dev\n\n## Other\n',
      'AGENTS.md':
        'Stack: SQLite host (Hono, Better Auth, Policy Service).\n### Host modules\nserver/src/modules\n',
      'README_SELFHOST.md':
        'host-only Node/Hono Better Auth SQLite\ndocker compose --env-file deployment/.env.host up -d --build\n',
      'src/ARCHITECTURE.md':
        'Aktuell Node/Hono Better Auth SQLite.\n\n## Vision\nReact + Vite and Node/Hono host.\n',
      'docs/architecture/host-modular-monolith.md': 'Status: Binding host module.\n',
      'docs/ops/host-compose-profiles.md': 'host compose\n',
      'docs/architektur-sqlite-based.md':
        '> **Status:** Historischer Architekturvorschlag. See README_SELFHOST and host-compose-profiles and host-modular-monolith.\n',
      'docker-compose.yml': 'include:\n  - path: deployment/docker-compose.host.yml\n',
      'deployment/docker-compose.host.yml': 'services:\n  sagatree-host:\n',
    });
    const pos = assertActiveDocsConsistent(fixtureFs);
    if (pos.length) {
      fail(`self-test positive fixture failed: ${pos.join('; ')}`);
    }

    // Negative fixture — old stack as product, archive pointers, retired docs back.
    writeTree(dir, {
      'README.md':
        `## Tech Stack\n\n| Backend | Self-hosted ${Baas}: Postgres · Deno Edge |\n`,
      'AGENTS.md': `SQLite\nLegacy: archive/${LEGACY_BAAS}-legacy/\n`,
      'src/ARCHITECTURE.md': `React + Vite Frontend und eigener ${Baas}-Backend-Stack.\n`,
      'docs/architektur-sqlite-based.md':
        '> **Status:** Architekturvorschlag / Migrationsziel, **keine** bereits implementierte Architektur.\n',
      '.cursor/.claude/CLAUDE.md': `Backend: ${Baas} (self-host)\n`,
      'INTEGRATION.md': `# Integration\n\nVITE_${LEGACY_BAAS.toUpperCase()}_URL=...\n`,
      [`src/lib/${LEGACY_BAAS}.ts`]: 'export {};\n',
    });
    const neg = assertActiveDocsConsistent(fixtureFs);
    const expectFragments = [
      'README.md:3 names the retired',
      'AGENTS.md:2 points at a legacy archive',
      'AGENTS.md must mention Hono',
      '.cursor/.claude/CLAUDE.md:1 names the retired',
      'must stay deleted: INTEGRATION.md',
      `must stay deleted: src/lib/${LEGACY_BAAS}.ts`,
      'docs/architektur-sqlite-based.md must be marked historical',
    ];
    for (const fragment of expectFragments) {
      if (!neg.some((e) => e.includes(fragment))) {
        fail(`self-test negative fixture missing expected error "${fragment}"; got: ${neg.join('; ')}`);
      }
    }
    console.log('docs-runtime-drift-check self-test: PASS');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (selfTest) {
  runSelfTest();
  process.exit(0);
}

const errors = assertActiveDocsConsistent(repoFsApi());
if (errors.length) {
  for (const e of errors) console.error(` - ${e}`);
  fail(`${errors.length} invariant(s) violated`);
}

// Nested self-test must pass whenever the check itself is run.
const nested = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--self-test'], {
  cwd: root,
  encoding: 'utf8',
});
if (nested.status !== 0) {
  console.error(nested.stdout);
  console.error(nested.stderr);
  fail('embedded --self-test failed');
}

console.log('docs-runtime-drift-check: PASS');
