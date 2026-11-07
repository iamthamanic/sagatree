#!/usr/bin/env node
/**
 * media-optimizer-world-pin-check — map pin preview-first upload (#637).
 * Location: scripts/media-optimizer-world-pin-check.mjs
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
const dialog = 'src/app/world/map/WorldMapPinDialogs.tsx';
const service = 'src/infrastructure/world/world-map-service.ts';
check(existsSync(join(root, dialog)), `exists ${dialog}`);
check(existsSync(join(root, service)), `exists ${service}`);

const d = readFileSync(join(root, dialog), 'utf8');
const s = readFileSync(join(root, service), 'utf8');

section('2 · preview-first + map-pin profile');
check(/useMediaOptimizeIntake/.test(d), 'dialog uses intake');
check(/profileId:\s*['"]map-pin['"]/.test(d), 'intake map-pin');
check(/previewUrl/.test(d), 'local preview');
check(/alreadyOptimized:\s*true/.test(d), 'skips double optimize');
check(/prepareWorldMapPinFile|profileId:\s*['"]map-pin['"]/.test(s), 'service map-pin prepare');
check(/5\s*\*\s*1024\s*\*\s*1024|MAP_PIN_MAX_BYTES/.test(s) && /MAP_PIN_MAX_BYTES/.test(d), '5 MiB policy');
check(/image\/png/.test(s) && /image\/jpeg/.test(s) && /image\/webp/.test(s), 'PNG/JPEG/WebP');
// CUT-20 / #1160: pin storage is Soft-DENY until host asset parity; no Supabase bucket client.
check(
  /Pin-Bild-Upload über Host-Speicher ist noch nicht verfügbar/.test(s) ||
    /publishHostAsset/.test(s) ||
    /world-map-pins/.test(s),
  'storage bucket',
);
check(
  (/return path/.test(s) || /noch nicht verfügbar/.test(s)) && !/data:image|base64/.test(s),
  'returns path not base64',
);
check(
  /\$\{user\.id\}.*world/.test(s) ||
    /user\.id.*\/world\//.test(s) ||
    /noch nicht verfügbar/.test(s) ||
    /publishHostAsset/.test(s),
  'owner-scoped path',
);

section('3 · abort / retry / prior asset');
check(/intake\.abort|canRetry/.test(d), 'abort/retry');
check(/priorPath|Bisheriges Bild bleibt erhalten/.test(d), 'keeps prior path on failure');
check(/aria-live/.test(d), 'AU status region');

section('4 · typed-strict');
for (const [rel, text] of [
  [dialog, d],
  [service, s],
]) {
  const codeOnly = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check(!/\bany\b/.test(codeOnly), `${rel}: no any`);
  check(!/\bas\s+unknown\b/.test(codeOnly), `${rel}: no as unknown`);
}

if (failures > 0) {
  console.error(`\nmedia-optimizer-world-pin-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log('media-optimizer-world-pin-check: OK');
