/**
 * dungeon-grid — rasterize Dungeon Forge layouts into editable floor/wall/door features.
 * Location: src/domains/world/atlas/dungeon-grid.ts
 *
 * Pure domain (no React / Host / Three). Corridor carve adapted from Dungeon Forge MIT.
 * Canonical cartography after commit; theme liquid pits are tagged floor cells.
 */

import type {
  UnifiedCanvasDoor,
  UnifiedCanvasRoom,
  UnifiedCanvasWall,
} from './unified-canvas-doc';
import type {
  DungeonGenerateResult,
  DungeonGeneratedEdge,
  DungeonGeneratedRoom,
  DungeonThemeKey,
} from './dungeon-generator';

export const DUNGEON_GRID_VERSION = 'sagatree-dungeon-grid-v1' as const;

export const DUNGEON_CELL_VOID = 0 as const;
export const DUNGEON_CELL_FLOOR = 1 as const;
export const DUNGEON_CELL_WALL = 2 as const;
export const DUNGEON_CELL_LIQUID = 3 as const;

export type DungeonCellKind =
  | typeof DUNGEON_CELL_VOID
  | typeof DUNGEON_CELL_FLOOR
  | typeof DUNGEON_CELL_WALL
  | typeof DUNGEON_CELL_LIQUID;

export type DungeonGridCell = {
  readonly x: number;
  readonly y: number;
  readonly kind: DungeonCellKind;
  /** Owning room id, or -1 for corridor / wall / void. */
  readonly roomId: number;
  readonly isCorridor: boolean;
  readonly isDoorway: boolean;
};

export type DungeonRasterizeParams = {
  readonly seed: number;
  readonly themeKey: DungeonThemeKey;
  readonly originX?: number;
  readonly originY?: number;
  readonly unitScale?: number;
  /** When true, molten/frost themes may stamp liquid pits off the critical path. */
  readonly enableLiquidPits?: boolean;
};

