/**
 * Context packs — ID-only membership over builtin-standard definitions (#137).
 * Same definition may appear in multiple packs; no duplicated ItemDefinition.
 * Location: src/domains/items/packs/context-packs.ts
 *
 * Domain-pure: no React, no backend clients, no UI imports.
 */

import type { ItemPack } from '../pack';

function pack(
  id: string,
  name: string,
  description: string,
  settingTags: ItemPack['settingTags'],
  definitionIds: readonly string[],
): ItemPack {
  return Object.freeze({
    id,
    version: 1,
    name,
    description,
    settingTags,
    definitionIds: Object.freeze([...definitionIds]),
  });
}

/** Adventure / exploration staples across fantasy & sci-fi. */
export const CONTEXT_PACK_ADVENTURE = pack(
  'builtin:context-adventure',
  'Adventure',
  'Reise-, Licht- und Erkundungsgegenstände für Abenteuerstarts.',
  ['fantasy', 'sci-fi'],
  [
    'builtin.fantasy.torch',
    'builtin.fantasy.lantern',
    'builtin.fantasy.rope',
    'builtin.fantasy.grappling-hook',
    'builtin.fantasy.backpack',
    'builtin.fantasy.map',
    'builtin.fantasy.compass',
    'builtin.fantasy.travel-rations',
    'builtin.fantasy.waterskin',
    'builtin.scifi.flashlight',
    'builtin.scifi.navigation-module',
    'builtin.scifi.universal-backpack',
    'builtin.scifi.emergency-ration',
    'builtin.scifi.signal-beacon',
  ],
);

/** Combat-focused gear. */
export const CONTEXT_PACK_COMBAT = pack(
  'builtin:context-combat',
  'Combat',
  'Waffen, Schutz und Munition ohne Markenbezug.',
  ['fantasy', 'sci-fi'],
  [
    'builtin.fantasy.longsword',
    'builtin.fantasy.shortsword',
    'builtin.fantasy.dagger',
    'builtin.fantasy.battle-axe',
    'builtin.fantasy.warhammer',
    'builtin.fantasy.spear',
    'builtin.fantasy.quarterstaff',
    'builtin.fantasy.shortbow',
    'builtin.fantasy.longbow',
    'builtin.fantasy.crossbow',
    'builtin.fantasy.arrows',
    'builtin.fantasy.bolts',
    'builtin.fantasy.light-shield',
    'builtin.fantasy.leather-armor',
    'builtin.fantasy.chainmail',
    'builtin.fantasy.plate-armor',
    'builtin.scifi.compact-energy-weapon',
    'builtin.scifi.standard-energy-weapon',
    'builtin.scifi.heavy-energy-rifle',
    'builtin.scifi.stun-device',
    'builtin.scifi.energy-blade',
    'builtin.scifi.light-protective-suit',
    'builtin.scifi.tactical-protective-suit',
    'builtin.scifi.heavy-protective-suit',
    'builtin.scifi.personal-shield-emitter',
    'builtin.scifi.ammo-pack',
  ],
);

/** Survival / outdoor readiness. */
export const CONTEXT_PACK_SURVIVAL = pack(
  'builtin:context-survival',
  'Survival',
  'Überleben, Licht, Nahrung und Behelfsmittel.',
  ['fantasy', 'sci-fi', 'contemporary'],
  [
    'builtin.fantasy.travel-rations',
    'builtin.fantasy.waterskin',
    'builtin.fantasy.torch',
    'builtin.fantasy.rope',
    'builtin.fantasy.blanket',
    'builtin.fantasy.tinderbox',
    'builtin.scifi.emergency-ration',
    'builtin.scifi.water-purifier',
    'builtin.scifi.breathing-apparatus',
    'builtin.scifi.signal-beacon',
    'builtin.scifi.cable-tether',
    'builtin.contemporary.flashlight',
    'builtin.contemporary.lighter',
    'builtin.contemporary.water-bottle',
    'builtin.contemporary.powerbank',
    'builtin.contemporary.duct-tape',
    'builtin.contemporary.first-aid-kit',
  ],
);

