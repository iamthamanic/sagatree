#!/usr/bin/env node
/**
 * avatar-custom-import-check — deterministic tests for #5 VRM/GLB import.
 * Location: scripts/avatar-custom-import-check.mjs
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';

function read(rel) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

function check(cond, msg) {
  if (!cond) {
    console.error(`avatar-custom-import-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const domain = read('src/domains/character/avatar/avatar-import.ts');
const index = read('src/domains/character/avatar/index.ts');
const service = read('src/infrastructure/character/avatar/character-avatar-import-service.ts');
const panel = read('src/app/character/avatar/AvatarImportPanel.tsx');
const editor = [
  read('src/app/character/edit/CharacterEditor.tsx'),
  read('src/app/character/edit/useCharacterAvatarEditor.ts'),
].join('\n');
const migration = read('supabase/migrations/024_character_avatar_import.sql');

check(/validateAvatarImportBytes/.test(domain), 'authoritative byte validator');
check(/sniffGlbContainer/.test(domain), 'glTF magic sniff');
check(/containsUnsafeExternalUriHint/.test(domain), 'external URI reject');
check(/buildAvatarImportStoragePath/.test(domain), 'owner-scoped path builder');
check(/rigAnalysisStatus/.test(domain), 'rig analysis status contract');
check(/sanitizeImportResultFromServer/.test(domain), 'sanitize server result');
check(!/from ['"]react['"]/.test(domain), 'domain import has no React');
check(/export \{[\s\S]*validateAvatarImportBytes/.test(index), 'barrel exports validator');

check(/validateAvatarImportBytes/.test(service), 'service re-validates before upload');
check(/publishHostAvatarModel/.test(service), 'uses host AssetPorts upload (CUT-20)');
check(/isHostLibraryEnabled/.test(service), 'host library gate');
check(/rigAnalysisStatus: 'pending'/.test(service), 'import always pending for #6');
check(/keepOriginalImportedAvatar/.test(service), 'keep activates import');
check(/activateAvatarArtifact/.test(service), 'draft inactive until Original behalten (host activate)');
check(!/character-avatars|supabase\.storage|\.from\(\s*['"]character-avatars['"]/.test(service), 'no Supabase storage bucket (CUT-20)');
check(!/capabilities\s*:/.test(service), 'no client capability write in service');

check(/3D-Modell importieren/.test(panel), 'CTA label');
check(/data-avatar-import-status/.test(panel), 'status test id');
check(/validating/.test(panel) && /uploading/.test(panel) && /analyzing/.test(panel), 'UI status set');
check(/onDragOver/.test(panel) && /onDrop/.test(panel), 'drag and drop');

check(/AvatarImportPanel/.test(editor), 'editor mounts import panel');
check(/onKeepOriginal/.test(editor), 'editor uses keep original');
check(/importedModelUrl/.test(editor), 'imported model url state');
check(/modelUrl: importedModelUrl/.test(editor), 'passes model url into avatar dto');

check(/AVATAR_IMPORT_MAX_BYTES = 150/.test(domain), 'import ceiling 150MB');
check(/max\. 150 MB/.test(domain), 'import oversize message 150MB');
check(/max\. 150 MB/.test(panel), 'panel copy 150MB');
check(/157286400/.test(read('supabase/migrations/034_character_avatars_150mb.sql')), '034 raises bucket to 150MB');
check(/034_character_avatars_150mb\.sql/.test(read('scripts/apply-migrations.sh')), 'apply-migrations lists 034');

check(/character-avatars/.test(migration), 'bucket migration');
check(/character_avatar_import_assets/.test(migration), 'assets table');
check(/rig_analysis_status = 'pending'/.test(migration), 'insert policy forces pending');
check(/idx_character_avatar_import_one_active/.test(migration), 'exactly-one active index');

// --- pure magic / path semantics ---
function sniff(bytes) {
  return bytes.length >= 12 && bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46;
}
const good = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]);
const bad = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0, 0, 0, 0, 0, 0, 0, 0]);
check(sniff(good), 'accepts glTF magic');
check(!sniff(bad), 'rejects non-glTF');

function path(owner, id, format) {
  if (owner.includes('/') || id.includes('/')) throw new Error('bad');
  return `${owner}/${id}.${format}`;
}
check(path('uid-1', 'art-1', 'vrm') === 'uid-1/art-1.vrm', 'storage path shape');
let threw = false;
try { path('a/b', 'x', 'glb'); } catch { threw = true; }
check(threw, 'rejects slash in owner');

console.log('avatar-custom-import-check PASS');
