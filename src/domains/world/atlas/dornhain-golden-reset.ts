/**
 * dornhain-golden-reset — Reset-to-Golden modes + Golden place specs.
 * Location: src/domains/world/atlas/dornhain-golden-reset.ts
 *
 * Pure domain — no React / Supabase.
 */

import type { WorldPlaceKind } from '../places/world-place.types';
import { DORNHAIN_WORLD_ANCHOR } from './dornhain-unified-starter';

/** Reset dialog modes (grill 5B / 6C / 5c). */
export type DornhainGoldenResetMode = 'atlas' | 'atlas_places' | 'everything';

export type DornhainGoldenPlaceSpec = {
  readonly seedKey: string;
  readonly name: string;
  readonly kind: WorldPlaceKind;
  readonly description: string;
  readonly sortOrder: number;
  /** Parent Golden seed_key, or null for root. */
  readonly parentSeedKey: string | null;
  readonly anchor: { readonly x: number; readonly y: number } | null;
};

/** Places restored on `atlas_places` / `everything`. Marked via seed_key. */
export const DORNHAIN_GOLDEN_PLACES: readonly DornhainGoldenPlaceSpec[] = [
  {
    seedKey: 'dornhain.marktplatz',
    name: 'Marktplatz',
    kind: 'settlement',
    description: 'Dornhain Marktplatz — Startpunkt der Whisper-Road.',
    sortOrder: 0,
    parentSeedKey: null,
    anchor: DORNHAIN_WORLD_ANCHOR,
  },
  {
    seedKey: 'place.dornhain',
    name: 'Dornhain',
    kind: 'settlement',
    description: 'Stadt in Donalu — Starterschauplatz.',
    sortOrder: 10,
    parentSeedKey: null,
    anchor: DORNHAIN_WORLD_ANCHOR,
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
      return 'Stellt nur die Weltkarte auf Golden zurück. Orte und Session bleiben.';
    case 'atlas_places':
      return 'Stellt Weltkarte und Golden-Orte/Anker wieder her. Eigene Orte ohne Golden-Seed bleiben.';
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
    restoreGoldenPlaces,
    clearSessionProgress,
    sessionProgressNoteDe,
  };
}
