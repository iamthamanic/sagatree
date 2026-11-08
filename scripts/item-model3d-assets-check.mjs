#!/usr/bin/env node
/**
 * item-model3d-assets-check — contract for secure GLB + Meshy Image-to-3D (#141).
 * Offline: no live Meshy; Deno unit tests cover provider mock + GLB validation.
 * Location: scripts/item-model3d-assets-check.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const root = process.cwd();
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

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

function mustExist(relPath) {
  check(existsSync(join(root, relPath)), `missing ${relPath}`);
}

section('1 · slice files exist');
[
  'src/domains/items/model3d-assets.ts',
  'src/infrastructure/inventory/item-model3d-service.ts',
  'src/app/items/visuals/useItemAssets.ts',
  'src/app/items/workbench/ItemVisualsPanel.tsx',
  'src/app/items/workbench/ItemModelPreview.tsx',
  'src/app/items/workbench/ItemModelPreviewRuntime.ts',
  'archive/supabase-legacy/supabase/migrations/018_item_model3d_assets.sql',
  'archive/supabase-legacy/supabase/functions/item-model3d/index.ts',
  'archive/supabase-legacy/supabase/functions/_shared/item-model3d-glb.ts',
  'archive/supabase-legacy/supabase/functions/_shared/item-model3d-meshy.ts',
  'archive/supabase-legacy/supabase/functions/_shared/item-model3d-rate-limit.ts',
  'archive/supabase-legacy/supabase/functions/_shared/item-model3d_test.ts',
  '.qa/acceptance/item-3d-meshy-assets.md',
].forEach(mustExist);

section('2 · domain model3d contract');
{
  const assets = read('src/domains/items/model3d-assets.ts');
  const barrel = read('src/domains/items/index.ts');
  const definition = read('src/domains/items/definition.ts');
  const fork = read('src/domains/items/fork.ts');
  const catalog = read('src/domains/character/inventory-v2/catalog.ts');
  check(/model3d:/.test(assets), 'assetKey prefix model3d:');
  check(/ITEM_MODEL3D_MAX_BYTES\s*=\s*50\s*\*\s*1024\s*\*\s*1024/.test(assets), '50 MB limit');
  check(/model\/gltf-binary/.test(assets), 'GLB mime');
  check(/sniffItemModel3dGlb/.test(assets), 'GLB magic sniff');
  check(/parseItemModel3dAssetKey/.test(barrel), 'barrel exports parseItemModel3dAssetKey');
  check(/model3d\?:/.test(definition), 'definition has model3d');
  check(/model3d:\s*_model3d/.test(fork), 'fork strips model3d');
  check(/raw\.model3d/.test(catalog), 'catalog parses model3d');
}

section('3 · no Meshy secrets in client / Vite env');
{
  const clientFiles = [
    'src/infrastructure/inventory/item-model3d-service.ts',
    'src/app/items/visuals/useItemAssets.ts',
    'src/app/items/workbench/ItemVisualsPanel.tsx',
    'src/app/items/workbench/ItemModelPreview.tsx',
    '.env.example',
  ];
  for (const file of clientFiles) {
    const content = read(file);
    check(!/VITE_.*MESHY/.test(content), `${file} must not expose VITE_ Meshy secrets`);
    check(!/NEXT_PUBLIC_.*MESHY/.test(content), `${file} must not expose NEXT_PUBLIC_ Meshy secrets`);
    check(!/MESHY_API_KEY\s*=\s*['"][^'"]+['"]/.test(content), `${file} must not hardcode MESHY_API_KEY`);
  }
  const service = read('src/infrastructure/inventory/item-model3d-service.ts');
  check(
    /\/api\/v1\/items\/model3d/.test(service) && !/functions\.invoke/.test(service),
    'client invokes item-model3d host API (CUT-20)',
  );
  check(!/api\.meshy\.ai/.test(service), 'client must not call Meshy directly');
}

section('4 · Edge Function fail-closed + security');
{
  const edge = read('archive/supabase-legacy/supabase/functions/item-model3d/index.ts');
  const meshy = read('archive/supabase-legacy/supabase/functions/_shared/item-model3d-meshy.ts');
  const glb = read('archive/supabase-legacy/supabase/functions/_shared/item-model3d-glb.ts');
  check(/resolveMeshyImageTo3dConfig/.test(edge), 'uses Meshy image-to-3d config resolver');
  check(/not-configured/.test(edge), 'returns not-configured when Meshy missing');
  check(/MESHY_API_KEY/.test(meshy), 'reads MESHY_API_KEY server-side');
  check(/createMockMeshyImageTo3dProvider/.test(meshy), 'mock provider for offline tests');
  check(/image-to-3d/.test(meshy), 'uses image-to-3d endpoint');
  check(/assets\.meshy\.ai/.test(glb), 'Meshy host allowlist');
  check(/redirect:\s*['"]manual['"]/.test(glb), 'SSRF: manual redirects');
  check(/0x67.*0x6c.*0x54.*0x46|glTF/.test(glb), 'GLB magic validation');
  check(/consumeItemModel3dRateLimit/.test(edge), 'rate limit on generate');
  check(/Authentication required/.test(edge), 'auth required');
  check(/assertCanMutateDefinition/.test(edge), 'owner/world authz');
  check(/input_thumbnail_asset_id/.test(edge), 'snapshots input thumbnail');
  check(/Unknown action/.test(edge), 'deny unknown actions');
  check(/new Uint8Array\(bytes\.byteLength\)/.test(edge), 'copies Uint8Array before Deno fetch body');
}

section('5 · Workbench 3D UI wired');
{
  const panel = read('src/app/items/workbench/ItemVisualsPanel.tsx');
  const toolsBar = read('src/app/items/visuals/ItemVisualToolsBar.tsx');
  const modeToggle = read('src/app/items/visuals/ItemVisualModeToggle.tsx');
  const hook = read('src/app/items/visuals/useItemAssets.ts');
  const editor = read('src/app/items/workbench/ItemWorkbenchEditor.tsx');
  const screen = read('src/app/items/workbench/ItemWorkbenchScreen.tsx');
  const preview = read('src/app/items/workbench/ItemModelPreview.tsx');
  const runtime = read('src/app/items/workbench/ItemModelPreviewRuntime.ts');
  check(/GLB hochladen/.test(panel), 'upload CTA');
  check(/Aus Bild generieren/.test(panel), 'generate CTA');
  check(/3D-Modell entfernen/.test(panel), 'remove CTA');
  check(/data-item-workbench-visual-toggle/.test(modeToggle), '2D/3D toggle');
  check(/data-item-workbench-visual-3d/.test(modeToggle), '3D toggle control');
  check(/data-item-workbench-visual-to-3d/.test(toolsBar), '→3D tool control');
  check(/Erneut versuchen/.test(panel), 'retry CTA');
  check(/Meshy nicht verbunden|nicht konfiguriert/.test(panel), 'fail-closed Meshy copy');
  check(/useItemModel3dAssets/.test(panel), 'uses useItemModel3dAssets');
  check(/useItemVisualTools/.test(panel), 'uses useItemVisualTools');
  check(/itemModel3dService/.test(hook), 'hook uses model3d service');
  check(/submitLock/.test(hook), 'submit lock for cardinality');
  check(/onModel3dChange/.test(editor), 'editor wires model3d');
  check(/applyModel3d/.test(screen), 'screen wires applyModel3d');
  check(/ItemModelPreviewRuntime/.test(preview), 'lazy imports runtime');
  check(/Ansicht zurücksetzen|data-item-model3d-reset-view/.test(preview), 'reset view CTA');
  check(/resetView\(/.test(runtime), 'runtime resetView');
  check(/prefers-reduced-motion|prefersReducedMotion/.test(runtime), 'respects reduced motion');
  check(/dispose\(/.test(runtime), 'disposes Three runtime');
  check(!/from ['"].*supabase/.test(hook), 'useItemAssets must not import supabase');
  check(!/characterStudio|CharacterStudio|@pixiv\/three-vrm/.test(runtime), 'must not import avatar modules');
}

section('6 · Library/Inventory must not mount 3D');
{
  const library = read('src/app/library/items/ItemLibraryCard.tsx');
  const equipment = read('src/app/character/inventory/InventoryEquipmentPanel.tsx');
  const thumb = read('src/app/character/inventory/InventoryItemThumb.tsx');
  check(!/model3d|ItemModelPreview|GLTFLoader/.test(library), 'library card must not load 3D');
  check(!/model3d|ItemModelPreview|GLTFLoader/.test(equipment), 'inventory equipment must not load 3D');
  check(!/model3d|GLTFLoader/.test(thumb), 'InventoryItemThumb must not load 3D');
  check(/useItemThumbnailSrc/.test(library), 'library still resolves thumbnail only');
}

section('7 · migration storage + rate limit');
{
  const migration = read('archive/supabase-legacy/supabase/migrations/018_item_model3d_assets.sql');
  check(/item-models/.test(migration), 'storage bucket item-models');
  check(/52428800/.test(migration), '50 MB bucket limit');
  check(/model\/gltf-binary/.test(migration), 'GLB mime only');
  check(/item_model3d_assets/.test(migration), 'manifest table');
  check(/item_model3d_jobs/.test(migration), 'jobs table');
  check(/input_thumbnail_asset_id/.test(migration), 'input thumbnail snapshot column');
  check(/input_provider_task_id/.test(migration), 'input provider task snapshot column');
  check(/consume_item_model3d_rate_limit/.test(migration), 'rate limit RPC');
  check(/service_role/.test(migration), 'RPC granted to service_role only');
}

section('8 · README documents env');
{
  const readme = read('README.md');
  check(/MESHY_API_KEY/.test(readme), 'README documents MESHY_API_KEY');
  check(/item-model3d/.test(readme), 'README mentions item-model3d function');
  check(/Image-to-3D|image-to-3d/i.test(readme), 'README mentions Image-to-3D');
  check(/fail-closed|nicht konfiguriert|not configured/i.test(readme), 'README fail-closed note');
}

if (failures > 0) {
  console.error(`item-model3d-assets-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('item-model3d-assets-check: passed');
