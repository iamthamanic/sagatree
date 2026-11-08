#!/usr/bin/env node
/**
 * player-test-shared-rolls-check — contract for #299 / Epic #210 Phase 4.
 * Location: scripts/player-test-shared-rolls-check.mjs
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function mustInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${label}: missing ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

function mustNotInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (text.includes(needle)) {
      throw new Error(`${label}: forbidden ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

mustInclude(
  'archive/supabase-legacy/supabase/migrations/042_session_shared_rolls.sql',
  [
    'sagadrive_resolve_session_check',
    'sagadrive_strip_forged_roll_keys',
    'sagadrive_resolve_probe_grade',
    'sagadrive_roll_d20',
    'authoritative',
    'useDrive',
    'checkTarget',
    'apply_session_runtime_command',
  ],
  'shared rolls migration',
);

mustInclude(
  'src/domains/rules/sagatree/probe/index.ts',
  [
    'resolveProbeGrade',
    'resolveProbeFromDice',
    'applyDriveReroll',
    'pickBetterProbeOutcome',
    'PROBE_CRITICAL_MARGIN',
  ],
  'rules kernel probe',
);

mustNotInclude(
  'src/domains/rules/sagatree/probe/index.ts',
  ['supabase', "from 'react'", 'from "react"'],
  'pure probe domain',
);

mustInclude(
  'src/domains/session/contracts/shared-rolls.ts',
  [
    'FORGED_ROLL_RESULT_KEYS',
    'stripForgedRollResultKeys',
    'parseSharedRollCommandInput',
    'readLastSharedRoll',
    'buildSharedRollResultView',
  ],
  'shared rolls contract',
);

mustNotInclude(
  'src/domains/session/contracts/shared-rolls.ts',
  ['supabase', "from 'react'", 'from "react"'],
  'pure shared-rolls domain',
);

mustInclude(
  'src/app/session/hooks/usePlayerPanel.ts',
  ["kind: 'roll'", 'mode', 'useDrive', 'intent: \'standard-check\''],
  'player panel roll inputs',
);

mustInclude(
  'src/app/session/PlayerPanel.tsx',
  ['data-shared-rolls="v1"', 'Drive-Reroll', 'data-last-shared-roll', 'Vorteil', 'Nachteil'],
  'player panel shared rolls UI',
);

const esbuild = require('esbuild');
const cacheDir = join(root, 'node_modules/.cache/player-test-shared-rolls-check');
mkdirSync(cacheDir, { recursive: true });

const probeOut = join(cacheDir, 'probe.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/rules/sagatree/probe/index.ts')],
  outfile: probeOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});

const rollsOut = join(cacheDir, 'shared-rolls.mjs');
esbuild.buildSync({
  entryPoints: [join(root, 'src/domains/session/contracts/shared-rolls.ts')],
  outfile: rollsOut,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  packages: 'bundle',
});

const probe = await import(pathToFileURL(probeOut).href);
const rolls = await import(pathToFileURL(rollsOut).href);

// §2.2 grade boundaries
{
  const g = probe.resolveProbeGrade(25, 15, 10);
  if (g !== 'crit-success') throw new Error(`expected crit-success got ${g}`);
  const f = probe.resolveProbeGrade(5, 15, 10);
  if (f !== 'crit-failure') throw new Error(`expected crit-failure got ${f}`);
  const nat20 = probe.resolveProbeGrade(14, 15, 20);
  if (nat20 !== 'success') throw new Error(`nat20 should bump failure→success, got ${nat20}`);
  const nat1 = probe.resolveProbeGrade(16, 15, 1);
  if (nat1 !== 'failure') throw new Error(`nat1 should drop success→failure, got ${nat1}`);
}

// Advantage keep high
{
  const out = probe.resolveProbeFromDice({
    profile: { attribute: 3, skill: 2, experienceBonus: 1 },
    target: 15,
    mode: 'advantage',
    naturals: [4, 18],
  });
  if (out.natural !== 18) throw new Error(`advantage keep high, got ${out.natural}`);
  if (out.total !== 18 + 6) throw new Error(`advantage total wrong: ${out.total}`);
}

// Drive keep-better
{
  const first = probe.resolveProbeFromDice({
    profile: { attribute: 3, skill: 2, experienceBonus: 1 },
    target: 20,
    mode: 'normal',
    naturals: [5],
  });
  const reroll = probe.resolveProbeFromDice({
    profile: { attribute: 3, skill: 2, experienceBonus: 1 },
    target: 20,
    mode: 'normal',
    naturals: [19],
  });
  const applied = probe.applyDriveReroll({ first, reroll, driveAvailable: 2 });
  if (applied.kept.natural !== 19) throw new Error('drive should keep better natural');
  if (applied.driveSpent !== 1 || applied.driveRemaining !== 1) {
    throw new Error('drive spend mismatch');
  }
  let threw = false;
  try {
    probe.applyDriveReroll({ first, reroll, driveAvailable: 0 });
  } catch {
    threw = true;
  }
  if (!threw) throw new Error('drive without pool must fail closed');
}

// Strip forged keys + parse input
{
  const stripped = rolls.stripForgedRollResultKeys({
    skill: 'athletics',
    mode: 'normal',
    total: 99,
    grade: 'crit-success',
    natural: 20,
    useDrive: false,
  });
  if ('total' in stripped || 'grade' in stripped || 'natural' in stripped) {
    throw new Error('forged keys must be stripped');
  }
  const parsed = rolls.parseSharedRollCommandInput({
    skill: 'athletics',
    mode: 'advantage',
    useDrive: true,
    characterPublicId: 'CH-TEST',
    total: 99,
    grade: 'success',
  });
  if (parsed.mode !== 'advantage' || parsed.useDrive !== true) {
    throw new Error('parsed roll input mismatch');
  }
  if (!('skill' in parsed) || parsed.skill !== 'athletics') {
    throw new Error('skill missing after parse');
  }
}

// lastRoll projection requires authoritative:true
{
  const ok = rolls.readLastSharedRoll({
    lastRoll: {
      authoritative: true,
      skill: 'athletics',
      mode: 'normal',
      target: 15,
      total: 18,
      grade: 'success',
      natural: 12,
      naturals: [12],
      flatBonus: 6,
      useDrive: false,
      driveSpent: 0,
      characterPublicId: 'CH-1',
      actorUserId: null,
    },
  });
  if (!ok || ok.total !== 18) throw new Error('authoritative lastRoll should read');
  const forged = rolls.readLastSharedRoll({
    lastRoll: {
      authoritative: false,
      skill: 'athletics',
      mode: 'normal',
      target: 15,
      total: 99,
      grade: 'crit-success',
    },
  });
  if (forged !== null) throw new Error('non-authoritative lastRoll must be ignored');
}

console.log('player-test-shared-rolls-check: PASS');
