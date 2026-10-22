#!/usr/bin/env node
/**
 * avatar-v2-template-creator-flow-check — deterministic tests for #260.
 * Location: scripts/avatar-v2-template-creator-flow-check.mjs
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function check(cond, msg) {
  if (!cond) {
    console.error(`avatar-v2-template-creator-flow-check FAIL: ${msg}`);
    process.exit(1);
  }
}

const ingress = read('src/domains/character/avatar/species-template-ingress-v1.ts');
const index = read('src/domains/character/avatar/index.ts');
const source = read('src/domains/character/avatar/avatar-source.ts');
const entity = read('src/domains/character/domain/character.entity.ts');
const picker = read('src/app/character/avatar/AvatarSpeciesTemplatePicker.tsx');
const editor = [
  read('src/app/character/edit/CharacterEditor.tsx'),
  read('src/app/character/edit/useCharacterAvatarEditor.ts'),
].join('\n');
const manifests = read('src/infrastructure/character/avatar/avatar-asset-manifests.ts');

check(/applySpeciesTemplateIngress/.test(ingress), 'ingress apply');
check(/projectTemplateBasicOutfitVisuals/.test(ingress), 'outfit projection');
check(/DEFAULT_TEMPLATE_BASIC_OUTFIT_IDS/.test(ingress), 'default outfit');
check(!/from ['"]react['"]/.test(ingress), 'ingress no React');
check(!/dwarf.*compact|halfling.*compact|orc.*heavy/.test(picker), 'picker no species→family hardcode');
check(/listTemplateCreatorPickerItems/.test(picker), 'picker uses domain list');
check(/TooltipContent/.test(picker) && /lookSummaryDe/.test(picker), 'look summary in tooltip');
check(/Question/.test(picker) && /species-template-help-/.test(picker), 'help icon beside title');
check(!/text-xs opacity-90/.test(picker), 'no inline look summary under title');
check(/grid grid-cols-3/.test(picker), 'species cards always 3-col');
check(/Vorlage anpassen/.test(source), 'source label Vorlage anpassen');
check(/template_id\?:/.test(entity), 'DTO template_id');
check(/body_family\?:/.test(entity), 'DTO body_family');
check(/starter_wardrobe\?:/.test(entity), 'DTO starter_wardrobe');
check(/applySpeciesTemplateIngress/.test(index), 'barrel apply');
check(/AvatarSpeciesTemplatePicker/.test(editor), 'editor mounts picker');
check(/applySpeciesTemplate/.test(editor), 'editor apply handler');
check(/avatarSource === 'sagatree'/.test(editor), 'picker gated by sagatree source');
check(/body_family/.test(manifests) && /resolveBaseBodyModelUrl/.test(manifests), 'model url by family');

const outDir = join(root, 'node_modules/.cache/avatar-v2-template-creator-flow-check');
mkdirSync(outDir, { recursive: true });
const outfile = join(outDir, 'ingress.mjs');
await build({
  entryPoints: [join(root, 'src/domains/character/avatar/species-template-ingress-v1.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  logLevel: 'silent',
});
const m = await import(outfile + `?t=${Date.now()}`);

const assert = m.assertTemplateCreatorFlowInvariants({});
check(assert.ok, `invariants: ${assert.issues.join('; ')}`);

const dwarf = m.applySpeciesTemplateIngress('dwarf');
check(dwarf.bodyFamily === 'compact', 'dwarf → compact');
check(dwarf.templateId === 'species-template:dwarf', 'dwarf template id');
check(dwarf.starterWardrobeIds.includes('basic-shirt'), 'dwarf basic shirt');
check(dwarf.traits.clothing.length > 0, 'dwarf clothing trait');

const orc = m.applySpeciesTemplateIngress('orc');
check(orc.bodyFamily === 'heavy', 'orc → heavy');

const human = m.applySpeciesTemplateIngress('human');
check(human.bodyFamily === 'standard', 'human → standard');

const visuals = m.projectTemplateBasicOutfitVisuals({ seed: dwarf });
check(visuals.length === dwarf.starterWardrobeIds.length, 'visual count');
check(visuals.every((v) => v.attachment === 'skinned' && v.status === 'ready'), 'visuals ready skinned');

const items = m.listTemplateCreatorPickerItems();
check(items.length === 7, 'seven picker items');
check(
  !items.some((item) => item.speciesId === 'dwarf' && item.bodyFamily !== 'compact'),
  'picker DTO family from domain',
);

check(existsSync(join(root, '.qa/acceptance/avatar-v2-template-creator-flow.md')), 'acceptance exists');

console.log('avatar-v2-template-creator-flow-check PASS');
