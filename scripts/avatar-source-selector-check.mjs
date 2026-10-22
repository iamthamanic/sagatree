#!/usr/bin/env node
/**
 * avatar-source-selector-check — deterministic tests for #14 avatar source selector.
 * Location: scripts/avatar-source-selector-check.mjs
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';

function read(rel) {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
}

function check(cond, msg) {
  if (!cond) {
    console.error(`avatar-source-selector-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const domain = read('src/domains/character/avatar/avatar-source.ts');
const index = read('src/domains/character/avatar/index.ts');
const entity = read('src/domains/character/domain/character.entity.ts');
const presets = read('src/domains/character/use-cases/avatar-presets.ts');
const selector = read('src/app/character/avatar/AvatarSourceSelector.tsx');
const editor = [
  read('src/app/character/edit/CharacterEditor.tsx'),
  read('src/app/character/edit/useCharacterAvatarEditor.ts'),
].join('\n');

check(/AVATAR_SOURCE_CONTRACT_VERSION/.test(domain), 'contract version');
check(/resolveAvatarSource/.test(domain), 'resolve helper');
check(/LEGACY_AVATAR_PROVIDER/.test(domain), 'legacy provider const');
check(/evaluateAvatarSourceSwitch/.test(domain), 'dirty switch');
check(/describeAvatarSourceCapabilities/.test(domain), 'capability summary');
check(!/from ['"]react['"]/.test(domain), 'domain no React');

check(/export \{[\s\S]*resolveAvatarSource/.test(index), 'barrel resolve');
check(/evaluateAvatarSourceSwitch/.test(index), 'barrel switch');

check(/source\?: 'sagatree' \| 'import' \| 'meshy'/.test(entity), 'DTO source field');
check(/source: input\.source \?\? 'sagatree'/.test(presets), 'preset writes source');
check(/LEGACY_AVATAR_PROVIDER/.test(presets), 'preset uses legacy const');

check(/data-avatar-source-card/.test(selector), 'card attrs');
check(/data-avatar-source-capability-summary/.test(selector), 'summary attr');
check(/AVATAR_SOURCE_OPTIONS/.test(selector), 'uses domain options');
check(/Vorlage anpassen/.test(domain), 'Vorlage anpassen label in domain');
check(/3D-Modell importieren/.test(domain), 'Import label in domain');
check(/Mit KI erstellen/.test(domain), 'Meshy label in domain');
check(/TooltipContent/.test(selector) && /summaryDe/.test(selector), 'summary in tooltip');
check(/Question/.test(selector) && /avatar-source-help-/.test(selector), 'help icon beside title');
check(!/text-xs opacity-90/.test(selector), 'no inline summary under title');
check(/grid grid-cols-3/.test(selector), 'source cards always 3-col');

check(/AvatarSourceSelector/.test(editor), 'editor mounts selector');
check(/requestAvatarSourceChange/.test(editor), 'switch handler');
check(/resolveAvatarSource/.test(editor), 'hydrate resolve');
check(/avatarSource === 'import'/.test(editor), 'import flow gated');
check(/avatarSource === 'meshy'/.test(editor), 'meshy flow gated');
check(/window\.confirm/.test(editor), 'dirty confirm');

// pure replicas
function resolveAvatarSource(input) {
  const sources = ['sagatree', 'import', 'meshy'];
  if (sources.includes(input.source)) return input.source;
  if (input.provider === 'm3-character-studio') return 'sagatree';
  if (typeof input.modelUrl === 'string' && input.modelUrl.trim()) return 'import';
  return 'sagatree';
}
check(resolveAvatarSource({ provider: 'm3-character-studio' }) === 'sagatree', 'legacy→sagatree');
check(resolveAvatarSource({ modelUrl: 'https://x/a.glb' }) === 'import', 'model→import');
check(resolveAvatarSource({ source: 'meshy' }) === 'meshy', 'explicit meshy');
check(resolveAvatarSource({}) === 'sagatree', 'default sagatree');

function evaluateSwitch(from, to, dirty) {
  if (from === to) return false;
  return from === 'sagatree' && dirty && to !== 'sagatree';
}
check(evaluateSwitch('sagatree', 'import', true) === true, 'dirty needs confirm');
check(evaluateSwitch('sagatree', 'import', false) === false, 'clean no confirm');

console.log('avatar-source-selector-check PASS');
