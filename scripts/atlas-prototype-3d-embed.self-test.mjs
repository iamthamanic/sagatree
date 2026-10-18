#!/usr/bin/env node
/**
 * Self-test: Unified Atlas 3D is native SagaTree code (no iframe).
 * Location: scripts/atlas-prototype-3d-embed.self-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

function assert(cond, msg) {
  if (!cond) {
    console.error(`atlas-prototype-3d-embed self-test failed: ${msg}`);
    process.exit(1);
  }
}

const root = process.cwd();
const runtimePath = path.join(
  root,
  'src/app/world/atlas/unified/prototype3d/atlas-prototype-runtime.mjs',
);
assert(fs.existsSync(runtimePath), 'runtime.mjs exists');
const runtime = fs.readFileSync(runtimePath, 'utf8');
assert(runtime.includes('export function mountAtlasPrototype3d'), 'exports mount');
assert(runtime.includes('scopeShellCssForEmbed'), 'scopes shell CSS for embed');
assert(runtime.includes('prefixSelectorsWithAtlasRoot'), 'prefixes selectors with #atlas3d');
assert(runtime.includes('dropCssRulesMatching'), 'drops skin-owned action-tools rules');
assert(runtime.includes('\\.action-tools'), 'skips .action-tools from prototype CSS');
assert(runtime.includes('AtlasGL'), 'AtlasGL in runtime');
assert(runtime.includes('AtlasLite3D'), 'software 3D fallback');
assert(runtime.includes('hostRoot'), 'binds host root');
assert(!runtime.includes("document.querySelector('#atlas3d')"), 'no global #atlas3d query');
// Global button color inherit must not remain unscoped (poisons SagaTree tabs).
assert(runtime.includes("button{cursor:pointer;color:inherit}"), 'source still has standalone prototype reset');
assert(runtime.includes('#atlas3d button{cursor:pointer}'), 'embed strips color:inherit from button reset');

const native = fs.readFileSync(
  path.join(root, 'src/app/world/atlas/unified/AtlasNative3dEditor.tsx'),
  'utf8',
);
assert(native.includes('mountAtlasPrototype3d'), 'native editor mounts runtime');
assert(native.includes('data-atlas-native-3d'), 'native marker');
assert(native.includes('atlas-sagatree-skin.css'), 'SagaTree skin imported');
assert(native.includes('installCollapsiblePanels'), 'Layers/Tools fold chrome');
assert(native.includes("'Ebenen'") || native.includes('"Ebenen"'), 'Ebenen fold label');
assert(native.includes("'Werkzeuge'") || native.includes('"Werkzeuge"'), 'Werkzeuge fold label');
assert(native.includes('PANEL_FOLD_ICONS') && native.includes('atlas-panel-fold-icon'), 'panel fold icons');
assert(native.includes('atlas-panel-fold-main') && native.includes('atlas-panel-body-inner'), 'fold layout + slide inner');
assert(native.includes('Kartenwerkzeuge'), 'mode tools under Kartenwerkzeuge');
assert(runtime.includes('toolIcons') && runtime.includes('tool-icon'), 'square tool icons in renderTools');
assert(!native.includes('<iframe'), 'no iframe element in native editor');
assert(!native.includes('AtlasPrototype3dEmbed'), 'legacy embed unused');
const skin = fs.readFileSync(
  path.join(root, 'src/app/world/atlas/unified/prototype3d/atlas-sagatree-skin.css'),
  'utf8',
);
assert(skin.includes('--primary'), 'skin uses theme tokens');
assert(skin.includes("data-slot='tabs-trigger'") || skin.includes('tabs-trigger'), 'tool rail mirrors tabs');
assert(skin.includes('.atlas-panel-fold'), 'panel fold styles');
assert(skin.includes('scale-widget > button[data-action]'), 'scale chrome sizes only action buttons');
assert(skin.includes('[data-collapsed=\'true\'] .atlas-panel-fold:hover') && skin.includes('--accent)'), 'collapsed fold gold hover wins');
assert(skin.includes('max-height: 0 !important') && skin.includes('atlas-panel-body'), 'panel body slide collapse');
assert(/\.subbar\s*\{[^}]*display:\s*none/s.test(skin), 'subbar hidden in skin');
assert(runtime.includes("setAttribute('role','tablist')"), 'tools rendered as tablist');
assert(runtime.includes('id="yawDial"') && runtime.includes('scale-yaw-dial'), 'yaw rotation dial in shell');
assert(runtime.includes('id="yawDeg"'), 'degree readout on dial');
assert(!runtime.includes('id="camTilt"'), 'legacy pitch range removed');
assert(runtime.includes('applyYawDegrees') && runtime.includes('syncYawDialUi'), 'yaw dial handlers');
assert(skin.includes('.scale-yaw-dial'), 'skin styles yaw dial');
assert(runtime.includes('SPAN_MAX=8000') && runtime.includes('syncOceanMesh'), 'endless ocean zoom range');

const editor = fs.readFileSync(
  path.join(root, 'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx'),
  'utf8',
);
assert(editor.includes('AtlasNative3dEditor'), 'editor uses native host');
assert(!editor.includes('AtlasPrototype3dEmbed'), 'iframe embed removed');

const embedGone = !fs.existsSync(
  path.join(root, 'src/app/world/atlas/unified/AtlasPrototype3dEmbed.tsx'),
);
assert(embedGone, 'AtlasPrototype3dEmbed deleted');

// Importability (Node): mount export present
const mod = await import(pathToFileURL(runtimePath).href);
assert(typeof mod.mountAtlasPrototype3d === 'function', 'mount is a function');

console.log('atlas-prototype-3d-embed self-test: PASS');
