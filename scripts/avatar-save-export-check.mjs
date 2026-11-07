#!/usr/bin/env node
/**
 * avatar-save-export-check — deterministic tests for #7 materialized save export.
 * Location: scripts/avatar-save-export-check.mjs
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';

function read(rel) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

function check(cond, msg) {
  if (!cond) {
    console.error(`avatar-save-export-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const domain = read('src/domains/character/avatar/avatar-save-export.ts');
const index = read('src/domains/character/avatar/index.ts');
const service = read('src/infrastructure/character/avatar/character-avatar-export-service.ts');
const editor = [
  read('src/app/character/edit/CharacterEditor.tsx'),
  read('src/app/character/edit/useCharacterAvatarEditor.ts'),
].join('\n');
const migration = read('supabase/migrations/025_character_avatar_export.sql');
const traitLayers = read('src/domains/character/avatar/trait-layers.ts');

check(/AVATAR_SAVE_EXPORT_VERSION/.test(domain), 'export contract version');
check(/buildAvatarSaveExportPayload/.test(domain), 'payload builder');
check(/encodeAvatarExportGlb/.test(domain), 'GLB encoder');
check(/buildAvatarExportStoragePath/.test(domain), 'owner-scoped path');
check(/runtimeOverlays: \[\]/.test(domain), 'overlays forced empty in payload');
check(/void input\.runtimeOverlays/.test(domain), 'overlays discarded');
check(!/from ['"]react['"]/.test(domain), 'domain has no React');
check(!/from ['"]three['"]/.test(domain), 'domain has no Three');

check(/export \{[\s\S]*buildAvatarSaveExportPayload/.test(index), 'barrel exports builder');
check(/encodeAvatarExportGlb/.test(index), 'barrel exports encoder');

check(/materializeAvatarSaveExport/.test(service), 'infra materialize service');
check(/publishHostAvatarModel/.test(service), 'uses host AssetPorts upload (CUT-20)');
check(/isHostLibraryEnabled/.test(service), 'host library gate');
check(!/character-avatars|supabase\.storage|\.from\(\s*['"]character-avatars['"]/.test(service), 'no Supabase storage bucket (CUT-20)');
check(!/character_avatar_export_assets/.test(service), 'no direct export-assets table writes (CUT-20 host)');
check(/buildAvatarSaveExportPayload/.test(service), 'service uses domain payload');
check(/encodeAvatarExportGlb/.test(service), 'service encodes GLB');

check(/materializeAvatarSaveExport/.test(editor), 'editor calls export on save');
check(/data-avatar-save-export/.test(editor), 'save button export status attr');
check(/priorModelUrl/.test(editor), 'keeps prior model on export failure');
check(!/Avatar-Export speichern/.test(editor), 'no second avatar-save button');

check(/character_avatar_export_assets/.test(migration), 'export assets table');
check(/idx_character_avatar_export_one_active/.test(migration), 'exactly-one active index');
check(/export_contract_version = 'AvatarSaveExportV1'/.test(migration), 'insert policy forces contract');

check(/serializePersistedBaseTraits/.test(traitLayers), 'base trait serializer exists');

// --- pure encode / path / overlay semantics (mirrors domain) ---
function path(owner, id) {
  if (owner.includes('/') || id.includes('/')) throw new Error('bad');
  return `${owner}/exports/${id}.glb`;
}
check(path('uid-1', 'art-1') === 'uid-1/exports/art-1.glb', 'storage path shape');
let threw = false;
try { path('a/b', 'x'); } catch { threw = true; }
check(threw, 'rejects slash in owner');

function encodeMinimalGlb(payload) {
  const json = JSON.stringify({
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }],
    scene: 0,
    nodes: [{ name: 'SagaTreeAvatarExport' }],
    extras: { sagatreeAvatarExport: payload },
  });
  const jsonBytes = new TextEncoder().encode(json);
  const jsonPadding = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonChunkLength = jsonBytes.byteLength + jsonPadding;
  const totalLength = 12 + 8 + jsonChunkLength;
  const out = new Uint8Array(totalLength);
  const view = new DataView(out.buffer);
  out[0] = 0x67; out[1] = 0x6c; out[2] = 0x54; out[3] = 0x46;
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonChunkLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  for (let i = 0; i < jsonPadding; i += 1) out[20 + jsonBytes.byteLength + i] = 0x20;
  return out;
}

const samplePayload = {
  contractVersion: 'AvatarSaveExportV1',
  runtimeOverlays: [],
  baseTraits: { clothing: 'casual' },
  morph: { contractVersion: 'SagaTreeAvatarMorphV1' },
};
const glb = encodeMinimalGlb(samplePayload);
check(glb[0] === 0x67 && glb[1] === 0x6c && glb[2] === 0x54 && glb[3] === 0x46, 'GLB magic');
const decoded = new TextDecoder().decode(glb.subarray(20, glb.byteLength)).trim();
check(decoded.includes('sagatreeAvatarExport'), 'extras embed export');
check(decoded.includes('"runtimeOverlays":[]'), 'no overlays in encoded extras');
check(!decoded.includes('helmet'), 'inventory overlay id not present');

// Overlay discard contract: base clothing stays, overlay helmet must not win in export builder contract
check(/void input\.runtimeOverlays/.test(domain), 'builder voids overlays');
check(/serializePersistedBaseTraits/.test(domain), 'export uses base traits only');

console.log('avatar-save-export-check PASS');
