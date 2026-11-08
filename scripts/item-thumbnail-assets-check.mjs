#!/usr/bin/env node
/**
 * item-thumbnail-assets-check — contract for secure thumbnails + Meshy (#140).
 * Offline: no live Meshy; Deno unit tests cover provider mock + validation.
 * Location: scripts/item-thumbnail-assets-check.mjs
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
  'src/domains/items/assets.ts',
  'src/infrastructure/inventory/item-thumbnail-service.ts',
  'src/app/items/visuals/useItemAssets.ts',
  'src/app/items/workbench/ItemVisualsPanel.tsx',
  'src/app/items/useItemThumbnailSrc.ts',
  'archive/supabase-legacy/supabase/migrations/017_item_thumbnail_assets.sql',
  'archive/supabase-legacy/supabase/functions/item-thumbnail/index.ts',
  'archive/supabase-legacy/supabase/functions/_shared/item-thumbnail-prompt.ts',
  'archive/supabase-legacy/supabase/functions/_shared/item-thumbnail-image.ts',
  'archive/supabase-legacy/supabase/functions/_shared/item-thumbnail-meshy.ts',
  'archive/supabase-legacy/supabase/functions/_shared/item-thumbnail-rate-limit.ts',
  'archive/supabase-legacy/supabase/functions/_shared/item-thumbnail_test.ts',
  '.qa/acceptance/item-thumbnail-assets.md',
].forEach(mustExist);

section('2 · domain assetKey contract');
{
  const assets = read('src/domains/items/assets.ts');
  const barrel = read('src/domains/items/index.ts');
  check(/thumbnail2d:/.test(assets), 'assetKey prefix thumbnail2d:');
  check(/buildItemThumbnailPrompt/.test(assets), 'prompt builder');
  check(/sniffItemThumbnailMime/.test(assets), 'magic-byte sniff');
  check(/ITEM_THUMBNAIL_MAX_BYTES\s*=\s*10\s*\*\s*1024\s*\*\s*1024/.test(assets), '10 MB limit');
  check(/buildItemThumbnailPrompt/.test(barrel), 'barrel exports prompt builder');
  check(/parseItemThumbnailAssetKey/.test(barrel), 'barrel exports parseItemThumbnailAssetKey');
}

section('3 · no Meshy secrets in client / Vite env');
{
  const clientFiles = [
    'src/infrastructure/inventory/item-thumbnail-service.ts',
    'src/app/items/visuals/useItemAssets.ts',
    'src/app/items/workbench/ItemVisualsPanel.tsx',
    '.env.example',
  ];
  for (const file of clientFiles) {
    const content = read(file);
    check(!/VITE_.*MESHY/.test(content), `${file} must not expose VITE_ Meshy secrets`);
    check(!/NEXT_PUBLIC_.*MESHY/.test(content), `${file} must not expose NEXT_PUBLIC_ Meshy secrets`);
    check(!/MESHY_API_KEY\s*=\s*['"][^'"]+['"]/.test(content), `${file} must not hardcode MESHY_API_KEY`);
  }
  const service = read('src/infrastructure/inventory/item-thumbnail-service.ts');
  check(
    /\/api\/v1\/items\/thumbnail/.test(service) && !/functions\.invoke/.test(service),
    'client invokes item-thumbnail host API (CUT-20)',
  );
  check(!/api\.meshy\.ai/.test(service), 'client must not call Meshy directly');
}

section('4 · Edge Function fail-closed + security');
{
  const edge = read('archive/supabase-legacy/supabase/functions/item-thumbnail/index.ts');
  const meshy = read('archive/supabase-legacy/supabase/functions/_shared/item-thumbnail-meshy.ts');
  const image = read('archive/supabase-legacy/supabase/functions/_shared/item-thumbnail-image.ts');
  check(/resolveMeshyProviderConfig/.test(edge), 'uses Meshy config resolver');
  check(/not-configured/.test(edge), 'returns not-configured when Meshy missing');
  check(/MESHY_API_KEY/.test(meshy), 'reads MESHY_API_KEY server-side');
  check(/createMockMeshyProvider/.test(meshy), 'mock provider for offline tests');
  check(/assets\.meshy\.ai/.test(image), 'Meshy host allowlist');
  check(/redirect:\s*['"]manual['"]/.test(image), 'SSRF: manual redirects');
  check(/consumeItemThumbnailRateLimit/.test(edge), 'rate limit on generate');
  check(/Authentication required/.test(edge), 'auth required');
  check(/assertCanMutateDefinition/.test(edge), 'owner/world authz');
  check(/Unknown action/.test(edge), 'deny unknown actions');
}

section('5 · Workbench visuals wired');
{
  const panel = read('src/app/items/workbench/ItemVisualsPanel.tsx');
  const toolsBar = read('src/app/items/visuals/ItemVisualToolsBar.tsx');
  const modeToggle = read('src/app/items/visuals/ItemVisualModeToggle.tsx');
  const hook = read('src/app/items/visuals/useItemAssets.ts');
  const editor = read('src/app/items/workbench/ItemWorkbenchEditor.tsx');
  const screen = read('src/app/items/workbench/ItemWorkbenchScreen.tsx');
  check(/Bild hochladen/.test(panel), 'upload CTA');
  check(/Bild generieren/.test(toolsBar), 'generate CTA');
  check(/Bild entfernen/.test(panel), 'remove CTA');
  check(/data-item-workbench-visual-toggle/.test(modeToggle), '2D/3D toggle');
  check(/Erneut versuchen/.test(panel), 'retry CTA');
  check(/Meshy nicht verbunden|nicht konfiguriert/.test(panel), 'fail-closed Meshy copy');
  check(/useItemAssets/.test(panel), 'uses useItemAssets');
  check(/useItemVisualTools/.test(panel), 'uses useItemVisualTools');
  check(/itemThumbnailService/.test(hook), 'hook uses service');
  check(/onAssetKeyChange/.test(editor), 'editor wires asset key');
  check(/applyAssetKey/.test(screen), 'screen wires applyAssetKey');
  check(!/from ['"].*supabase/.test(hook), 'useItemAssets must not import supabase');
}

section('6 · Thumb resolver chain assetKey → iconKey → type');
{
  const thumb = read('src/app/character/inventory/InventoryItemThumb.tsx');
  check(/assetSrc/.test(thumb), 'accepts resolved assetSrc');
  check(/iconKey/.test(thumb), 'falls back to iconKey');
  check(/TYPE_ICONS/.test(thumb), 'falls back to type icons');
  const library = read('src/app/library/items/ItemLibraryCard.tsx');
  check(/useItemThumbnailSrc/.test(library), 'library resolves assetKey');
  const equipment = read('src/app/character/inventory/InventoryEquipmentPanel.tsx');
  check(/useItemThumbnailSrc/.test(equipment), 'inventory equipment resolves assetKey');
}

section('7 · migration storage + rate limit');
{
  const migration = read('archive/supabase-legacy/supabase/migrations/017_item_thumbnail_assets.sql');
  check(/item-thumbnails/.test(migration), 'storage bucket item-thumbnails');
  check(/10485760/.test(migration), '10 MB bucket limit');
  check(/image\/png/.test(migration) && /image\/jpeg/.test(migration), 'PNG/JPEG only');
  check(/item_thumbnail_assets/.test(migration), 'manifest table');
  check(/item_thumbnail_jobs/.test(migration), 'jobs table');
  check(/consume_item_thumbnail_rate_limit/.test(migration), 'rate limit RPC');
  check(/service_role/.test(migration), 'RPC granted to service_role only');
}

section('8 · README documents env');
{
  const readme = read('README.md');
  check(/MESHY_API_KEY/.test(readme), 'README documents MESHY_API_KEY');
  check(/item-thumbnail/.test(readme), 'README mentions item-thumbnail function');
  check(/fail-closed|nicht konfiguriert|not configured/i.test(readme), 'README fail-closed note');
}

if (failures > 0) {
  console.error(`item-thumbnail-assets-check: ${failures} failure(s)`);
  process.exit(1);
}

console.log('item-thumbnail-assets-check: passed');
