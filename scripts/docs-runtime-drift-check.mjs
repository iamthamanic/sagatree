#!/usr/bin/env node
/**
 * docs-runtime-drift-check — Active entry docs must describe host-only product runtime.
 * Location: scripts/docs-runtime-drift-check.mjs
 *
 * Does NOT ban the words Supabase/Postgres/Edge everywhere — archive and historical
 * docs may mention them. Asserts only canonical entrypoints stay consistent.
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
  // Product backend row must not present GoTrue/PostgREST/Deno Edge as the live stack.
  if (/Backend[^\n]*GoTrue|Backend[^\n]*PostgREST|Backend[^\n]*Deno Edge/i.test(tech)) {
    errors.push('README.md Tech Stack must not list GoTrue/PostgREST/Deno Edge as product Backend');
  }
  if (/selbst gehostetem Supabase-Stack/i.test(readme)) {
    errors.push('README.md must not describe self-hosted Supabase as the product stack');
  }
  if (!/SAGATREE_BETTER_AUTH_SECRET/.test(sectionByHeading(readme, 'Quick Start'))) {
    errors.push('README.md Quick Start must export/set SAGATREE_BETTER_AUTH_SECRET for host:dev');
  }
  if (!/≥?\s*22\.13|>=\s*22\.13|Node\.js \*\*≥22\.13\*\*/i.test(readme)) {
    errors.push('README.md must require Node ≥22.13 for host quick start');
  }

  const agents = fsApi.read('AGENTS.md');
  if (!/SQLite/.test(agents)) errors.push('AGENTS.md must mention SQLite');
  if (!/archive\/supabase-legacy/.test(agents)) {
    errors.push('AGENTS.md must point at archive/supabase-legacy');
  }
  if (/import \{ createClient \} from '@supabase\/supabase-js'/.test(agents)) {
    errors.push('AGENTS.md must not show @supabase/supabase-js createClient as canonical integration');
  }
  if (/### Backend Functions[\s\S]*supabase\/functions\//.test(agents)) {
    errors.push('AGENTS.md must not list supabase/functions/ as product Backend Functions');
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
  if (/eigener Supabase-Backend-Stack/i.test(arch)) {
    errors.push('src/ARCHITECTURE.md must not claim Supabase backend as current stack');
  }
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

  const hostMono = fsApi.read('docs/architecture/host-modular-monolith.md');
  if (/does \*\*not\*\* claim production cutover or Supabase shutdown/i.test(hostMono)) {
    errors.push(
      'host-modular-monolith.md must not still claim Supabase shutdown is unclaimed after CUT-21+',
    );
  }

  const rootCompose = fsApi.read('docker-compose.yml');
  if (!/deployment\/docker-compose\.host\.yml/.test(rootCompose)) {
    errors.push('docker-compose.yml must include deployment/docker-compose.host.yml');
  }
  if (/supabase-db:/.test(rootCompose)) {
    errors.push('docker-compose.yml must not define supabase-db as product default');
  }

  // Canonical docs must not deep-link historical setup as primary ops without banner.
  // INTEGRATION / AUTH_SETUP / SUPABASE_SETUP may exist but must carry HISTORISCH banner.
  for (const rel of ['INTEGRATION.md', 'src/AUTH_SETUP.md', 'src/SUPABASE_SETUP.md']) {
    if (!fsApi.exists(rel)) continue;
    const text = fsApi.read(rel);
    if (!/HISTORISCH|ARCHIVIERT|archived/i.test(text.slice(0, 800))) {
      errors.push(`${rel} must carry a HISTORISCH/ARCHIVIERT banner near the top`);
    }
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
  try {
    // Positive fixture — mirrors invariants (minimal).
    writeTree(dir, {
      'README.md':
        'Node.js **≥22.13**\n\n## Tech Stack\n\n| Backend (Produkt) | Node host · Hono · Better Auth · SQLite |\n| Archiv | Supabase under archive |\n\n## Quick Start\n\nexport SAGATREE_BETTER_AUTH_SECRET=...\nnpm run host:dev\n\n## Other\n',
      'AGENTS.md':
        'Stack: SQLite host. Legacy: archive/supabase-legacy/\n### Host modules\nserver/src/modules\n',
      'README_SELFHOST.md':
        'host-only Node/Hono Better Auth SQLite\ndocker compose --env-file deployment/.env.host up -d --build\n',
      'src/ARCHITECTURE.md':
        'Aktuell Node/Hono Better Auth SQLite.\n\n## Vision\nReact + Vite and Node/Hono host.\n',
      'docs/architecture/host-modular-monolith.md':
        'Status: Binding host module. CUT-21 completed product Supabase removal.\n',
      'docs/ops/host-compose-profiles.md': 'host compose\n',
      'docs/architektur-sqlite-based.md':
        '> **Status:** Historischer Architekturvorschlag. See README_SELFHOST and host-compose-profiles and host-modular-monolith.\n',
      'docker-compose.yml': 'include:\n  - path: deployment/docker-compose.host.yml\n',
      'deployment/docker-compose.host.yml': 'services:\n  sagatree-host:\n',
      'INTEGRATION.md': '> **HISTORISCH**\n\nold stuff\n',
      'src/AUTH_SETUP.md': '> **HISTORISCH**\n',
      'src/SUPABASE_SETUP.md': '> **ARCHIVIERT**\n',
    });
    const pos = assertActiveDocsConsistent({
      exists: (rel) => existsSync(join(dir, rel)),
      read: (rel) => readFileSync(join(dir, rel), 'utf8'),
    });
    if (pos.length) {
      fail(`self-test positive fixture failed: ${pos.join('; ')}`);
    }

    // Negative fixture — stale Supabase-as-product README + AGENTS createClient.
    writeTree(dir, {
      'README.md':
        '## Tech Stack\n\n| Backend | Self-hosted Supabase: Postgres · GoTrue · PostgREST · Deno Edge |\n\nDieses Repo: selbst gehostetem Supabase-Stack\n',
      'AGENTS.md':
        "SQLite\narchive/supabase-legacy/\n```typescript\nimport { createClient } from '@supabase/supabase-js';\n```\n### Backend Functions\n```\nsupabase/functions/\n├── ai-gm/\n```\n",
      'src/ARCHITECTURE.md': 'mit klarem Stack: React + Vite Frontend und eigener Supabase-Backend-Stack.\n',
      'docs/architektur-sqlite-based.md':
        '> **Status:** Architekturvorschlag / Migrationsziel, **keine** bereits implementierte Architektur.\n',
      'docs/architecture/host-modular-monolith.md':
        '## 10. Non-claims\n- This contract does **not** claim production cutover or Supabase shutdown.\n',
      'INTEGRATION.md': '# Integration\n\nVITE_SUPABASE_URL=...\n',
    });
    const neg = assertActiveDocsConsistent({
      exists: (rel) => existsSync(join(dir, rel)),
      read: (rel) => readFileSync(join(dir, rel), 'utf8'),
    });
    if (neg.length < 4) {
      fail(`self-test negative fixture expected ≥4 errors, got ${neg.length}: ${neg.join('; ')}`);
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
