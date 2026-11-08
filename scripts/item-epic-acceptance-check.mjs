#!/usr/bin/env node
/**
 * item-epic-acceptance-check — meta gate for Item Epic final acceptance (#144).
 * Asserts child contracts #133–#143 stay wired in test-gate, docs mention required
 * terms, no client Meshy secrets (VITE_*MESHY), and e2e specs exist.
 * Location: scripts/item-epic-acceptance-check.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
let group = '';

function section(name) {
  group = name;
  console.log(`\n[${name}]`);
}

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message}`);
  }
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) {
    failures += 1;
    console.error(`FAIL [${group}]: fehlt ${label}`);
  }
}

function rejectMatch(content, pattern, label) {
  if (pattern.test(content)) {
    failures += 1;
    console.error(`FAIL [${group}]: ${label}`);
  }
}

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
      walkFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx|mjs|js|md|env|example)$/.test(entry) || entry.startsWith('.env')) {
      acc.push(full);
    }
  }
  return acc;
}

/** Child gates from Item Epic #133–#143 (must remain in test-gate). */
const CHILD_GATES = [
  'item-routing-foundation-check', // #133
  'item-domain-taxonomy-check', // #134
  'sagatree-item-rules-kernel-check', // #135
  'item-definition-persistence-check', // #136
  'item-standard-packs-check', // #137
  'item-library-browser-check', // #138
  'item-workbench-check', // #139
  'item-thumbnail-assets-check', // #140
  'item-model3d-assets-check', // #141
  'item-world-catalog-check', // #142
  'item-inventory-world-catalog-wire-check', // #143
];

const E2E_SPECS = [
  'e2e/item-library-browser.spec.ts',
  'e2e/item-workbench.spec.ts',
  'e2e/item-routing-foundation.spec.ts',
  'e2e/world-item-catalog-module.spec.ts',
  'e2e/item-epic-acceptance.spec.ts',
  'e2e/inventory-v2.spec.ts',
];

// ── A · Child gates wired in test-gate.mjs ──────────────────────────────────
section('A · Child gates wired in test-gate.mjs');
const testGate = read('scripts/test-gate.mjs');
for (const name of CHILD_GATES) {
  const scriptPath = `scripts/${name}.mjs`;
  check(existsSync(join(root, scriptPath)), `script exists: ${scriptPath}`);
  requireMatch(
    testGate,
    new RegExp(`scripts/${name}\\.mjs`),
    `test-gate invokes scripts/${name}.mjs`,
  );
}
requireMatch(
  testGate,
  /scripts\/item-epic-acceptance-check\.mjs/,
  'test-gate invokes item-epic-acceptance-check (self)',
);

// ── B · Docs: required Item Epic terms ──────────────────────────────────────
section('B · Docs: Item Epic terms');
const itemsDoc = read('docs/items.md');
const inventoryDoc = read('docs/inventory-v2.md');
const coreRules = read('docs/sagatree core rules.md');
const readme = read('README.md');

