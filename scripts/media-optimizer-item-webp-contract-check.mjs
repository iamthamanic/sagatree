#!/usr/bin/env node
/**
 * media-optimizer-item-webp-contract-check — item-thumbnail WebP contract (#641).
 * Location: scripts/media-optimizer-item-webp-contract-check.mjs
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
  'src/domains/items/assets.ts',
  'src/domains/media/optimization-policy.ts',
  'src/infrastructure/inventory/item-thumbnail-service.ts',
  'archive/supabase-legacy/supabase/functions/_shared/item-thumbnail-image.ts',
  'archive/supabase-legacy/supabase/functions/_shared/item-model3d-glb.ts',
  'archive/supabase-legacy/supabase/functions/item-thumbnail/index.ts',
  'archive/supabase-legacy/supabase/functions/item-model3d/index.ts',
  'archive/supabase-legacy/supabase/migrations/080_item_thumbnail_webp.sql',
  'src/app/items/workbench/ItemVisualsPanel.tsx',
];
for (const p of paths) check(existsSync(join(root, p)), `exists ${p}`);

const domain = readFileSync(join(root, 'src/domains/items/assets.ts'), 'utf8');
const policy = readFileSync(join(root, 'src/domains/media/optimization-policy.ts'), 'utf8');
const edge = readFileSync(join(root, 'archive/supabase-legacy/supabase/functions/_shared/item-thumbnail-image.ts'), 'utf8');
const thumbFn = readFileSync(join(root, 'archive/supabase-legacy/supabase/functions/item-thumbnail/index.ts'), 'utf8');
const modelFn = readFileSync(join(root, 'archive/supabase-legacy/supabase/functions/item-model3d/index.ts'), 'utf8');
const glb = readFileSync(join(root, 'archive/supabase-legacy/supabase/functions/_shared/item-model3d-glb.ts'), 'utf8');
const mig = readFileSync(join(root, 'archive/supabase-legacy/supabase/migrations/080_item_thumbnail_webp.sql'), 'utf8');
const ui = readFileSync(join(root, 'src/app/items/workbench/ItemVisualsPanel.tsx'), 'utf8');
const client = readFileSync(
  join(root, 'src/infrastructure/inventory/item-thumbnail-service.ts'),
  'utf8',
);

section('2 · domain + edge MIME + magic bytes');
check(/'image\/webp'/.test(domain) && /ITEM_THUMBNAIL_ALLOWED_MIME/.test(domain), 'domain allows webp');
check(/0x52[\s\S]*0x57[\s\S]*0x50/.test(domain), 'domain RIFF/WEBP sniff');
check(/'image\/webp'/.test(edge), 'edge allows webp');
check(/0x52[\s\S]*0x57[\s\S]*0x50/.test(edge), 'edge RIFF/WEBP sniff');
check(/Declared MIME does not match/.test(edge), 'MIME mismatch rejection');
check(/allowWebpOutput:\s*true/.test(policy), 'media policy webp out');
check(/'image\/webp'/.test(policy) && /item-thumbnail/.test(policy), 'media policy mime');

section('3 · bucket / DB / config / Meshy');
check(/image\/webp/.test(mig) && /item-thumbnails/.test(mig), 'migration bucket webp');
check(/item_thumbnail_assets_mime_check/.test(mig), 'migration mime check');
check(/allowedMime:.*image\/webp/.test(thumbFn.replace(/\s+/g, ' ')), 'config returns webp');
check(/image\/webp/.test(modelFn), 'model3d accepts webp mime');
check(/image\/webp/.test(glb), 'data URI accepts webp');
check(/image\/webp/.test(ui), 'UI accept webp');
check(/WebP/.test(client), 'client error mentions WebP');

section('4 · typed-strict');
for (const [rel, text] of [
  ['assets.ts', domain],
  ['item-thumbnail-image.ts', edge],
]) {
  const codeOnly = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  check(!/\bany\b/.test(codeOnly), `${rel}: no any`);
  check(!/\bas\s+unknown\b/.test(codeOnly), `${rel}: no as unknown`);
}

if (failures > 0) {
  console.error(`\nmedia-optimizer-item-webp-contract-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log('media-optimizer-item-webp-contract-check: OK');
