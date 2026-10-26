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
  ],
} as const;

export const DEFAULT_BOUNDS = {
  minX: 0,
  minY: 0,
  maxX: 1000,
  maxY: 1000,
} as const;
