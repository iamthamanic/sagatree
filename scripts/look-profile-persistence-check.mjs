#!/usr/bin/env node
/**
 * look-profile-persistence-check — #340 LookProfile persistence contracts.
 * Offline: draft validation, mapping, migration/RLS static gates. No live Supabase.
 * Location: scripts/look-profile-persistence-check.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
let group = '';

function section(name) {
  group = name;
}

function check(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message}`);
  }
}

function equal(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    failures += 1;
    console.error(`FAIL [${group}]: ${message} — expected ${b}, got ${a}`);
  }
}

function mustInclude(file, needles, label) {
  const text = readFileSync(join(root, file), 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures += 1;
      console.error(`FAIL [${label}]: missing ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

function mustNotInclude(file, needles, label) {
  const text = readFileSync(join(root, file), 'utf8');
  for (const needle of needles) {
    if (text.includes(needle)) {
      failures += 1;
      console.error(`FAIL [${label}]: forbidden ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

function walkFiles(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkFiles(full, acc);
      continue;
    }
    if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) acc.push(full);
  }
  return acc;
}

section('1 · migration & RLS');

mustInclude(
  'supabase/migrations/046_look_profiles.sql',
  [
    'look_profiles',
    'look_profile_versions',
    'ENABLE ROW LEVEL SECURITY',
    'owner_user_id = auth.uid()',
    'look_references',
    'append-only',
    "status IN ('active', 'archived')",
  ],
  'migration',
);

mustNotInclude(
  'supabase/migrations/046_look_profiles.sql',
  ['GRANT ALL ON TABLE public.look_profiles TO anon', 'GRANT DELETE ON TABLE public.look_profile_versions'],
  'no anon all / no version delete grant',
);

const migration = readFileSync(join(root, 'supabase/migrations/046_look_profiles.sql'), 'utf8');
check(
  !/CREATE POLICY[\s\S]{0,200}look_profile_versions[\s\S]{0,80}FOR UPDATE/i.test(migration),
  'versions have no UPDATE policy',
);
check(!/ON public\.look_profile_versions[\s\S]{0,40}FOR UPDATE/i.test(migration), 'no UPDATE on versions table');
check(
  /GRANT SELECT, INSERT ON TABLE public.look_profile_versions TO authenticated/.test(migration),
  'versions authenticated select+insert only',
);

section('2 · infrastructure ownership');

mustInclude(
  'src/infrastructure/look/index.ts',
  ['createLookProfile', 'appendLookProfileVersion', 'archiveLookProfile', 'duplicateLookProfile'],
  'infra barrel',
);

mustInclude(
  'src/domains/look/index.ts',
  ['LookProfileRepository', 'normalizeLookProfileWriteDraft', 'LookProfileRecord'],
  'domain persistence exports',
);

mustNotInclude(
  'src/domains/look/persistence-contracts.ts',
  ["from 'react'", 'supabase'],
  'domain contract purity',
);

for (const file of walkFiles(join(root, 'src/domains/look'))) {
  const text = readFileSync(file, 'utf8');
  const rel = file.slice(root.length + 1);
  check(!/\bfrom\s+['"]react(?:\/|$)/.test(text), `${rel}: no React`);
  check(!/supabase/i.test(text.replace(/\/\*[\s\S]*?\*\//g, '')), `${rel}: no supabase mention in code`);
  const codeOnly = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check(!/\bany\b/.test(codeOnly), `${rel}: no any`);
}

section('3 · draft validation runtime');

const outdir = join(root, 'node_modules', '.cache', 'look-profile-persistence-check');
mkdirSync(outdir, { recursive: true });
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');

execFileSync(
  esbuild,
  [
    join(root, 'src/domains/look/index.ts'),
    '--bundle',
    '--format=esm',
    `--outfile=${join(outdir, 'look.mjs')}`,
  ],
  { stdio: 'inherit' },
);

execFileSync(
  esbuild,
  [
    join(root, 'src/infrastructure/look/look.persistence.ts'),
    '--bundle',
    '--format=esm',
    '--external:../../domains/look',
    `--outfile=${join(outdir, 'persist.mjs')}`,
  ],
  { stdio: 'inherit' },
);

const look = await import(pathToFileURL(join(outdir, 'look.mjs')).href);

const ok = look.normalizeLookProfileWriteDraft({
  displayName: 'Noir Rain',
  source: 'manual',
  capabilities: ['character', 'lighting', 'postFx'],
  executionModes: ['realtime'],
  references: [
    { id: 'r1', kind: 'style', uri: 'asset://style-noir', weight: 0.8 },
    { id: 'r2', kind: 'content', uri: 'asset://content-rain' },
  ],
});
check(ok.ok === true, 'valid draft normalizes');

const blob = look.normalizeLookProfileWriteDraft({
  displayName: 'X',
  source: 'manual',
  executionModes: ['realtime'],
  toonLab: { secret: true },
});
check(blob.ok === false, 'ToonLab blob rejected');

const badSource = look.normalizeLookProfileWriteDraft({
  displayName: 'X',
  source: 'meshy-secret',
  executionModes: ['realtime'],
});
check(badSource.ok === false, 'unknown source rejected');

const kindSwap = look.normalizeLookProfileWriteDraft({
  displayName: 'X',
  source: 'preset',
  executionModes: ['rendered'],
  references: [
    { id: 'same', kind: 'style', uri: 'a' },
    { id: 'same', kind: 'content', uri: 'b' },
  ],
});
check(kindSwap.ok === false, 'style/content id collision rejected');

// Mapping roundtrip via persistence helpers (import look parsers already in look.mjs)
const version = look.parseLookProfileVersion({
  profileId: 'look:demo',
  version: 2,
  source: 'reference-analysis',
  displayName: 'Analyzed',
  capabilities: ['character'],
  executionModes: ['realtime', 'rendered'],
  references: [{ id: 's', kind: 'style', uri: 'asset://x', weight: 1 }],
  createdAtIso: '2026-09-27T12:00:00.000Z',
});
check(version !== null, 'version with weight parses');
equal(version.references[0].weight, 1, 'weight preserved');

const profile = look.parseLookProfile({
  id: 'look:demo',
  currentVersion: 2,
  ownerScope: 'player-character',
  ownerId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
});
check(profile !== null, 'profile parses with owner');

check(
  !existsSync(join(root, 'src/infrastructure/look/supabase-look.repository.ts')),
  'CUT-20 removed supabase look repository',
);

mustInclude(
  'src/infrastructure/look/look-service.ts',
  [
    'appendLookProfileVersion',
    'duplicateLookProfile',
    'appendHostLibraryLookVersion',
    'createHostLibraryLook',
    'assertHost',
  ],
  'look-service host facade',
);

mustInclude(
  'src/domains/look/write-draft.ts',
  ['normalizeLookProfileWriteDraft'],
  'write draft normalization in domain',
);

if (failures > 0) {
  console.error(`look-profile-persistence-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('look-profile-persistence-check: PASS');
