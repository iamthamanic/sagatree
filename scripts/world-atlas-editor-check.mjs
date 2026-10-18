#!/usr/bin/env node
/**
 * world-atlas-editor-check — dual nav + unified canvas + atlas domain (#702).
 * Location: scripts/world-atlas-editor-check.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(rel) {
  const path = join(root, rel);
  if (!existsSync(path)) throw new Error(`missing ${rel}`);
  return readFileSync(path, 'utf8');
}

function mustInclude(rel, needles, label) {
  const text = read(rel);
  for (const n of needles) {
    if (!text.includes(n)) throw new Error(`${label}: missing ${n} in ${rel}`);
  }
}

mustInclude(
  'supabase/migrations/094_world_atlas.sql',
  ['world_atlas_maps', 'list_world_atlas_maps', 'get_world_atlas_map', 'upsert_world_atlas_map', 'legacy_tiles'],
  'atlas migration',
);

mustInclude(
  'src/app/world/atlas/WorldAtlasWorkbench.tsx',
  ['data-world-atlas-workbench', 'UnifiedAtlasEditor', 'Azgaar', 'saveCanvas'],
  'shared workbench',
);

mustInclude(
  'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx',
  [
    'data-unified-atlas-demo-badge',
    'Pinsel',
    'Stempel',
    'Weltkarte',
    'AtlasNative3dEditor',
    'data-atlas-proto-exact',
    'data-atlas-dungeon-forge',
    'data-atlas-missing-detail',
  ],
  'unified canvas editor',
);

mustInclude(
  'src/app/world/atlas/unified/AtlasNative3dEditor.tsx',
  ['data-atlas-native-3d', 'mountAtlasPrototype', 'atlas-sagatree-skin.css'],
  'native 3d atlas mount',
);

mustInclude(
  'src/app/world/atlas/unified/AtlasSpatialViewport.tsx',
  ['data-atlas-spatial-viewport', 'applyMapEdit', 'three'],
  'spatial 3d viewport module',
);

mustInclude(
  'src/app/world/atlas/WorldAtlasWorkbench.tsx',
  ['Gespeicherte Karten', 'data-world-atlas-workbench'],
  'atlas workbench chrome',
);

mustInclude(
  'src/domains/world/atlas/unified-canvas-doc.ts',
  ['sagatree-unified-atlas-v1', 'unifiedCanvas', 'UNIFIED_CANVAS_MAX_BYTES', 'mergeUnifiedCanvasIntoGeneratorMeta'],
  'unified canvas doc',
);

mustInclude(
  'src/domains/world/map/atlas-camera.ts',
  ['atlasZoomAt', 'atlasOpacity', 'atlasFitCamera'],
  'atlas camera math',
);

mustInclude(
  'src/app/shell/routing/routes.ts',
  ['pathForWorldAtlas', '/library/worlds/', '/world/map', "section === 'map'"],
  'dual deep links',
);

mustInclude(
  'src/app/project/SagaWorldMapPanel.tsx',
  ['data-saga-world-map', 'WorldAtlasWorkbench'],
  'saga map panel',
);

mustInclude(
  'src/app/project/SagaWorldSubNav.tsx',
  ["id: 'map'", "label: 'Karte'"],
  'saga welt subnav Karte',
);

// Camera LOD opacity (mirrors domain atlasOpacity) — smoothstep in [0,1]
function atlasOpacity(scale, begin, full) {
  if (!(scale > 0) || !(begin > 0) || !(full > 0) || full <= begin) return 0;
  const t = Math.max(0, Math.min(1, (scale - begin) / (full - begin)));
  return t * t * (3 - 2 * t);
}
const mid = atlasOpacity(520, 360, 600);
if (!(mid > 0.4 && mid < 0.9)) throw new Error(`atlasOpacity mid unexpected: ${mid}`);
if (atlasOpacity(100, 360, 600) !== 0) throw new Error('atlasOpacity below begin');
if (atlasOpacity(900, 360, 600) !== 1) throw new Error('atlasOpacity above full');

console.log('world-atlas-editor-check: OK (#702 unified canvas)');
