#!/usr/bin/env node
/**
 * donalu-world-places-check — Donalu places domain, migration, UX wiring (P1–P6).
 * Location: scripts/donalu-world-places-check.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  const path = join(root, rel);
  if (!existsSync(path)) throw new Error(`missing ${rel}`);
  return readFileSync(path, 'utf8');
}

function fail(message) {
  console.error(`Donalu world places check failed: ${message}`);
  process.exit(1);
}

function mustInclude(rel, needles, label) {
  const text = read(rel);
  for (const n of needles) {
    if (!text.includes(n)) fail(`${label}: missing ${n} in ${rel}`);
  }
}

mustInclude(
  'supabase/migrations/095_donalu_world_places.sql',
  [
    "public_id = 'WO-9FFK6'",
    'Donalu',
    'world_places',
    'world_place_map_links',
    'list_world_places',
    'place.dornhain',
    'loc.tavern',
    'loc.crypt',
    'world_place_id',
  ],
  '095 migration',
);

mustInclude(
  'supabase/migrations/096_donalu_place_map_link_rpc.sql',
  ['upsert_world_place_map_link', 'worldPlaceId', 'list_saga_bindings'],
  '096 link rpc',
);

mustInclude(
  'supabase/migrations/097_donalu_player_place_projection.sql',
  ['v_party_only', 'list_world_place_map_links', 'p_player_view', "'engine'"],
  '097 player projection',
);

mustInclude(
  'supabase/migrations/101_world_places_select_editor_only.sql',
  [
    'world_places_select',
    'world_place_map_links_select',
    'current_user_can_edit_world_profile',
  ],
  '101 editor-only place SELECT',
);

mustInclude(
  'supabase/migrations/102_world_atlas_player_redaction_force.sql',
  [
    'world_atlas_maps_select',
    'v_party_only',
    'get_world_atlas_map',
    'current_user_can_edit_world_profile',
  ],
  '102 forced atlas redaction',
);

mustInclude(
  'src/domains/world/places/world-place.types.ts',
  ['WORLD_PLACE_KINDS', 'WorldPlaceVm', 'WorldPlaceMapLinkVm'],
  'places domain types',
);

mustInclude(
  'src/domains/world/places/parse-world-place.ts',
  ['pickPrimaryMapIdForPlace', 'placeHasDetailMap'],
  'places parse helpers',
);

mustInclude(
  'src/infrastructure/world/world-place-service.ts',
  ['assertSupabaseJwtSession', 'list_world_places', 'linkMap', 'upsert_world_place_map_link'],
  'place service',
);

mustInclude(
  'src/app/world/places/WorldPlacesPanel.tsx',
  ['data-world-places-panel', 'data-iv-missing-detail', 'Detailkarte anlegen'],
  'places panel',
);

mustInclude(
  'src/app/world/atlas/WorldAtlasWorkbench.tsx',
  ['WorldPlacesPanel', 'sagaPublicId', 'onCreateDetailMap', 'dungeonMeta'],
  'workbench places + dungeon',
);

mustInclude(
  'src/app/project/SagaWorldMapPanel.tsx',
  ['sagaPublicId={sagaPublicId}', 'projectService', 'getProjectByPublicId'],
  'saga map passes sagaPublicId + project world fallback',
);

mustInclude(
  'src/domains/world/atlas/dungeon-generator.ts',
  [
    'buildDungeonGeneratorMeta',
    'dungeonNeedsReforgeConfirm',
    'manualDirty',
    'mergeDungeonMetaIntoGeneratorMeta',
  ],
  'dungeon meta + reforge guard',
);

mustInclude(
  'src/app/world/atlas/unified/UnifiedAtlasEditor.tsx',
  ['dungeonNeedsReforgeConfirm', 'onDungeonMetaChange', 'data-atlas-dungeon-dirty'],
  'dungeon UI guard',
);

mustInclude(
  'src/infrastructure/project/saga-permission-service.ts',
  ['worldPlaceId'],
  'binding VM place id',
);

mustInclude(
  'src/app/project/SagaWorldCatalogPanel.tsx',
  ['data-saga-binding-world-place', 'Welt-Ort verknüpft'],
  'catalog place display',
);

// No service_role in place client adapter
const placeSvc = read('src/infrastructure/world/world-place-service.ts');
if (/service_role|SERVICE_ROLE/i.test(placeSvc)) {
  fail('world-place-service must not reference service_role');
}

const p0 = read('scripts/donalu-p0-auth-gate-check.mjs');
if (!p0.includes('world-place-service')) {
  fail('donalu-p0-auth-gate-check must cover world-place-service');
}

const gate = read('scripts/test-gate.mjs');
if (!gate.includes('donalu-world-places-check.mjs')) {
  fail('test-gate must invoke donalu-world-places-check.mjs');
}

console.log('Donalu world places check: OK');
