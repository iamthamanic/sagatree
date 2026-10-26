/**
 * Isolated fixtures for RPC-ATLAS-MAPS (#862).
 * Location: server/src/application/world-atlas/__tests__/fixtures.ts
 */
export const VALID_LAYERS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { discovered: true, label: 'sichtbar' },
      geometry: { type: 'Point', coordinates: [0, 0] },
    },
    {
      type: 'Feature',
      properties: { secret: true, discovered: true },
      geometry: { type: 'Point', coordinates: [1, 1] },
    },
    {
      type: 'Feature',
      properties: { discovered: false },
      geometry: { type: 'Point', coordinates: [2, 2] },
    },
    // Postgres ::boolean textual / numeric equivalents must redact for party view
    {
      type: 'Feature',
      properties: { secret: 'true', discovered: true, label: 'secret-str' },
      geometry: { type: 'Point', coordinates: [3, 3] },
    },
    {
      type: 'Feature',
      properties: { secret: 1, discovered: true, label: 'secret-num' },
      geometry: { type: 'Point', coordinates: [4, 4] },
    },
    {
      type: 'Feature',
      properties: { discovered: 'FALSE', label: 'undiscovered-str' },
      geometry: { type: 'Point', coordinates: [5, 5] },
    },
  ],
} as const;

export const DEFAULT_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 1000,
  maxY: 1000,
} as const;
