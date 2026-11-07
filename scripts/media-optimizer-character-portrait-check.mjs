#!/usr/bin/env node
/**
 * media-optimizer-character-portrait-check — portrait + canvas intake (#636).
 * Location: scripts/media-optimizer-character-portrait-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

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

section('1 · files');

const paths = [
  'src/app/character/edit/useCharacterAvatarEditor.ts',
  'src/infrastructure/character/character-service.ts',
];
for (const p of paths) {
  check(existsSync(join(root, p)), `exists ${p}`);
}

section('2 · both portrait entries use character-portrait optimizer');

const editor = readFileSync(
  join(root, 'src/app/character/edit/useCharacterAvatarEditor.ts'),
  'utf8',
);
const service = readFileSync(
  join(root, 'src/infrastructure/character/character-service.ts'),
  'utf8',
);
const ui = readFileSync(join(root, 'src/app/character/edit/CharacterEditor.tsx'), 'utf8');

check(/useMediaOptimizeIntake/.test(editor), 'editor uses intake hook');
check(/profileId:\s*['"]character-portrait['"]/.test(editor), 'intake profile character-portrait');
check(/captureAndUploadPortrait[\s\S]*uploadPortrait/.test(editor), 'canvas capture routes through uploadPortrait');
check(/handleImageUpload[\s\S]*uploadPortrait/.test(editor), 'file upload routes through uploadPortrait');
check(/alreadyOptimized:\s*true/.test(editor), 'upload skips double-optimize after intake');
check(/prepareCharacterPortraitFile|preparePortraitFile/.test(service), 'service preparePortrait helper');
check(/profileId:\s*['"]character-portrait['"]/.test(service), 'service prepare uses character-portrait');
check(/optimizeMedia/.test(service), 'service calls optimizeMedia');
check(/alreadyOptimized/.test(service), 'service respects alreadyOptimized');
check(/image\/webp/.test(service), 'service accepts webp output');
check(/publishHostAsset/.test(service), 'portrait upload via host asset publish');

section('3 · preview / AU / abort / asset survival');

check(/portraitPreviewUrl|portraitIntake\.previewUrl/.test(editor), 'preview URL exposed');
check(/retryPortraitOptimize/.test(editor), 'retry exposed');
check(/abortPortraitOptimize|portraitIntake\.abort/.test(editor), 'abort exposed');
check(/Bestehendes Portrait bleibt erhalten|Do not clear portraitUrl/.test(editor), 'failure keeps prior asset');
check(/aria-live/.test(ui), 'UI aria-live for status');
check(/portraitIntakeStatusLabelDe|Erneut|Abbrechen/.test(ui), 'UI load/error/retry controls');
check(/portraitPreviewUrl \|\| portraitUrl/.test(ui), 'immediate preview before remote URL');

section('4 · typed-strict on touched');

for (const [rel, text] of [
  ['useCharacterAvatarEditor.ts', editor],
  ['character-service.ts', service],
]) {
  const codeOnly = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check(!/\bany\b/.test(codeOnly), `${rel}: no any`);
  check(!/\bas\s+unknown\b/.test(codeOnly), `${rel}: no as unknown`);
}

if (failures > 0) {
  console.error(`\nmedia-optimizer-character-portrait-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('media-optimizer-character-portrait-check: OK');
