/**
 * dornhain-starter-map — Deterministic basic terrain + pins for Dornhain (#atlas).
 * Location: src/domains/world/map/dornhain-starter-map.ts
 *
 * Mirrors the host Dornhain seed so client fallbacks / tests stay aligned.
 */
import { DEFAULT_MAP_SIZE } from './constants';
import { emptyWorldMapData, tileKey, type WorldMapData, type WorldMapPin } from './world-map.types';

const DORNHAIN_PINS: readonly WorldMapPin[] = [
  { id: 'pin.tavern', x: 8, y: 12, title: 'Taverne', imagePath: null, discovered: true },
  { id: 'pin.market', x: 12, y: 10, title: 'Markt', imagePath: null, discovered: true },
  { id: 'pin.woods', x: 16, y: 14, title: 'Wald', imagePath: null, discovered: true },
  { id: 'pin.crypt', x: 18, y: 8, title: 'Krypta', imagePath: null, discovered: false },
];

/** Build a readable 24×24 Dornhain overview (grass + biomes + roads + city pins). */
export function buildDornhainStarterMapData(size = DEFAULT_MAP_SIZE): WorldMapData {
  const n = Math.max(16, Math.min(size, 40));
  const base = emptyWorldMapData(n);
  const tiles = { ...base.tiles };

  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const key = tileKey(x, y);
      if (x <= 2 || (x <= 4 && y >= n - 6)) {
        tiles[key] = { type: 'water', countryId: null };
      } else if (y <= 2 || (y <= 4 && x >= n - 8)) {
        tiles[key] = { type: 'mountain', countryId: null };
      } else if (x >= n - 5 || (x >= n - 7 && y >= 10 && y <= 18)) {
        tiles[key] = { type: 'forest', countryId: null };
      }
    }
  }

  // Simple roads linking market ↔ tavern ↔ woods
  const road: Array<[number, number]> = [];
  for (let x = 8; x <= 12; x += 1) road.push([x, 11]);
  for (let y = 10; y <= 12; y += 1) road.push([10, y]);
  for (let x = 12; x <= 16; x += 1) road.push([x, 12]);
  for (const [x, y] of road) {
    if (x >= 0 && y >= 0 && x < n && y < n) {
      tiles[tileKey(x, y)] = { type: 'road', countryId: null };
    }
  }

  for (const pin of DORNHAIN_PINS) {
    if (pin.x < n && pin.y < n) {
      tiles[tileKey(pin.x, pin.y)] = { type: 'city', countryId: null };
    }
  }

  return {
    size: n,
    tiles,
    countries: [],
    pins: DORNHAIN_PINS.filter((p) => p.x < n && p.y < n),
  };
}