const itemsPhrases = [
  [/Taxonomie|taxonomy/i, 'taxonomy'],
  [/item-catalog/, 'world item-catalog'],
  [/Packs|#137|builtin/i, 'packs'],
  [/assetKey|Thumbnail|MESHY_API_KEY/, 'assets / Meshy'],
  [/fail-closed|fail closed/i, 'fail-closed'],
  [/Archive|archiv/i, 'archive'],
  [/Fork|fork/, 'fork'],
  [/Marketplace|marketplace/, 'marketplace future boundary'],
  [/Character-owned|Character-owned|Instanzen bleiben/i, 'instances character-owned'],
  [/36/, '36 Core archetypes'],
  [/VITE_.*MESHY|kein.*VITE|no `VITE_/i, 'no client Meshy env'],
  [/src\/domains\/items/, 'architecture domain path'],
];

for (const [pattern, label] of itemsPhrases) {
  requireMatch(itemsDoc, pattern, `docs/items.md: ${label}`);
}

requireMatch(
  inventoryDoc,
  /Item-Domain|domains\/items|item-catalog/i,
  'inventory-v2.md: definitions from Item Domain / item-catalog',
);
requireMatch(
  inventoryDoc,
  /Character-owned|Charakter-owned|Instanzen bleiben/i,
  'inventory-v2.md: instances Character-owned',
);
requireMatch(inventoryDoc, /36 Definitionen/, 'inventory-v2.md: 36 defs');
requireMatch(inventoryDoc, /docs\/items\.md/, 'inventory-v2.md points to items.md');

requireMatch(
  coreRules,
  /36 setting-neutrale mechanische Archetypen|36 Core-Gegenstandsarchetypen/,
  'core rules §10/§5.7: 36 Core archetypes',
);
requireMatch(
  coreRules,
  /ohne neue Regelwirkung/,
  'core rules: Standard/World/Personal ohne neue Regelwirkung',
);
requireMatch(coreRules, /item-catalog/, 'core rules mention item-catalog');
requireMatch(coreRules, /docs\/items\.md/, 'core rules point to items.md');

requireMatch(readme, /docs\/items\.md/, 'README points to docs/items.md');
requireMatch(readme, /MESHY_API_KEY/, 'README documents MESHY_API_KEY');
requireMatch(readme, /VITE_.*MESHY|nie.*als `VITE_/i, 'README forbids VITE Meshy keys');

// ── C · No VITE_*MESHY client secrets ───────────────────────────────────────
section('C · No VITE_*MESHY / NEXT_PUBLIC_*MESHY');
const scanRoots = [
  join(root, 'src'),
  join(root, 'e2e'),
  join(root, 'docs'),
  join(root, 'scripts'),
];
const envExamples = [
  join(root, '.env'),
  join(root, '.env.example'),
  join(root, '.env.local'),
  join(root, 'supabase', '.env'),
];

for (const dir of scanRoots) {
  for (const file of walkFiles(dir)) {
    const text = readFileSync(file, 'utf8');
    // Allow documentation that forbids the pattern (negative mentions).
    const stripped = text
      .replace(/nie[`'"]?\s*als\s*`?VITE_[^`\n]*MESHY[^`\n]*/gi, '')
      .replace(/no\s*`?VITE_[^`\n]*MESHY[^`\n]*/gi, '')
      .replace(/must not expose VITE_[^\n]*MESHY[^\n]*/gi, '')
      .replace(/kein[^\n]*VITE_[^\n]*MESHY[^\n]*/gi, '')
      .replace(/!\/VITE_.*MESHY/g, '')
      .replace(/VITE_\.\*MESHY/g, '')
      .replace(/\/VITE_.*MESHY\//g, '');
    rejectMatch(
      stripped,
      /\bVITE_[A-Z0-9_]*MESHY[A-Z0-9_]*/,
      `client Meshy env in ${file.replace(root + '/', '')}`,
    );
    rejectMatch(
      stripped,
      /\bNEXT_PUBLIC_[A-Z0-9_]*MESHY[A-Z0-9_]*/,
      `NEXT_PUBLIC Meshy env in ${file.replace(root + '/', '')}`,
    );
  }
}

for (const envPath of envExamples) {
  if (!existsSync(envPath)) continue;
  const text = readFileSync(envPath, 'utf8');
  rejectMatch(text, /\bVITE_[A-Z0-9_]*MESHY/, `.env exposes VITE Meshy: ${envPath}`);
  rejectMatch(text, /\bNEXT_PUBLIC_[A-Z0-9_]*MESHY/, `.env exposes NEXT_PUBLIC Meshy: ${envPath}`);
}

// Positive: edge functions still read server-side key
requireMatch(
  read('archive/supabase-legacy/supabase/functions/_shared/item-thumbnail-meshy.ts'),
  /MESHY_API_KEY/,
  'thumbnail meshy adapter reads MESHY_API_KEY server-side',
);
requireMatch(
  read('archive/supabase-legacy/supabase/functions/_shared/item-model3d-meshy.ts'),
  /MESHY_API_KEY/,
  'model3d meshy adapter reads MESHY_API_KEY server-side',
);

// ── D · E2E specs exist ─────────────────────────────────────────────────────
section('D · E2E specs exist');
for (const spec of E2E_SPECS) {
  check(existsSync(join(root, spec)), `e2e exists: ${spec}`);
}
requireMatch(
  read('e2e/item-epic-acceptance.spec.ts'),
  /1440|768|390/,
  'item-epic-acceptance e2e covers viewports',
);
requireMatch(
  read('e2e/item-epic-acceptance.spec.ts'),
  /Bibliothek|Items|Workbench|Inventar|Core|Standard|Welt|Eigen/i,
  'item-epic-acceptance e2e covers Library → Workbench → Inventory labels',
);

// ── E · Evidence + composition proof stubs ──────────────────────────────────
section('E · Evidence + composition proof');
check(
  existsSync(join(root, '.qa/evidence/item-epic-acceptance')),
  'evidence dir .qa/evidence/item-epic-acceptance',
);
check(
  existsSync(join(root, '.qa/evidence/item-epic-acceptance/README.md')),
  'evidence README',
);
check(
  existsSync(join(root, '.qa/runs/composition-gate-item-epic-acceptance.md')),
  'composition gate proof',
);
const composition = read('.qa/runs/composition-gate-item-epic-acceptance.md');
requireMatch(composition, /N-actors|N actors/i, 'composition: N-actors');
requireMatch(composition, /Invalid\/missing|Invalid \/ missing/i, 'composition: Invalid/missing');
requireMatch(
  composition,
  /Two consumers|Two consumers \/ crash/i,
  'composition: Two consumers / crash',
);
requireMatch(composition, /\bCLEAR\b|\bSKIPPED\b/, 'composition verdict CLEAR or SKIPPED');

// ── F · Core catalog size still 36 ──────────────────────────────────────────
section('F · Core 36 unchanged');
requireMatch(
  read('src/domains/character/inventory-v2/core-catalog.ts'),
  /CORE_CATALOG_SIZE\s*=\s*36/,
  'CORE_CATALOG_SIZE = 36',
);

if (failures > 0) {
  console.error(`\nitem-epic-acceptance-check: ${failures} Fehler`);
  process.exit(1);
}

console.log('\nitem-epic-acceptance-check: OK (#144)');
