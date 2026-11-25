/**
 * atlas-biome-brush — ATL4-B01/B02 (#1310/#1311) biome & terrain sculpt helpers.
 * Location: src/domains/world/atlas/atlas-biome-brush.ts
 *
 * Pure domain — no React, no Three.js, no Host SDKs.
 * Applies deterministic terrain heightfield sculpting (raise, lower, smooth,
 * flatten) and biome strokes directly onto canonical `UnifiedCanvasDoc`.
 */

import {
  applyHeightBrush,
  emptyAtlasHeightfield,
  sampleHeightfield,
  type AtlasHeightBrushMode,
} from './atlas-heightfield';
import type { UnifiedCanvasDoc, UnifiedCanvasMaterial } from './unified-canvas-doc';

export type AtlasBiomeBrushId =
  | 'gras'
  | 'erde'
  | 'sand'
  | 'stein'
  | 'pflaster'
  | 'holz'
  | 'wasser';

export type AtlasBiomeBrushSpec = {
  readonly id: AtlasBiomeBrushId;
  readonly labelDe: string;
  readonly swatchHex: string;
  readonly material: UnifiedCanvasMaterial;
};

export const ATLAS_BIOME_BRUSHES: readonly AtlasBiomeBrushSpec[] = [
  { id: 'gras', labelDe: 'Wiese / Wald', swatchHex: '#5f8754', material: 'gras' },
  { id: 'erde', labelDe: 'Erde / Pfad', swatchHex: '#9c7c57', material: 'erde' },
  { id: 'sand', labelDe: 'Strand / Sand', swatchHex: '#d5c191', material: 'sand' },
  { id: 'stein', labelDe: 'Fels / Gebirge', swatchHex: '#848d88', material: 'stein' },
  { id: 'pflaster', labelDe: 'Pflaster', swatchHex: '#a59e8d', material: 'pflaster' },
  { id: 'holz', labelDe: 'Holzboden', swatchHex: '#a47249', material: 'holz' },
  { id: 'wasser', labelDe: 'Wasser / Fluss', swatchHex: '#2f7c8e', material: 'wasser' },
] as const;

export type AtlasTerrainSculptMode = AtlasHeightBrushMode;

export const ATLAS_TERRAIN_SCULPT_MODES: readonly {
  readonly id: AtlasTerrainSculptMode;
  readonly labelDe: string;
  readonly hintDe: string;
}[] = [
  { id: 'raise', labelDe: 'Anheben', hintDe: 'Hügel und Berge aufbauen' },
  { id: 'lower', labelDe: 'Absenken', hintDe: 'Täler und Flussbetten graben' },
  { id: 'smooth', labelDe: 'Glätten', hintDe: 'Kanten und Hänge weichzeichnen' },
  { id: 'flatten', labelDe: 'Einebnen', hintDe: 'Plateau auf Starthöhe angleichen' },
] as const;

/**
 * Apply a terrain sculpt brush dab onto `doc.heightfield` (lazily creating a
 * default heightfield when none exists yet).
 */
export function applyAtlasTerrainSculptDab(
  doc: UnifiedCanvasDoc,
  input: {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
    readonly strength: number;
    readonly op: AtlasTerrainSculptMode;
    readonly targetHeight?: number;
  },
): UnifiedCanvasDoc {
  const baseHf = doc.heightfield ?? emptyAtlasHeightfield();
  const targetHeight =
    input.op === 'flatten'
      ? (input.targetHeight ?? sampleHeightfield(baseHf, input.x, input.y) ?? 0)
      : input.targetHeight;
  const nextHf = applyHeightBrush(baseHf, {
    mode: input.op,
    x: input.x,
    z: input.y,
    radius: Math.max(12, Math.min(260, input.radius)),
    strength: Math.max(0.2, Math.min(18, input.strength)),
    targetHeight,
  });
  return {
    ...doc,
    heightfield: nextHf,
    demoSeed: false,
  };
}