/** Medical kits and consumables. */
export const CONTEXT_PACK_MEDICAL = pack(
  'builtin:context-medical',
  'Medical',
  'Heilmittel, Medkits und Antitoxine.',
  ['fantasy', 'sci-fi', 'contemporary'],
  [
    'builtin.fantasy.healing-potion',
    'builtin.fantasy.antidote',
    'builtin.fantasy.healer-kit',
    'builtin.scifi.medkit',
    'builtin.scifi.hypospray',
    'builtin.scifi.antitoxin',
    'builtin.contemporary.first-aid-kit',
    'builtin.contemporary.medication',
  ],
);

/** Office / workplace. */
export const CONTEXT_PACK_OFFICE = pack(
  'builtin:context-office',
  'Office',
  'Büro- und Arbeitsplatzgegenstände der Gegenwart.',
  ['contemporary'],
  [
    'builtin.contemporary.smartphone',
    'builtin.contemporary.laptop',
    'builtin.contemporary.tablet',
    'builtin.contemporary.notebook',
    'builtin.contemporary.ballpoint-pen',
    'builtin.contemporary.document-folder',
    'builtin.contemporary.contract',
    'builtin.contemporary.key-card',
    'builtin.contemporary.id-card',
    'builtin.contemporary.coffee-cup',
    'builtin.contemporary.charger',
  ],
);

/** Domestic / household. */
export const CONTEXT_PACK_DOMESTIC = pack(
  'builtin:context-domestic',
  'Domestic',
  'Haushalts- und Alltagsgegenstände.',
  ['contemporary', 'fantasy'],
  [
    'builtin.contemporary.groceries',
    'builtin.contemporary.kitchen-knife',
    'builtin.contemporary.shopping-bag',
    'builtin.contemporary.keyring',
    'builtin.contemporary.coffee-cup',
    'builtin.contemporary.medication',
    'builtin.contemporary.lighter',
    'builtin.contemporary.work-clothes',
    'builtin.fantasy.blanket',
    'builtin.fantasy.keyring',
  ],
);

/** Social / interpersonal props. */
export const CONTEXT_PACK_SOCIAL = pack(
  'builtin:context-social',
  'Social',
  'Soziale Requisiten, Kommunikation und Wertgegenstände.',
  ['fantasy', 'sci-fi', 'contemporary'],
  [
    'builtin.contemporary.smartphone',
    'builtin.contemporary.wallet',
    'builtin.contemporary.cash',
    'builtin.contemporary.coffee-cup',
    'builtin.contemporary.contract',
    'builtin.contemporary.guitar',
    'builtin.fantasy.sealed-letter',
    'builtin.fantasy.coin-purse',
    'builtin.fantasy.gemstone',
    'builtin.fantasy.musical-instrument',
    'builtin.scifi.communicator',
    'builtin.scifi.credits',
    'builtin.scifi.encrypted-file',
  ],
);

/** Sports. */
export const CONTEXT_PACK_SPORTS = pack(
  'builtin:context-sports',
  'Sports',
  'Sport- und Trainingsgegenstände.',
  ['contemporary'],
  [
    'builtin.contemporary.soccer-ball',
    'builtin.contemporary.whistle',
    'builtin.contemporary.sports-bag',
    'builtin.contemporary.bike-helmet',
    'builtin.contemporary.water-bottle',
    'builtin.contemporary.first-aid-kit',
  ],
);

/** Science / research. */
export const CONTEXT_PACK_SCIENCE = pack(
  'builtin:context-science',
  'Science',
  'Analyse-, Proben- und Forschungsausrüstung.',
  ['sci-fi', 'fantasy'],
  [
    'builtin.scifi.hand-scanner',
    'builtin.scifi.multi-scanner',
    'builtin.scifi.research-kit',
    'builtin.scifi.sample-container',
    'builtin.scifi.datapad',
    'builtin.scifi.data-chip',
    'builtin.fantasy.book',
  ],
);

/** Engineering / repair. */
export const CONTEXT_PACK_ENGINEERING = pack(
  'builtin:context-engineering',
  'Engineering',
  'Werkzeug, Reparaturmaterial und technische Hilfsmittel.',
  ['sci-fi', 'fantasy', 'contemporary'],
  [
    'builtin.scifi.engineering-kit',
    'builtin.scifi.precision-tools',
    'builtin.scifi.repair-material',
    'builtin.scifi.multitool',
    'builtin.scifi.energy-cell',
    'builtin.scifi.portable-energy-pack',
    'builtin.scifi.cable-tether',
    'builtin.scifi.equipment-bag',
    'builtin.fantasy.craftsman-tools',
    'builtin.contemporary.toolbox',
    'builtin.contemporary.duct-tape',
    'builtin.contemporary.work-gloves',
    'builtin.contemporary.work-clothes',
  ],
);

