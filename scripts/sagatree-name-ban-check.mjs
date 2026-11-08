#!/usr/bin/env node
/**
 * sagatree-name-ban-check — Fail if runtime/product surfaces still contain "sagadrive".
 * Historical migrations 001–078 and a tiny allowlist of gate scripts may mention it.
 * Location: scripts/sagatree-name-ban-check.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const NEEDLE = /sagadrive/i;

const SKIP_DIR = new Set([
  '.git',
  'node_modules',
  'build',
  'dist',
  'playwright-report',
  'test-results',
  '.qa', // historical evidence / runs; product code is gated elsewhere
]);

/** Paths that may still mention sagadrive (history or this gate). */
function isAllowed(rel) {
  if (rel.startsWith('archive/supabase-legacy/supabase/migrations/')) return true;
  if (rel === 'scripts/sagatree-name-ban-check.mjs') return true;
  if (rel === 'scripts/character-editor-regression-check.mjs') return true;
  // Historical 007 filename + legacy docker container name until local compose rename.
  if (rel === 'scripts/apply-migrations.sh') return true;
  if (rel === 'scripts/saga-routing-public-id-foundation-check.mjs') return true;
  if (rel === 'scripts/adventure-runtime-world-state-check.mjs') return true;
  if (rel === 'scripts/director-runtime-cues-check.mjs') return true;
  if (rel === 'scripts/live-program-output-check.mjs') return true;
  if (rel === 'scripts/player-test-combat-encounter-check.mjs') return true;
  if (rel === 'scripts/player-test-shared-rolls-check.mjs') return true;
  if (rel === 'scripts/player-test-shared-scene-presentation-check.mjs') return true;
  if (rel === 'scripts/session-death-lifecycle-check.mjs') return true;
  if (rel === 'scripts/session-knowledge-reveals-check.mjs') return true;
  if (rel === 'scripts/saga-between-sessions-bote-check.mjs') return true;
  if (rel === 'scripts/session-recap-persist-handover-check.mjs') return true;
  if (rel === 'scripts/saga-overview-rpc-check.mjs') return true;
  if (rel === 'scripts/saga-simulation-live-ops-check.mjs') return true;
  if (rel === 'scripts/sagatree-brand-phase-b-check.mjs') return true;
  if (rel === 'scripts/sagatree-brand-phase-a-check.mjs') return true;
  if (rel === 'scripts/local-auth-email-sagatree-check.mjs') return true;
  if (rel === '.qa/acceptance/sagatree-eradicate-legacy-ids.md') return true;
  if (rel === '.qa/runs/composition-gate-sagatree-eradicate-legacy-ids.md') return true;
  return false;
}

const SCAN_ROOTS = [
  'src',
  'docs',
  'e2e',
  'public',
  'scripts',
  'archive/supabase-legacy/supabase/functions',
  'AGENTS.md',
  'README.md',
  'README_SELFHOST.md',
  'package.json',
  'docker-compose.yml',
  'docker-compose.override.yml',
  'index.html',
  'vite.config.ts',
  '.env.example',
  '.gitignore',
  '.cursor',
];

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|md|mdc|json|yml|yaml|html|css|svg|sh|txt|toml)$/i;

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const hits = [];

for (const scan of SCAN_ROOTS) {
  const full = join(root, scan);
  let st;
  try {
    st = statSync(full);
  } catch {
    continue;
  }
  const files = st.isDirectory() ? walk(full) : [full];
  for (const file of files) {
    const rel = relative(root, file).replaceAll('\\', '/');
    if (isAllowed(rel)) continue;
    if (!TEXT_EXT.test(file) && !rel.endsWith('Dockerfile')) continue;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!NEEDLE.test(text)) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      if (NEEDLE.test(lines[i])) {
        hits.push(`${rel}:${i + 1}:${lines[i].trim().slice(0, 160)}`);
      }
    }
  }
}

// Filename ban outside migrations / .qa
for (const scan of ['src', 'docs', 'e2e', 'public', 'scripts', 'archive/supabase-legacy/supabase/functions', '.cursor']) {
  const full = join(root, scan);
  try {
    statSync(full);
  } catch {
    continue;
  }
  for (const file of walk(full)) {
    const rel = relative(root, file).replaceAll('\\', '/');
    if (isAllowed(rel)) continue;
    if (NEEDLE.test(rel.split('/').pop() ?? '')) {
      hits.push(`${rel}:0:filename contains sagadrive`);
    }
  }
}

if (hits.length > 0) {
  console.error('sagatree-name-ban-check FAIL — remaining sagadrive references:');
  for (const hit of hits.slice(0, 80)) console.error(`  ${hit}`);
  if (hits.length > 80) console.error(`  … and ${hits.length - 80} more`);
  process.exit(1);
}

console.log('sagatree-name-ban-check PASS');
