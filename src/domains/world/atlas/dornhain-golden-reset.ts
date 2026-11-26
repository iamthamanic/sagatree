/**
 * dornhain-golden-reset — Reset-to-Golden modes + Golden place specs.
 * Location: src/domains/world/atlas/dornhain-golden-reset.ts
 *
 * Pure domain — no React / Supabase.
 */

import type { WorldPlaceKind } from '../places/world-place.types';
import { buildCalibratedDefaultWorld } from './atlas-default-world';
import { DORNHAIN_GOLDEN_MAPS, DORNHAIN_WORLD_MAP_SEED } from './dornhain-golden-hierarchy';
import {
  DORNHAIN_UNIFIED_LEGACY_SEEDS,
  DORNHAIN_UNIFIED_SEED,
} from './dornhain-unified-starter';

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

/** Places restored on `atlas_places` / `everything`. Driven by the calibrated Bottom-Up default world. */
export const DORNHAIN_GOLDEN_PLACES: readonly DornhainGoldenPlaceSpec[] =
  buildCalibratedDefaultWorld().places;

export function isDornhainGoldenSeedKey(seedKey: string | null | undefined): boolean {
  if (!seedKey) return false;
  return DORNHAIN_GOLDEN_PLACES.some((p) => p.seedKey === seedKey);
}

/**
 * Golden reset applies only to the Dornhain **root** world map — never to
 * arbitrary library worlds or child/detail maps in the same workbench.
 */
export function isDornhainGoldenRootMap(input: {
  readonly parentMapId: string | null | undefined;
  readonly kind?: string | null;
  readonly generatorMeta?: Readonly<Record<string, unknown>> | null;
}): boolean {
  if (input.parentMapId != null && String(input.parentMapId).trim() !== '') return false;
  const meta = input.generatorMeta ?? {};
  const seed = typeof meta.seed === 'string' ? meta.seed : '';
  if (seed === DORNHAIN_UNIFIED_SEED) return true;
  if ((DORNHAIN_UNIFIED_LEGACY_SEEDS as readonly string[]).includes(seed)) return true;
  if (meta.golden === true && meta.sagaSlug === 'dornhain.whisper') return true;
  return false;
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