export type DungeonRasterizeResult = {
  readonly valid: boolean;
  readonly passable: boolean;
  readonly gridVersion: typeof DUNGEON_GRID_VERSION;
  readonly width: number;
  readonly height: number;
  readonly originGX: number;
  readonly originGY: number;
  readonly cells: readonly DungeonGridCell[];
  readonly floorCount: number;
  readonly wallCount: number;
  readonly doorwayCount: number;
  readonly liquidCount: number;
  readonly reachableFloorCount: number;
  readonly canvasRooms: readonly UnifiedCanvasRoom[];
  readonly canvasWalls: readonly UnifiedCanvasWall[];
  readonly canvasDoors: readonly UnifiedCanvasDoor[];
  readonly error?: string;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roomMaterial(role: DungeonGeneratedRoom['type']): UnifiedCanvasRoom['material'] {
  switch (role) {
    case 'entrance':
      return 'pflaster';
    case 'boss':
    case 'elite':
    case 'treasure':
    case 'shrine':
      return 'stein';
    default:
      return 'holz';
  }
}

/** BFS over walkable cells (floor, not liquid). */
export function bfsDungeonPassability(
  width: number,
  height: number,
  kinds: Uint8Array,
  startX: number,
  startY: number,
): { readonly reachable: number; readonly visited: Uint8Array } {
  const visited = new Uint8Array(width * height);
  const idx = (x: number, y: number) => y * width + x;
  if (
    startX < 0 ||
    startY < 0 ||
    startX >= width ||
    startY >= height ||
    kinds[idx(startX, startY)] !== DUNGEON_CELL_FLOOR
  ) {
    return { reachable: 0, visited };
  }
  const q = [idx(startX, startY)];
  visited[q[0]] = 1;
  let reachable = 0;
  const dirs = [1, -1, width, -width];
  for (let h = 0; h < q.length; h += 1) {
    const i = q[h];
    reachable += 1;
    const x = i % width;
    const y = (i / width) | 0;
    for (const d of dirs) {
      const ni = i + d;
      if (ni < 0 || ni >= kinds.length || visited[ni]) continue;
      if (d === 1 && x === width - 1) continue;
      if (d === -1 && x === 0) continue;
      if (d === width && y === height - 1) continue;
      if (d === -width && y === 0) continue;
      if (kinds[ni] !== DUNGEON_CELL_FLOOR) continue;
      visited[ni] = 1;
      q.push(ni);
    }
  }
  return { reachable, visited };
}

/**
 * Rasterize rooms+edges into a walkable grid and editable canvas features.
 * Corridor orientation is deterministic from seed+edge endpoints (no silent RNG drift).
 */
export function rasterizeDungeonLayout(
  rooms: readonly DungeonGeneratedRoom[],
  edges: readonly DungeonGeneratedEdge[],
  params: DungeonRasterizeParams,
): DungeonRasterizeResult {
  const seed = params.seed >>> 0;
  const ox = Number.isFinite(params.originX) ? Number(params.originX) : 0;
  const oy = Number.isFinite(params.originY) ? Number(params.originY) : 0;
  const scale =
    typeof params.unitScale === 'number' && Number.isFinite(params.unitScale) && params.unitScale > 0
      ? params.unitScale
      : 1;
  const empty = (error: string): DungeonRasterizeResult => ({
    valid: false,
    passable: false,
    gridVersion: DUNGEON_GRID_VERSION,
    width: 0,
    height: 0,
    originGX: 0,
    originGY: 0,
    cells: [],
    floorCount: 0,
    wallCount: 0,
    doorwayCount: 0,
    liquidCount: 0,
    reachableFloorCount: 0,
    canvasRooms: [],
    canvasWalls: [],
    canvasDoors: [],
    error,
  });

  if (rooms.length < 2) return empty('need at least two rooms');

  let minX = 1e9;
  let minY = 1e9;
  let maxX = -1e9;
  let maxY = -1e9;
  for (const r of rooms) {
    minX = Math.min(minX, r.cx - Math.ceil(r.w / 2));
    maxX = Math.max(maxX, r.cx + Math.ceil(r.w / 2));
    minY = Math.min(minY, r.cy - Math.ceil(r.h / 2));
    maxY = Math.max(maxY, r.cy + Math.ceil(r.h / 2));
  }
  const PADG = 5;
  const originGX = PADG - minX;
  const originGY = PADG - minY;
  const width = maxX - minX + PADG * 2 + 1;
  const height = maxY - minY + PADG * 2 + 1;
  if (width < 3 || height < 3 || width * height > 250_000) {
    return empty('grid bounds invalid');
  }

  const shifted = rooms.map((r) => ({
    ...r,
    cx: r.cx + originGX,
    cy: r.cy + originGY,
  }));

  const kinds = new Uint8Array(width * height);
  const roomAt = new Int16Array(width * height).fill(-1);
  const corridor = new Uint8Array(width * height);
  const idx = (x: number, y: number) => y * width + x;
  const inB = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;

  for (const r of shifted) {
    const rx = r.w / 2;
    const ry = r.h / 2;
    const y0 = Math.max(0, Math.floor(r.cy - ry));
    const y1 = Math.min(height - 1, Math.ceil(r.cy + ry));
    const x0 = Math.max(0, Math.floor(r.cx - rx));
    const x1 = Math.min(width - 1, Math.ceil(r.cx + rx));
    for (let y = y0; y <= y1; y += 1) {
      const dy = Math.abs(y - r.cy);
      if (dy > ry) continue;
      for (let x = x0; x <= x1; x += 1) {
        const dx = Math.abs(x - r.cx);
        if (dx > rx) continue;
        const i = idx(x, y);
        kinds[i] = DUNGEON_CELL_FLOOR;
        roomAt[i] = r.id;
      }
    }
  }

  const stamp = (x: number, y: number) => {
    if (!inB(x, y)) return;
    const i = idx(x, y);
    if (kinds[i] !== DUNGEON_CELL_FLOOR) {
      kinds[i] = DUNGEON_CELL_FLOOR;
      corridor[i] = 1;
      roomAt[i] = -1;
    }
  };
  const offs = (w: number) => (w === 1 ? [0] : w === 2 ? [0, 1] : [-1, 0, 1]);
  const hLine = (x0: number, x1: number, y: number, w: number) => {
    const o = offs(w);
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x += 1) {
      for (const k of o) stamp(x, y + k);
    }
  };
  const vLine = (y0: number, y1: number, x: number, w: number) => {
    const o = offs(w);
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y += 1) {
      for (const k of o) stamp(x + k, y);
    }
  };

  const rng = mulberry32((seed ^ 0x61c88647) >>> 0);
  for (const e of edges) {
    const A = shifted[e.a];
    const B = shifted[e.b];
    if (!A || !B) continue;
    let w = e.isCritical ? 3 : 2;
    if (
      !e.isCritical &&
      (A.type === 'treasure' || B.type === 'treasure') &&
      rng() < 0.4
    ) {
      w = 1;
    }
    const dx = Math.abs(A.cx - B.cx);
    const dy = Math.abs(A.cy - B.cy);
    const ovX =
      Math.min(A.cx + A.w / 2, B.cx + B.w / 2) - Math.max(A.cx - A.w / 2, B.cx - B.w / 2);
    const ovY =
      Math.min(A.cy + A.h / 2, B.cy + B.h / 2) - Math.max(A.cy - A.h / 2, B.cy - B.h / 2);
    if (ovX >= w + 2 && dy > 0) {
      const x = Math.round(
        (Math.max(A.cx - A.w / 2, B.cx - B.w / 2) + Math.min(A.cx + A.w / 2, B.cx + B.w / 2)) /
          2,
      );
      vLine(A.cy, B.cy, x, w);
    } else if (ovY >= w + 2 && dx > 0) {
      const y = Math.round(
        (Math.max(A.cy - A.h / 2, B.cy - B.h / 2) + Math.min(A.cy + A.h / 2, B.cy + B.h / 2)) /
          2,
      );
      hLine(A.cx, B.cx, y, w);
    } else if (((e.a + e.b + seed) & 1) === 0) {
      hLine(A.cx, B.cx, A.cy, w);
      vLine(A.cy, B.cy, B.cx, w);
    } else {
      vLine(A.cy, B.cy, A.cx, w);
      hLine(A.cx, B.cx, B.cy, w);
    }
  }

  // Grow walls around floor.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (kinds[idx(x, y)] !== DUNGEON_CELL_FLOOR) continue;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny += 1) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx += 1) {
          const ni = idx(nx, ny);
          if (kinds[ni] === DUNGEON_CELL_VOID) kinds[ni] = DUNGEON_CELL_WALL;
        }
      }
    }
  }

  const doorway = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y);
      if (!corridor[i]) continue;
      if (
        (x < width - 1 && roomAt[i + 1] >= 0) ||
        (x > 0 && roomAt[i - 1] >= 0) ||
        (y < height - 1 && roomAt[i + width] >= 0) ||
        (y > 0 && roomAt[i - width] >= 0)
      ) {
        doorway[i] = 1;
      }
    }
  }

  // Optional liquid pits off critical path (theme-aware).
  let liquidCount = 0;
  if (params.enableLiquidPits !== false && (params.themeKey === 'molten' || params.themeKey === 'frost')) {
    const critRooms = new Set<number>();
    for (const e of edges) {
      if (e.isCritical) {
        critRooms.add(e.a);
        critRooms.add(e.b);
      }
    }
    const candidates = shifted.filter(
      (r) => r.type === 'combat' && !critRooms.has(r.id) && Math.min(r.w, r.h) >= 8,
    );
    const pitRng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
    for (let k = 0; k < 2 && candidates.length > 0; k += 1) {
      const j = Math.floor(pitRng() * candidates.length);
      const r = candidates.splice(j, 1)[0];
      const px = Math.round(r.cx);
      const py = Math.round(r.cy);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const x = px + dx;
          const y = py + dy;
          if (!inB(x, y)) continue;
          const i = idx(x, y);
          if (kinds[i] === DUNGEON_CELL_FLOOR && roomAt[i] === r.id && !corridor[i]) {
            kinds[i] = DUNGEON_CELL_LIQUID;
            liquidCount += 1;
          }
        }
      }
    }
  }

  const entrance = shifted.find((r) => r.type === 'entrance') ?? shifted[0];
  const startX = Math.round(entrance.cx);
  const startY = Math.round(entrance.cy);
  // Ensure entrance cell is floor.
  if (inB(startX, startY) && kinds[idx(startX, startY)] !== DUNGEON_CELL_FLOOR) {
    kinds[idx(startX, startY)] = DUNGEON_CELL_FLOOR;
  }
  const { reachable } = bfsDungeonPassability(width, height, kinds, startX, startY);

  let floorCount = 0;
  let wallCount = 0;
  let doorwayCount = 0;
  const cells: DungeonGridCell[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y);
      const kind = kinds[i] as DungeonCellKind;
      if (kind === DUNGEON_CELL_VOID) continue;
      if (kind === DUNGEON_CELL_FLOOR) floorCount += 1;
      if (kind === DUNGEON_CELL_WALL) wallCount += 1;
      if (doorway[i]) doorwayCount += 1;
      cells.push({
        x,
        y,
        kind,
        roomId: roomAt[i],
        isCorridor: corridor[i] === 1,
        isDoorway: doorway[i] === 1,
      });
    }
  }

  const canvasRooms: UnifiedCanvasRoom[] = rooms.map((r) => ({
    id: `droom-${seed}-${r.id}`,
    x: ox + (r.cx - r.w / 2) * scale,
    y: oy + (r.cy - r.h / 2) * scale,
    w: r.w * scale,
    h: r.h * scale,
    material: roomMaterial(r.type),
  }));

  // Wall segments: every floor/liquid edge against wall/void → unit wall feature.
  const canvasWalls: UnifiedCanvasWall[] = [];
  const canvasDoors: UnifiedCanvasDoor[] = [];
  let wallSeq = 0;
  let doorSeq = 0;
  const tryEdge = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    fromFloor: boolean,
    doorwayHere: boolean,
  ) => {
    if (!fromFloor) return;
    const id = `dgrid-wall-${seed}-${wallSeq}`;
    wallSeq += 1;
    canvasWalls.push({
      id,
      x1: ox + x0 * scale,
      y1: oy + y0 * scale,
      x2: ox + x1 * scale,
      y2: oy + y1 * scale,
      width: Math.max(0.35, 0.45 * scale),
    });
    if (doorwayHere) {
      canvasDoors.push({
        id: `dgrid-door-${seed}-${doorSeq}`,
        wallId: id,
        t: 0.5,
        width: Math.max(0.8, 1.1 * scale),
      });
      doorSeq += 1;
    }
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = idx(x, y);
      const walk =
        kinds[i] === DUNGEON_CELL_FLOOR || kinds[i] === DUNGEON_CELL_LIQUID;
      if (!walk) continue;
      const doorHere = doorway[i] === 1;
      // North
      if (y === 0 || kinds[idx(x, y - 1)] === DUNGEON_CELL_WALL || kinds[idx(x, y - 1)] === DUNGEON_CELL_VOID) {
        tryEdge(x, y, x + 1, y, true, doorHere && (y === 0 || roomAt[idx(x, Math.max(0, y - 1))] >= 0 || corridor[i] === 1));
      }
      // West
      if (x === 0 || kinds[idx(x - 1, y)] === DUNGEON_CELL_WALL || kinds[idx(x - 1, y)] === DUNGEON_CELL_VOID) {
        tryEdge(x, y, x, y + 1, true, doorHere && (x === 0 || roomAt[idx(Math.max(0, x - 1), y)] >= 0 || corridor[i] === 1));
      }
    }
  }

  // Corridor centerline features (edit hooks) — one wall stub per edge.
  for (const e of edges) {
    const A = rooms[e.a];
    const B = rooms[e.b];
    canvasWalls.push({
      id: `dcorr-${seed}-${e.a}-${e.b}`,
      x1: ox + A.cx * scale,
      y1: oy + A.cy * scale,
      x2: ox + B.cx * scale,
      y2: oy + B.cy * scale,
      width: e.isCritical ? 1.2 * scale : 0.8 * scale,
    });
  }

  const floorTotal = floorCount;
  const passable = reachable > 0 && reachable === floorTotal;

  return {
    valid: true,
    passable,
    gridVersion: DUNGEON_GRID_VERSION,
    width,
    height,
    originGX,
    originGY,
    cells,
    floorCount,
    wallCount,
    doorwayCount,
    liquidCount,
    reachableFloorCount: reachable,
    canvasRooms,
    canvasWalls,
    canvasDoors,
    error: passable ? undefined : 'floor graph not fully reachable from entrance',
  };
}

/** Convenience: generateDungeon result → rasterized editable features. */
export function rasterizeDungeonGenerateResult(
  result: DungeonGenerateResult,
  options?: { readonly enableLiquidPits?: boolean },
): DungeonRasterizeResult {
  if (!result.valid) {
    return {
      valid: false,
      passable: false,
      gridVersion: DUNGEON_GRID_VERSION,
      width: 0,
      height: 0,
      originGX: 0,
      originGY: 0,
      cells: [],
      floorCount: 0,
      wallCount: 0,
      doorwayCount: 0,
      liquidCount: 0,
      reachableFloorCount: 0,
      canvasRooms: [],
      canvasWalls: [],
      canvasDoors: [],
      error: result.error ?? 'generation invalid',
    };
  }
  return rasterizeDungeonLayout(result.rooms, result.edges, {
    seed: result.seed,
    themeKey: result.params.themeKey,
    originX: result.params.originX,
    originY: result.params.originY,
    unitScale: result.params.unitScale,
    enableLiquidPits: options?.enableLiquidPits,
  });
}
