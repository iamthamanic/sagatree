#!/usr/bin/env node
/**
 * avatar-3d-generation-check — provider-agnostic generation contracts + Meshy adapter.
 * Location: scripts/avatar-3d-generation-check.mjs
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';

function read(rel) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

function check(cond, msg) {
  if (!cond) {
    console.error(`avatar-3d-generation-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const types = read('src/domains/character/avatar/generation/types.ts');
const meshy = read('src/domains/character/avatar/generation/meshy-adapter.ts');
const resolve = read('src/domains/character/avatar/generation/resolve-settings.ts');
const barrel = read('src/domains/character/avatar/generation/index.ts');
const avatarIndex = read('src/domains/character/avatar/index.ts');
const edgeShared = read('archive/supabase-legacy/supabase/functions/_shared/avatar-3d-generation.ts');
const edge = read('archive/supabase-legacy/supabase/functions/character-avatar-meshy/index.ts');
const imageProvider = read('archive/supabase-legacy/supabase/functions/_shared/item-model3d-meshy.ts');
const panel = read('src/app/character/avatar/AvatarMeshyPanel.tsx');
const advanced = read('src/app/character/avatar/AvatarGenerationAdvancedSettings.tsx');
const migration = read('archive/supabase-legacy/supabase/migrations/033_character_avatar_generation_settings.sql');
const applyMigrations = read('scripts/apply-migrations.sh');
const service = read('src/infrastructure/character/avatar/character-avatar-meshy-service.ts');

check(/AVATAR_3D_GENERATION_CONTRACT_VERSION/.test(types), 'contract version');
check(/Avatar3dGenerationSettings/.test(types), 'settings type');
check(/GenerationError/.test(types), 'generation error type');
check(/AVATAR_3D_GENERATION_PROVIDER_IDS/.test(types), 'provider id allowlist');
check(!/from ['"]react['"]/.test(types), 'types no React');

check(/MESHY_PRESET_RECOMMENDED/.test(meshy), 'recommended preset');
check(/textureQuality: '4k'/.test(meshy), 'recommended 4k texture');
check(/initialRemesh: false/.test(meshy), 'recommended no initial remesh');
check(/keepMaster: true/.test(meshy), 'recommended keep master');
check(/mapSettingsToMeshyImageTo3d/.test(meshy), 'meshy mapper');
check(/smart-topology/.test(meshy), 'smart topology option');
check(!/if \(provider === ['"]meshy['"]\)/.test(meshy), 'no provider if-ladder in adapter file beyond id');

check(/MESHY_MODEL_IDS/.test(edgeShared), 'edge model allowlist');
check(/Modell ungültig oder nicht erlaubt/.test(edgeShared), 'edge rejects unknown model');
check(/geometryQuality === 'maximum'/.test(edgeShared), 'ultra only from maximum geometry');
check(/MESHY_MODEL_IDS/.test(resolve), 'domain model allowlist');
check(/validateGenerationSettings/.test(resolve), 'settings validator');
check(/isPresetDirty/.test(resolve), 'dirty detect');
check(/presetLabelDe/.test(resolve), 'dirty label');
check(/listAvatar3dGenerationProviders/.test(resolve), 'provider list');

check(/export \{[\s\S]*validateGenerationSettings/.test(barrel), 'barrel validates');
check(/from '\.\/generation'/.test(avatarIndex), 'avatar index re-exports generation');

check(/DEFAULT_RECOMMENDED_SETTINGS/.test(edgeShared), 'edge recommended defaults');
check(/mapSettingsToMeshyImageTo3d/.test(edgeShared), 'edge meshy mapper');
check(/texture_resolution/.test(edgeShared), 'edge maps texture_resolution');

check(/avatar-3d-generation\.ts/.test(edge), 'edge imports generation shared');
check(/generation_settings:/.test(edge), 'edge persists generation_settings');
check(/master_storage_path/.test(edge), 'edge master path');
check(/jobRuntimePolycount/.test(edge), 'runtime poly from settings');
check(/wiredProviderIds/.test(edge), 'config exposes wired providers');
check(!/poseMode: 'a-pose',\s*\/\/ Keep avatar/.test(edge), 'no hardcoded create remesh block');

check(/textureResolution/.test(imageProvider), 'image provider accepts textureResolution');
check(/enablePbr/.test(imageProvider), 'image provider accepts enablePbr');
check(/modelType/.test(imageProvider), 'image provider accepts modelType');

check(/data-avatar-gen-preset/.test(panel), 'preset control');
check(/data-avatar-gen-summary/.test(panel), 'settings summary');
check(/data-avatar-gen-advanced-toggle/.test(panel), 'advanced toggle');
check(/AvatarGenerationAdvancedSettings/.test(panel), 'advanced component wired');
check(/presetDirty/.test(panel) || /presetDirty:/.test(service), 'dirty sent on start');
check(/settings,/.test(service) || /settings: input\.settings/.test(service), 'service sends settings');

check(/data-avatar-gen-advanced/.test(advanced), 'advanced root');
check(/capability\.settings\.map/.test(advanced), 'schema-driven fields');

check(/generation_settings JSONB/.test(migration), 'migration settings column');
check(/master_storage_path/.test(migration), 'migration master column');
check(/033_character_avatar_generation_settings\.sql/.test(applyMigrations), 'apply-migrations lists 033');

console.log('avatar-3d-generation-check OK');
