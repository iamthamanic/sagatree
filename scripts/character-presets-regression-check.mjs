/**
 * Character presets MVP regression contract (static source checks).
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function requireMatch(content, pattern, label) {
  if (!pattern.test(content)) {
    console.error(`Character presets regression check failed: missing ${label}.`);
    process.exit(1);
  }
}

function rejectMatch(content, pattern, label) {
  if (pattern.test(content)) {
    console.error(`Character presets regression check failed: ${label}.`);
    process.exit(1);
  }
}

const migration = read('supabase/migrations/012_character_presets.sql');
const migrationHardening = read('supabase/migrations/013_character_presets_rls_hardening.sql');
const types = read('src/domains/character/contracts/character-preset.types.ts');
const service = read('src/infrastructure/character/character-preset-service.ts');
const panel = read('src/app/character/progression/CharacterPresetPanel.tsx');
const dialog = read('src/app/character/creation/CreateCharacterEntryDialog.tsx');
const startingTemplatePicker = read('src/app/character/creation/StartingTemplatePicker.tsx');
const bootstrap = read('src/app/character/shared/characterEditorBootstrap.ts');
const editor = [
  read('src/app/character/edit/CharacterEditor.tsx'),
  read('src/app/character/edit/useCharacterAvatarEditor.ts'),
].join('\n');
const library = read('src/app/library/Library.tsx');
const dashboard = read('src/app/dashboard/Dashboard.tsx');
const characterTypes = read('src/domains/character/domain/sagatree-profile.entity.ts');
const characterNormalize = read('src/domains/character/use-cases/normalize-character.ts');
const characterRepository = read('src/infrastructure/character/supabase-character.repository.ts');

requireMatch(migration, /CREATE TABLE IF NOT EXISTS public\.character_presets/, 'character_presets table');
requireMatch(migration, /owner_user_id = auth\.uid\(\)/, 'owner RLS on character_presets');
requireMatch(migration, /ON DELETE SET NULL/, 'source character set-null on delete');
requireMatch(migration, /published BOOLEAN NOT NULL DEFAULT FALSE/, 'published false default');
requireMatch(migration, /published must remain false/, 'published stay false trigger');

requireMatch(migrationHardening, /origin = 'user'/, 'client writes restricted to origin user');
requireMatch(migrationHardening, /c\.owner_user_id = auth\.uid\(\)/, 'source_character ownership WITH CHECK');
requireMatch(migrationHardening, /origin is immutable/, 'origin immutable on update');

requireMatch(types, /interface CharacterPresetSnapshot/, 'preset snapshot type');
requireMatch(types, /schemaVersion: 1/, 'snapshot schema version');
rejectMatch(types, /freeSkillRanks:\s*Record<SagaTreeSkillKey,\s*number>/, 'parallel top-level freeSkillRanks on CharacterPresetSnapshot');
requireMatch(types, /sagatree_profile: SagaTreeProfileDto/, 'skill provenance via sagatree_profile');
requireMatch(types, /published: boolean/, 'published flag on preset vm/dto');

requireMatch(service, /export function assertValidSnapshot/, 'exported snapshot validation');
requireMatch(service, /assertValidSagaTreeCharacterPersistence/, 'preset snapshots delegate skill/attribute rules to character persistence');
requireMatch(service, /normalizeSafeUrl/, 'portrait_url sanitized via normalizeSafeUrl');
requireMatch(service, /Skipping invalid preset version on read/, 're-validate snapshots on read');
requireMatch(service, /createPresetFromCharacter/, 'create preset from character');
requireMatch(service, /releaseVersion/, 'append-only version release');
requireMatch(service, /Für Level .* existiert bereits/, 'reject duplicate level version');
requireMatch(service, /maybeAutoReleaseVersion/, 'auto release helper');
requireMatch(service, /\(Kopie\)/, 'duplicate name suffix');
requireMatch(service, /sourceCharacterMissing/, 'deleted source character note support');
rejectMatch(service, /value\.freeSkillRanks/, 'preset service still reads top-level value.freeSkillRanks');
rejectMatch(service, /SAGA_TREE_START_MIN_TRAINED_SKILLS/, 'preset service leftover min-trained-skills constant');
rejectMatch(service, /trainedCount/, 'preset service leftover trainedCount min-6 rule');
rejectMatch(service, /mindestens 6/, 'preset service leftover minimum 6 trained skills copy');

requireMatch(characterTypes, /presetReleaseMode\?:/, 'release mode on sagatree profile');
requireMatch(characterNormalize, /presetReleaseMode/, 'release mode normalized in character service');

requireMatch(panel, /Als Preset speichern/, 'save as preset CTA');
requireMatch(panel, /Version freigeben/, 'release version CTA');
requireMatch(panel, /Auto-Freigabe bei Level-Up/, 'auto release toggle');
requireMatch(panel, /Coming soon/, 'marketplace stub');
requireMatch(panel, /disabled/, 'marketplace button disabled');
requireMatch(panel, /Speichere den Charakter zuerst/, 'unsaved character guidance');

requireMatch(dialog, /Eigenen Charakter erstellen/, 'own character create card');
requireMatch(dialog, /Vorlage wählen/, 'vorlage choose card');
requireMatch(dialog, /Noch keine Presets/, 'empty presets state');
requireMatch(dialog, /StartingTemplatePicker/, 'starting template picker mounted');
requireMatch(dialog, /kind:\s*'starting-template'/, 'starting-template bootstrap handoff');
requireMatch(dialog, /Deine Presets/, 'user presets section');
requireMatch(dialog, /Level /, 'version level picker');
requireMatch(dialog, /setCharacterEditorBootstrap/, 'bootstrap wiring from dialog');
requireMatch(dialog, /assertValidSnapshot/, 'assert before bootstrap handoff');
requireMatch(startingTemplatePicker, /SagaTree-Starttemplates/, 'system starttemplates section');
requireMatch(startingTemplatePicker, /listSagaTreeStartingTemplates/, 'catalog list in picker');
requireMatch(startingTemplatePicker, /StartingTemplateIcon/, 'starttemplate icon per row');
requireMatch(startingTemplatePicker, /summaryDe/, 'starttemplate playstyle tooltip');
requireMatch(startingTemplatePicker, /Question/, 'starttemplate help trigger');
requireMatch(bootstrap, /kind: 'starting-template'/, 'bootstrap union includes starting-template');

requireMatch(editor, /value="settings"/, 'Einstellungen editor tab');
requireMatch(editor, /CharacterPresetPanel/, 'preset panel mounted');
requireMatch(editor, /takeCharacterEditorBootstrap/, 'bootstrap consume');
requireMatch(editor, /kind === 'starting-template'/, 'starting-template bootstrap consume');
requireMatch(editor, /getSagaTreeStartingTemplate/, 'catalog resolve for starttemplate');
requireMatch(editor, /validateSagaTreeStartingTemplate/, 'fail-closed starttemplate validate');
requireMatch(editor, /AppliedVorlageBadge/, 'vorlage badge in editor header');
requireMatch(editor, /setAppliedVorlage/, 'vorlage origin tracked after bootstrap');
requireMatch(editor, /IncompleteTabHint/, 'pulsing incomplete tab hints');
requireMatch(editor, /tabsWithOpenGaps/, 'open gaps drive tab alert icons');
requireMatch(editor, /assertValidSnapshot/, 'assert before editor hydrate');
requireMatch(editor, /normalizeSafeUrl/, 'portrait bootstrap URL sanitize');
requireMatch(editor, /updateCharacter\(savedCharacterId/, 'update existing character on save');
requireMatch(editor, /normalizeFreeSkillRanks\(profile\.freeSkillRanks\)/, 'hydrate free ranks from profile only');
rejectMatch(editor, /snapshot\.freeSkillRanks/, 'preset hydration still reads snapshot.freeSkillRanks');
rejectMatch(editor, /payload\.freeSkillRanks/, 'hydrateEditor still has freeSkillRanks override');
rejectMatch(editor, /freeSkillRanks\?:\s*Partial/, 'hydrateEditor payload still declares freeSkillRanks override');
rejectMatch(editor, /freeSkillRanks,\s*\n\s*skills: finalSkillRanks/, 'preset snapshot builder still writes top-level freeSkillRanks');
rejectMatch(dialog, /SagaTree-Presets bald/, 'old system presets stub must be gone');

requireMatch(library, /CreateCharacterEntryDialog/, 'library create dialog');
requireMatch(dashboard, /CreateCharacterEntryDialog/, 'dashboard create dialog');
rejectMatch(library, /Bibliothek Presets|Presets-Tab/, 'separate library presets tab');

console.log('Character presets regression check passed.');
