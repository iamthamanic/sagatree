/**
 * Isolated fixtures for RPC-WORLD-MAP (#861).
 * Location: server/src/application/world-map/__tests__/fixtures.ts
 */
export const VALID_MAP = {
  size: 24,
  tiles: {},
  countries: [],
  pins: [],
} as const;

export const MAP_WITH_HIDDEN_PIN = {
  size: 24,
  tiles: {},
  countries: [],
  pins: [
    { id: 'visible', discovered: true, imagePath: 'maps/pin-a.png' },
    { id: 'secret', discovered: false, imagePath: 'maps/pin-b.png' },
  ],
} as const;
