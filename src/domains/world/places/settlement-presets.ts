/**
 * Settlement presets for atlas place authoring (Großstadt / Stadt / Dorf).
 * Location: src/domains/world/places/settlement-presets.ts
 *
 * Pure domain — maps UI presets to WorldPlace seedKey + stamp size hints.
 */

import type { WorldPlaceKind } from './world-place.types';

export type AtlasPlaceAuthorKind = 'region' | 'settlement' | 'building';

export type SettlementPresetId = 'city' | 'town' | 'village';

export type SettlementPreset = {
  readonly id: SettlementPresetId;
  readonly labelDe: string;
  /** Stored on world_places.seed_key for stable filtering. */
  readonly seedKey: string;
  /** Relative stamp size for UnifiedCanvas haus marker. */
  readonly stampSize: number;
};

export const SETTLEMENT_PRESETS: readonly SettlementPreset[] = [
  { id: 'city', labelDe: 'Großstadt', seedKey: 'settlement.city', stampSize: 1.45 },
  { id: 'town', labelDe: 'Stadt', seedKey: 'settlement.town', stampSize: 1.15 },
  { id: 'village', labelDe: 'Dorf', seedKey: 'settlement.village', stampSize: 0.9 },
] as const;

export const BASIC_BUILDING_SEED_KEY = 'building.basic';
export const BASIC_BUILDING_STAMP_SIZE = 0.85;

export function settlementPresetById(id: string): SettlementPreset | null {
  return SETTLEMENT_PRESETS.find((p) => p.id === id) ?? null;
}

export function placeKindForAuthor(kind: AtlasPlaceAuthorKind): WorldPlaceKind {
  if (kind === 'region') return 'region';
  if (kind === 'building') return 'building';
  return 'settlement';
}

export function seedKeyForAuthor(
  kind: AtlasPlaceAuthorKind,
  settlementPresetId: SettlementPresetId | null,
): string {
  if (kind === 'region') return 'region.named';
  if (kind === 'building') return BASIC_BUILDING_SEED_KEY;
  const preset = settlementPresetId
    ? settlementPresetById(settlementPresetId)
    : SETTLEMENT_PRESETS[1];
  return preset?.seedKey ?? 'settlement.town';
}

export function stampSizeForAuthor(
  kind: AtlasPlaceAuthorKind,
  settlementPresetId: SettlementPresetId | null,
): number {
  if (kind === 'building') return BASIC_BUILDING_STAMP_SIZE;
  if (kind === 'region') return 1.3;
  const preset = settlementPresetId
    ? settlementPresetById(settlementPresetId)
    : SETTLEMENT_PRESETS[1];
  return preset?.stampSize ?? 1.15;
}
