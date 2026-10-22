import { readFileSync } from 'node:fs';
import process from 'node:process';

const source = readFileSync(new URL('../src/domains/rules/sagatree/background-templates/index.ts', import.meta.url), 'utf8');
const carousel = readFileSync(new URL('../src/app/character/creation/BackgroundCarousel.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/app/character/creation/CharacterBackgroundPanel.tsx', import.meta.url), 'utf8');

function requireMatch(content, pattern, label) {
  if (pattern.test(content)) return;
  console.error(`Background framework regression check failed: missing ${label}.`);
  process.exit(1);
}

function rejectMatch(content, pattern, label) {
  if (!pattern.test(content)) return;
  console.error(`Background framework regression check failed: ${label}.`);
  process.exit(1);
}

const expectedFrameworks = [
  ['stage-public', 'Bühne & Öffentlichkeit'],
  ['sport-competition', 'Sport & Wettkampf'],
  ['border-scout', 'Natur & Wildnis'],
  ['academy-research', 'Akademie & Forschung'],
  ['corporate-technician', 'Handwerk & Technik'],
  ['street-doctor', 'Heilung & Fürsorge'],
  ['soldier', 'Militär & Wachdienst'],
  ['smuggler', 'Unterwelt & Grauzone'],
  ['investigator', 'Ermittlung & Information'],
  ['trade-networks', 'Handel & Netzwerke'],
  ['privilege-elite', 'Privileg & Elite'],
  ['faith-order', 'Glaube & Orden'],
  ['travel-transport', 'Reise & Transport'],
  ['organization-administration', 'Organisation & Verwaltung'],
  ['service-supply', 'Service & Versorgung'],
  ['family-community', 'Familie & Gemeinschaft'],
  ['law-institutions', 'Recht & Institutionen'],
];

const expectedIcons = [
  ['stage-public', 'MaskHappy'],
  ['sport-competition', 'Trophy'],
  ['border-scout', 'Tree'],
  ['academy-research', 'GraduationCap'],
  ['corporate-technician', 'Wrench'],
  ['street-doctor', 'Heartbeat'],
  ['soldier', 'Shield'],
  ['smuggler', 'Fingerprint'],
  ['investigator', 'MagnifyingGlass'],
  ['trade-networks', 'Handshake'],
  ['privilege-elite', 'Crown'],
  ['faith-order', 'Flame'],
  ['travel-transport', 'Compass'],
  ['organization-administration', 'ClipboardText'],
  ['service-supply', 'HandPointing'],
  ['family-community', 'UsersThree'],
  ['law-institutions', 'Scales'],
];

for (const [id, name] of expectedFrameworks) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  requireMatch(source, new RegExp(`id:\\s*'${escapedId}'[\\s\\S]{0,180}?name:\\s*'${escapedName}'`), `${name} framework (${id})`);
}

for (const [id, icon] of expectedIcons) {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  requireMatch(carousel, new RegExp(`['"]?${escapedId}['"]?\\s*:\\s*${icon}\\b`), `${id} icon ${icon}`);
}

const frameworkCount = (source.match(/\n    examples:\s*\[/g) ?? []).length;
if (frameworkCount !== expectedFrameworks.length) {
  console.error(`Background framework regression check failed: expected ${expectedFrameworks.length} frameworks, found ${frameworkCount}.`);
  process.exit(1);
}

requireMatch(source, /examples:\s*readonly string\[\]/, 'framework example contract');
requireMatch(source, /worldProfileIds\?:\s*readonly string\[\]/, 'world-profile framework filtering contract');
requireMatch(source, /skillPool:\s*readonly \[SagaTreeSkillKey, SagaTreeSkillKey, SagaTreeSkillKey, SagaTreeSkillKey\]/, 'fixed four-skill framework pool');
requireMatch(source, /validateSagaTreeBackgroundTemplateCatalog/, 'framework catalog runtime validation');
requireMatch(carousel, /'Hintergrund Framework'/, 'framework terminology in carousel');
requireMatch(carousel, /'Freier Hintergrund'/, 'free background terminology in carousel');
requireMatch(carousel, /option\.template\.examples\.join/, 'cross-setting examples shown in carousel');
requireMatch(carousel, /data-background-framework-icon/, 'framework icon test hook');
requireMatch(carousel, /:\s*PencilSimpleLine\s*;/, 'custom background PencilSimpleLine icon');
requireMatch(panel, /adjustBackgroundSkillPoints/, 'stackable background point adjust helper');
requireMatch(panel, /Hintergrundpunkt erhöhen/, 'in-node background point increase control');
requireMatch(panel, /data-background-points-budget/, 'background points budget badge');
requireMatch(panel, /data-training-view=/, 'pool training view hook');
requireMatch(panel, /visibleSkillNodes/, 'four pool skill nodes remain visible');
requireMatch(panel, /Spezialisieren/, 'in-node specialize control');
requireMatch(panel, /getBackgroundSpecializationSuggestionNames/, 'specialization suggestion dropdown source');
requireMatch(source, /specializationSuggestions must contain at least five entries/, 'five specialization suggestions per framework');
requireMatch(source, /getBackgroundSpecializationSuggestionNames/, 'shared specialization suggestion helper');

rejectMatch(panel, /Auswahl ändern/, 'legacy two-toggle edit action remains');

rejectMatch(source, /recommendedTraining/, 'static or compatibility background training recommendations remain');
rejectMatch(panel, />Empfohlen</, 'static Empfohlen badge remains in the background training UI');
rejectMatch(source, /name:\s*'Grenzscout'/, 'legacy Grenzscout remains a visible Core framework name');
rejectMatch(source, /name:\s*'Konzerntechniker'/, 'legacy Konzerntechniker remains a visible Core framework name');
rejectMatch(source, /name:\s*'Straßenarzt'/, 'legacy Straßenarzt remains a visible Core framework name');
rejectMatch(source, /name:\s*'Soldat'/, 'legacy Soldat remains a visible Core framework name');
rejectMatch(source, /name:\s*'Schmuggler'/, 'legacy Schmuggler remains a visible Core framework name');
rejectMatch(source, /name:\s*'Ermittler'/, 'legacy Ermittler remains a visible Core framework name');
rejectMatch(source, /Natur & Grenzland/, 'deprecated Natur & Grenzland terminology remains');

console.log(`Background framework regression check passed (${expectedFrameworks.length} Core frameworks, stackable 2-point allocator, unique icons).`);
