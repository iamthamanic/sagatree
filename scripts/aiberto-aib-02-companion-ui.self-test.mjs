#!/usr/bin/env node
/**
 * AIB-02 self-test — companion shell mount, prefs, flag, rulebook UI wiring (#1125).
 * Location: scripts/aiberto-aib-02-companion-ui.self-test.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

console.log('AIB-02: companion UI structural checks…');

const layout = read('src/app/shell/Layout.tsx');
check(/from '\.\.\/ai-assistant'/.test(layout), 'Layout imports ai-assistant barrel');
check(/AibertoCompanion/.test(layout), 'Layout mounts AibertoCompanion');
check(/AibertoToggleButton/.test(layout), 'Layout has Aiberto toggle');
check(/data-aiberto-toggle="mobile-header"/.test(layout), 'mobile header toggle (not 5th bottom nav)');
check(
  /const mobileNavItems = \[[^\]]*\]/s.test(layout) &&
    !/const mobileNavItems = \[[^\]]*Aiberto/s.test(layout) &&
    /grid-cols-4/.test(layout),
  'Aiberto not a 5th bottom-nav item (still 4-col grid)',
);

const companion = read('src/app/ai-assistant/AibertoCompanion.tsx');
const browser = read('src/app/ai-assistant/RulebookBrowser.tsx');
const flags = read('src/app/ai-assistant/aiberto-flags.ts');
const prefs = read('src/app/ai-assistant/aiberto-prefs.ts');
const barrel = read('src/app/ai-assistant/index.ts');

check(/AIBERTO_DOCK_MIN_PX = 320/.test(prefs), 'dock min 320');
check(/AIBERTO_DOCK_MAX_PX = 520/.test(prefs), 'dock max 520');
check(/sagatree-aiberto-prefs/.test(prefs), 'prefs key');
check(/VITE_AIBERTO_COMPANION_ENABLED/.test(flags), 'feature flag env');
check(/getSagaTreeCoreRulebookIndex/.test(browser), 'uses rulebook index');
check(/searchRulebook/.test(browser), 'uses pure search');
check(/data-aiberto-orc-notice/.test(browser), 'ORC notice');
check(/data-aiberto-version/.test(browser), 'version/hash status');
check(/AdaptiveSheet/.test(companion), 'phone sheet');
check(/data-aiberto-companion="dock"/.test(companion), 'desktop dock');
check(!/lucide-react/.test(companion + browser + layout), 'no lucide');
check(!/\bas\s+any\b|@ts-ignore|@ts-expect-error/.test(companion + browser + flags + prefs), 'no type escapes');
check(/export \{ AibertoCompanion/.test(barrel), 'public barrel exports companion');

// Prefs pure unit (no DOM): bundle prefs module
const outdir = join(root, 'node_modules', '.cache', 'aiberto-aib-02');
mkdirSync(outdir, { recursive: true });
const esbuild = join(root, 'node_modules', '.bin', 'esbuild');
execFileSync(
  esbuild,
  [
    join(root, 'src/app/ai-assistant/aiberto-prefs.ts'),
    '--bundle',
    '--platform=neutral',
    '--format=esm',
    `--outfile=${join(outdir, 'prefs.mjs')}`,
  ],
  { stdio: 'pipe' },
);
const prefsMod = await import(pathToFileURL(join(outdir, 'prefs.mjs')).href);
check(prefsMod.clampAibertoDockWidth(100) === 320, 'clamp min');
check(prefsMod.clampAibertoDockWidth(900) === 520, 'clamp max');
check(prefsMod.clampAibertoDockWidth(400) === 400, 'clamp mid');

console.log('AIB-02 companion UI self-test passed.');