/** Travel. */
export const CONTEXT_PACK_TRAVEL = pack(
  'builtin:context-travel',
  'Travel',
  'Reisegepäck, Orientierung und Unterwegs-Versorgung.',
  ['fantasy', 'sci-fi', 'contemporary'],
  [
    'builtin.fantasy.backpack',
    'builtin.fantasy.map',
    'builtin.fantasy.compass',
    'builtin.fantasy.travel-rations',
    'builtin.scifi.universal-backpack',
    'builtin.scifi.navigation-module',
    'builtin.scifi.emergency-ration',
    'builtin.contemporary.backpack',
    'builtin.contemporary.transit-ticket',
    'builtin.contemporary.car-keys',
    'builtin.contemporary.drivers-license',
    'builtin.contemporary.umbrella',
    'builtin.contemporary.powerbank',
  ],
);

/** Entertainment. */
export const CONTEXT_PACK_ENTERTAINMENT = pack(
  'builtin:context-entertainment',
  'Entertainment',
  'Unterhaltung und Freizeitrequisiten.',
  ['fantasy', 'contemporary'],
  [
    'builtin.fantasy.musical-instrument',
    'builtin.fantasy.book',
    'builtin.contemporary.headphones',
    'builtin.contemporary.guitar',
    'builtin.contemporary.tablet',
    'builtin.contemporary.soccer-ball',
  ],
);

/** Urban / city life. */
export const CONTEXT_PACK_URBAN = pack(
  'builtin:context-urban',
  'Urban',
  'Stadtalltag: Zugang, Zahlung, Mobilität.',
  ['contemporary', 'fantasy', 'sci-fi'],
  [
    'builtin.contemporary.smartphone',
    'builtin.contemporary.wallet',
    'builtin.contemporary.cash',
    'builtin.contemporary.bank-card',
    'builtin.contemporary.id-card',
    'builtin.contemporary.keyring',
    'builtin.contemporary.key-card',
    'builtin.contemporary.transit-ticket',
    'builtin.contemporary.car-keys',
    'builtin.contemporary.umbrella',
    'builtin.contemporary.flashlight',
    'builtin.fantasy.lockpicks',
    'builtin.fantasy.coin-purse',
    'builtin.scifi.access-card',
    'builtin.scifi.identity-module',
    'builtin.scifi.credits',
  ],
);

/** Space / EVA. */
export const CONTEXT_PACK_SPACE = pack(
  'builtin:context-space',
  'Space',
  'Raumfahrt- und EVA-Ausrüstung ohne Franchise-Bezug.',
  ['sci-fi'],
  [
    'builtin.scifi.spacesuit',
    'builtin.scifi.breathing-apparatus',
    'builtin.scifi.signal-beacon',
    'builtin.scifi.cable-tether',
    'builtin.scifi.portable-energy-pack',
    'builtin.scifi.communicator',
    'builtin.scifi.navigation-module',
    'builtin.scifi.energy-cell',
    'builtin.scifi.universal-backpack',
  ],
);

/** All context packs in stable declaration order. */
export const CONTEXT_PACKS: readonly ItemPack[] = Object.freeze([
  CONTEXT_PACK_ADVENTURE,
  CONTEXT_PACK_COMBAT,
  CONTEXT_PACK_SURVIVAL,
  CONTEXT_PACK_MEDICAL,
  CONTEXT_PACK_OFFICE,
  CONTEXT_PACK_DOMESTIC,
  CONTEXT_PACK_SOCIAL,
  CONTEXT_PACK_SPORTS,
  CONTEXT_PACK_SCIENCE,
  CONTEXT_PACK_ENGINEERING,
  CONTEXT_PACK_TRAVEL,
  CONTEXT_PACK_ENTERTAINMENT,
  CONTEXT_PACK_URBAN,
  CONTEXT_PACK_SPACE,
]);
