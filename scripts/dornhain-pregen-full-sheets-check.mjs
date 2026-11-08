#!/usr/bin/env node
/**
 * dornhain-pregen-full-sheets-check — full Core sheets for Dornhain natives.
 * Location: scripts/dornhain-pregen-full-sheets-check.mjs
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const root = process.cwd();

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function mustInclude(file, needles, label) {
  const text = read(file);
  for (const needle of needles) {
    if (!text.includes(needle)) {
      throw new Error(`${label}: missing ${JSON.stringify(needle)} in ${file}`);
    }
  }
}

mustInclude(
  'src/domains/character/use-cases/dornhain-pregen-sheets.ts',
  [
    'DORNHAIN_PREGEN_SHEETS',
    'buildDornhainPregenPersistence',
    "race: 'dwarf'",
    "race: 'orc'",
    "race: 'elf'",
    "race: 'human'",
    "startingTemplateKey: 'berserker'",
    "startingTemplateKey: 'assassin'",
    "startingTemplateKey: 'mage'",
    "startingTemplateKey: 'mentalist'",
    'assertValidSagaTreeCharacterPersistence',
  ],
  'dornhain pregen domain catalog',
);

mustInclude(
  'src/domains/rules/sagatree/character-creation/index.ts',
  ['export function normalizeSagaTreeRaceKey', "zwergin: 'dwarf'"],
  'race key normalize',
);

mustInclude(
  'archive/supabase-legacy/supabase/migrations/082_dornhain_pregen_full_sheets.sql',
  [
    'nativeStarterSheetVersion',
    "'dwarf'",
    "'orc'",
    "'elf'",
    "'human'",
    '"archetype":"fighter"',
    '"archetype":"rebel"',
    '"archetype":"thinker"',
    '"archetype":"diplomat"',
    '"essence":"physical"',
    '"essence":"spiritual"',
    '"essence":"mental"',
    'seed_dornhain_starter_characters',
  ],
  'dornhain full-sheet migration',
);

mustInclude(
  'src/app/character/edit/CharacterEditor.tsx',
  ['normalizeSagaTreeRaceKey(payload.race)'],
  'editor race hydrate',
);

mustInclude(
  'src/app/library/Library.tsx',
  ['normalizeSagaTreeRaceKey(char.race)', 'getCharacterCreationOptionLabel'],
  'library race labels',
);

mustInclude(
  '.qa/acceptance/dornhain-pregen-full-sheets.md',
  ['Brenna Sturmfaust', 'sheet_status = complete', 'dwarf'],
  'acceptance artifact',
);

const outDir = join(root, '.qa/runs');
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, 'dornhain-pregen-full-sheets-check.md'),
  `# dornhain-pregen-full-sheets-check\n\nPASS ${new Date().toISOString()}\n`,
  'utf8',
);

console.log('dornhain-pregen-full-sheets-check: PASS');
process.exit(0);
