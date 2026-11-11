/**
 * dornhain-golden-reset — Reset-to-Golden modes + Golden place specs.
 * Location: src/domains/world/atlas/dornhain-golden-reset.ts
 *
 * Pure domain — no React / Supabase.
 */

import type { WorldPlaceKind } from '../places/world-place.types';
import { DORNHAIN_GOLDEN_MAPS, DORNHAIN_WORLD_MAP_SEED } from './dornhain-golden-hierarchy';
import { DORNHAIN_WORLD_ANCHOR } from './dornhain-unified-starter';

/** Reset dialog modes (grill 5B / 6C / 5c). */
export type DornhainGoldenResetMode = 'atlas' | 'atlas_places' | 'everything';

export type DornhainGoldenPlaceSpec = {
  readonly seedKey: string;
  readonly name: string;
  readonly kind: WorldPlaceKind;
  readonly description: string;
  readonly sortOrder: number;
  /** Parent Golden seed_key, or null for world root. */
  readonly parentSeedKey: string | null;
  readonly anchor: { readonly x: number; readonly y: number } | null;
};

/** Places restored on `atlas_places` / `everything`. Marked via seed_key. */
export const DORNHAIN_GOLDEN_PLACES: readonly DornhainGoldenPlaceSpec[] = [
  {
    seedKey: 'continent.westmark',
    name: 'Kontinent Westmark',
    kind: 'continent',
    description: 'Westlicher Kontinent Donalu (Golden-Platzhaltername).',
    sortOrder: 0,
    parentSeedKey: null,
    anchor: { x: 260, y: 420 },
  },
  {
    seedKey: 'country.westmark',
    name: 'Land Westmark',
    kind: 'country',
    description: 'Land auf dem Kontinent Westmark (Golden-Platzhaltername).',
    sortOrder: 5,
    parentSeedKey: 'continent.westmark',
    anchor: { x: 430, y: 400 },
  },
  {
    seedKey: 'place.dornhain',
    name: 'Dornhain',
    kind: 'settlement',
    description: 'Stadt in Donalu — Starterschauplatz.',
    sortOrder: 10,
    parentSeedKey: 'country.westmark',
    anchor: DORNHAIN_WORLD_ANCHOR,
  },
  {
    seedKey: 'dornhain.marktplatz',
    name: 'Marktplatz',
    kind: 'settlement',
    description: 'Dornhain Marktplatz — Startpunkt der Whisper-Road.',
    sortOrder: 15,
    parentSeedKey: 'place.dornhain',
    anchor: { x: 378, y: 488 },
  },
  {
    seedKey: 'dornhain.whisper-road',
    name: 'Whisper Road',
    kind: 'region',
    description: 'Die Whisper Road führt hinaus aus Dornhain.',
    sortOrder: 20,
    parentSeedKey: 'place.dornhain',
    anchor: { x: 420, y: 480 },
  },
  {
    seedKey: 'loc.tavern',
    name: 'Taverne Zum Flüstern',
    kind: 'building',
    description: 'Treffpunkt der Helden.',
    sortOrder: 30,
    parentSeedKey: 'place.dornhain',
    anchor: { x: 328, y: 528 },
  },
  {
    seedKey: 'loc.crypt',
    name: 'Krypta unter dem Hügel',
    kind: 'building',
    description: 'GM-Geheimnis — Reliktort unter Dornhain.',
    sortOrder: 40,
    parentSeedKey: 'place.dornhain',
    anchor: { x: 406, y: 462 },
  },
];

export function isDornhainGoldenSeedKey(seedKey: string | null | undefined): boolean {
  if (!seedKey) return false;
  return DORNHAIN_GOLDEN_PLACES.some((p) => p.seedKey === seedKey);
}

export function dornhainGoldenResetModeLabelDe(mode: DornhainGoldenResetMode): string {
  switch (mode) {
    case 'atlas':
      return 'Nur Karte';
    case 'atlas_places':
      return 'Karte und Orte';
    case 'everything':
      return 'Alles (inkl. Session-Fortschritt)';
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export function dornhainGoldenResetModeHintDe(mode: DornhainGoldenResetMode): string {
  switch (mode) {
    case 'atlas':
      return 'Stellt die gesamte Golden-Kartenhierarchie (Welt + Kindkarten) wieder her. Orte und Session bleiben.';
    case 'atlas_places':
      return 'Stellt Golden-Kartenhierarchie und Golden-Orte/Anker wieder her. Eigene Orte ohne Golden-Seed bleiben.';
    case 'everything':
      return 'Wie Karte und Orte — plus Session-Reveals/Fortschritt, sofern verfügbar.';
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

export type DornhainGoldenResetPlan = {
  readonly mode: DornhainGoldenResetMode;
  readonly restoreCanvas: boolean;
  /** World root + all Golden child map seeds. */
  readonly goldenMapSeeds: readonly string[];
  readonly restoreGoldenPlaces: boolean;
  readonly clearSessionProgress: boolean;
  /** German note when session wipe is requested but not available yet. */
  readonly sessionProgressNoteDe: string | null;
};

/**
 * Plan what a reset does. Session wipe is requested for `everything` but may be
 * unavailable until a session API exists — UI must surface `sessionProgressNoteDe`.
 */
export function planDornhainGoldenReset(
  mode: DornhainGoldenResetMode,
  options: { readonly sessionProgressResetAvailable: boolean } = {
    sessionProgressResetAvailable: false,
  },
): DornhainGoldenResetPlan {
  const restoreCanvas = true;
  const restoreGoldenPlaces = mode === 'atlas_places' || mode === 'everything';
  const wantsSession = mode === 'everything';
  const clearSessionProgress = wantsSession && options.sessionProgressResetAvailable;
  const sessionProgressNoteDe =
    wantsSession && !options.sessionProgressResetAvailable
      ? 'Session-Fortschritt konnte nicht zurückgesetzt werden — diese Funktion ist noch nicht verfügbar. Karte und Golden-Orte wurden trotzdem wiederhergestellt.'
      : null;
  return {
    mode,
    restoreCanvas,
    goldenMapSeeds: [DORNHAIN_WORLD_MAP_SEED, ...DORNHAIN_GOLDEN_MAPS.map((m) => m.seedKey)],
    restoreGoldenPlaces,
    clearSessionProgress,
    sessionProgressNoteDe,
  };
}
