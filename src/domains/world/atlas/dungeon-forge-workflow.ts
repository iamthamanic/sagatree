/**
 * dungeon-forge-workflow — preview / commit / safe-reforge helpers for Atlas dungeon forge.
 * Location: src/domains/world/atlas/dungeon-forge-workflow.ts
 *
 * Pure domain: never mutates canonical docs unless callers apply the returned next doc.
 * Failed generate stays outside this module (caller must not call commit).
 */

import type {
  UnifiedCanvasDoc,
  UnifiedCanvasDoor,
  UnifiedCanvasObject,
  UnifiedCanvasRoom,
  UnifiedCanvasWall,
} from './unified-canvas-doc';
import type { DungeonGenerateResult } from './dungeon-generator';
import type { DungeonRasterizeResult } from './dungeon-grid';

const DUNGEON_ID_RE = /^(droom-|dwall-|dcorr-|dgrid-|dlamp-|dchest-)/;

export function isDungeonGeneratedFeatureId(id: string): boolean {
  return DUNGEON_ID_RE.test(id);
}

/** Remove previously committed generator features (rooms/walls/objects/doors). */
export function stripDungeonGeneratedFeatures(doc: UnifiedCanvasDoc): UnifiedCanvasDoc {
  const walls = doc.walls.filter((w) => !isDungeonGeneratedFeatureId(w.id));
  const wallIds = new Set(walls.map((w) => w.id));
  return {
    ...doc,
    rooms: doc.rooms.filter((r) => !isDungeonGeneratedFeatureId(r.id)),
    walls,
    objects: doc.objects.filter((o) => !isDungeonGeneratedFeatureId(o.id)),
    doors: (doc.doors ?? []).filter(
      (d) =>
        !isDungeonGeneratedFeatureId(d.id) &&
        !isDungeonGeneratedFeatureId(d.wallId) &&
        wallIds.has(d.wallId),
    ),
  };
}

export type DungeonCommitPayload = {
  readonly rooms: readonly UnifiedCanvasRoom[];
  readonly walls: readonly UnifiedCanvasWall[];
  readonly objects: readonly UnifiedCanvasObject[];
  readonly doors: readonly UnifiedCanvasDoor[];
};

export function dungeonCommitPayloadFromResults(
  generate: DungeonGenerateResult,
  raster: DungeonRasterizeResult,
): DungeonCommitPayload | null {
  if (!generate.valid || !raster.valid || !raster.passable) return null;
  return {
    rooms: raster.canvasRooms,
    walls: raster.canvasWalls,
    objects: generate.canvasObjects,
    doors: raster.canvasDoors,
  };
}

/**
 * Merge preview geometry into a display-only doc (canonical map unchanged until commit).
 * Strips prior dungeon IDs first so preview replaces old forge output visually.
 */
export function mergeDungeonPreviewIntoDoc(
  doc: UnifiedCanvasDoc,
  payload: DungeonCommitPayload,
): UnifiedCanvasDoc {
  const base = stripDungeonGeneratedFeatures(doc);
  return {
    ...base,
    demoSeed: false,
    rooms: [...base.rooms, ...payload.rooms],
    walls: [...base.walls, ...payload.walls],
    objects: [...base.objects, ...payload.objects],
    doors: [...(base.doors ?? []), ...payload.doors],
  };
}

/**
 * Commit dungeon features into the canonical doc.
 * `replaceGenerated=true` (reforge) removes prior generator IDs; user-drawn features stay.
 */
export function commitDungeonFeaturesToDoc(
  doc: UnifiedCanvasDoc,
  payload: DungeonCommitPayload,
  replaceGenerated: boolean,
): UnifiedCanvasDoc {
  const base = replaceGenerated ? stripDungeonGeneratedFeatures(doc) : doc;
  return {
    ...base,
    demoSeed: false,
    rooms: [...base.rooms, ...payload.rooms],
    walls: [...base.walls, ...payload.walls],
    objects: [...base.objects, ...payload.objects],
    doors: [...(base.doors ?? []), ...payload.doors],
  };
}
