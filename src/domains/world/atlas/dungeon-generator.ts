/**
 * dungeon-generator — deterministic procedural dungeon → UnifiedCanvasDoc entities.
 * Location: src/domains/world/atlas/dungeon-generator.ts
 *
 * Algorithm adapted from Dungeon Forge (MIT © 2026 Majid Manzarpour):
 * https://github.com/majidmanzarpour/threejs-procedural-dungeon
 * Scatter → separate → Delaunay → MST+loops → rooms/walls export.
 * Pure domain — no Three.js / React / Supabase.
 */

import type { UnifiedCanvasObject, UnifiedCanvasRoom, UnifiedCanvasWall } from './unified-canvas-doc';

export const DUNGEON_GENERATOR_VERSION = 'sagatree-dungeon-forge-v1' as const;

export type DungeonThemeKey = 'ancient' | 'molten' | 'frost' | 'grim' | 'verdant';

export type DungeonGenerateParams = {
  readonly seed: number;
  readonly roomCount: number;
  readonly loopChance: number;
  readonly themeKey: DungeonThemeKey;
  /** World-space origin for the generated layout. */
  readonly originX?: number;
  readonly originY?: number;
  readonly unitScale?: number;
};

/** Inclusive clamp used by generateDungeon (Dungeon Forge parity). */
export const DUNGEON_ROOM_COUNT_MIN = 4 as const;
export const DUNGEON_ROOM_COUNT_MAX = 80 as const;

const THEME_KEYS: readonly DungeonThemeKey[] = [
  'ancient',
  'molten',
  'frost',
  'grim',
  'verdant',
];

/**
 * Normalize untrusted / UI params before generation.
 * Negative / NaN roomCount → min; oversize → max; loopChance → [0,1]; seed → u32.
 */
export function normalizeDungeonGenerateParams(
  params: DungeonGenerateParams,
): DungeonGenerateParams {
  const seedRaw = Number(params.seed);
  const seed = Number.isFinite(seedRaw) ? seedRaw >>> 0 : 0;
  const roomsRaw = Number(params.roomCount);
  const roomCount = Number.isFinite(roomsRaw)
    ? Math.max(DUNGEON_ROOM_COUNT_MIN, Math.min(DUNGEON_ROOM_COUNT_MAX, Math.floor(roomsRaw)))
    : DUNGEON_ROOM_COUNT_MIN;
  const loopRaw = Number(params.loopChance);
  const loopChance = Number.isFinite(loopRaw) ? Math.max(0, Math.min(1, loopRaw)) : 0;
  const themeKey = THEME_KEYS.includes(params.themeKey) ? params.themeKey : 'ancient';
  const originX =
    typeof params.originX === 'number' && Number.isFinite(params.originX) ? params.originX : 0;
  const originY =
    typeof params.originY === 'number' && Number.isFinite(params.originY) ? params.originY : 0;
  const unitScale =
    typeof params.unitScale === 'number' && Number.isFinite(params.unitScale) && params.unitScale > 0
      ? params.unitScale
      : 1;
  return {
    seed,
    roomCount,
    loopChance,
    themeKey,
    originX,
    originY,
    unitScale,
  };
}

type MutableEdge = {
  a: number;
  b: number;
  isLoop: boolean;
  isCritical: boolean;
};

export type DungeonRoomRole =
  | 'entrance'
  | 'combat'
  | 'elite'
  | 'treasure'
  | 'shrine'
  | 'boss';

export type DungeonGeneratedRoom = {
  readonly id: number;
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
  readonly h: number;
  readonly type: DungeonRoomRole;
  readonly depth: number;
};

export type DungeonGeneratedEdge = {
  readonly a: number;
  readonly b: number;
  readonly isLoop: boolean;
  readonly isCritical: boolean;
};

export type DungeonGenerateResult = {
  readonly valid: boolean;
  readonly seed: number;
  readonly generatorVersion: typeof DUNGEON_GENERATOR_VERSION;
  readonly params: DungeonGenerateParams;
  readonly rooms: readonly DungeonGeneratedRoom[];
  readonly edges: readonly DungeonGeneratedEdge[];
  readonly canvasRooms: readonly UnifiedCanvasRoom[];
  readonly canvasWalls: readonly UnifiedCanvasWall[];
  readonly canvasObjects: readonly UnifiedCanvasObject[];
  readonly stats: {
    readonly attempts: number;
    readonly genMs: number;
    readonly roomCount: number;
    readonly edgeCount: number;
  };
  readonly error?: string;
};

type Rng = {
  raw: () => number;
  f: (a: number, b: number) => number;
  i: (a: number, b: number) => number;
  chance: (p: number) => boolean;
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

function makeRng(seed: number): Rng {
  const r = mulberry32(seed);
  return {
    raw: r,
    f: (a, b) => a + r() * (b - a),
    i: (a, b) => a + Math.floor(r() * (b - a + 1)),
    chance: (p) => r() < p,
  };
}

type DelaunayPt = { x: number; y: number; i: number };
type DelaunayTri = {
  a: DelaunayPt;
  b: DelaunayPt;
  c: DelaunayPt;
  ccx: number;
  ccy: number;
  r2: number;
};

/** Bowyer–Watson Delaunay edges (Dungeon Forge). */
function delaunay(pts: readonly { x: number; y: number }[]): Array<[number, number]> {
  const n = pts.length;
  if (n < 2) return [];
  if (n === 2) return [[0, 1]];
  const P: DelaunayPt[] = pts.map((p, i) => ({
    x: p.x + ((i * 0.618033) % 1) * 1e-3,
    y: p.y + ((i * 0.414213) % 1) * 1e-3,
    i,
  }));
  let minX = 1e18;
  let minY = 1e18;
  let maxX = -1e18;
  let maxY = -1e18;
  for (const p of P) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const dm = Math.max(maxX - minX, maxY - minY, 1);
  const mx = (minX + maxX) / 2;
  const my = (minY + maxY) / 2;
  const s1: DelaunayPt = { x: mx - 30 * dm, y: my - dm, i: -1 };
  const s2: DelaunayPt = { x: mx, y: my + 30 * dm, i: -2 };
  const s3: DelaunayPt = { x: mx + 30 * dm, y: my - dm, i: -3 };
  const mkTri = (a: DelaunayPt, b: DelaunayPt, c: DelaunayPt): DelaunayTri => {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if (Math.abs(d) < 1e-12) return { a, b, c, ccx: 0, ccy: 0, r2: Infinity };
    const a2 = a.x * a.x + a.y * a.y;
    const b2 = b.x * b.x + b.y * b.y;
    const c2 = c.x * c.x + c.y * c.y;
    const ccx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
    const ccy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
    return { a, b, c, ccx, ccy, r2: (a.x - ccx) * (a.x - ccx) + (a.y - ccy) * (a.y - ccy) };
  };
  let tris: DelaunayTri[] = [mkTri(s1, s2, s3)];
  for (const p of P) {
    const bad: DelaunayTri[] = [];
    const edges: Array<[DelaunayPt, DelaunayPt]> = [];
    for (const t of tris) {
      if ((p.x - t.ccx) * (p.x - t.ccx) + (p.y - t.ccy) * (p.y - t.ccy) < t.r2) bad.push(t);
    }
    for (const t of bad) {
      edges.push([t.a, t.b], [t.b, t.c], [t.c, t.a]);
    }
    const poly: Array<[DelaunayPt, DelaunayPt]> = [];
    for (let i = 0; i < edges.length; i += 1) {
      let shared = false;
      for (let j = 0; j < edges.length; j += 1) {
        if (i === j) continue;
        const ea = edges[i];
        const eb = edges[j];
        if ((ea[0] === eb[0] && ea[1] === eb[1]) || (ea[0] === eb[1] && ea[1] === eb[0])) {
          shared = true;
          break;
        }
      }
      if (!shared) poly.push(edges[i]);
    }
    tris = tris.filter((t) => !bad.includes(t));
    for (const e of poly) tris.push(mkTri(e[0], e[1], p));
  }
  tris = tris.filter((t) => t.a.i >= 0 && t.b.i >= 0 && t.c.i >= 0);
  const seen = new Set<number>();
  const out: Array<[number, number]> = [];
  const pushEdge = (ai: number, bi: number) => {
    const lo = Math.min(ai, bi);
    const hi = Math.max(ai, bi);
    const k = lo * 4096 + hi;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([lo, hi]);
    }
  };
  for (const t of tris) {
    pushEdge(t.a.i, t.b.i);
    pushEdge(t.b.i, t.c.i);
    pushEdge(t.c.i, t.a.i);
  }
  return out;
}

type MutableRoom = {
  id: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  type: DungeonRoomRole;
  depth: number;
  degree: number;
};

function roomMaterialForRole(role: DungeonRoomRole): UnifiedCanvasRoom['material'] {
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

function tryGenerate(
  seed: number,
  params: DungeonGenerateParams,
): Omit<DungeonGenerateResult, 'stats' | 'params' | 'generatorVersion'> & {
  stats: { roomCount: number; edgeCount: number };
} {
  const rng = makeRng(seed);
  const N = Math.max(
    DUNGEON_ROOM_COUNT_MIN,
    Math.min(DUNGEON_ROOM_COUNT_MAX, Math.floor(params.roomCount)),
  );
  const R = Math.sqrt(N) * 4.6;
  const rooms: MutableRoom[] = [];
  for (let i = 0; i < N; i += 1) {
    const t = rng.raw();
    let w: number;
    let h: number;
    if (t < 0.45) {
      w = rng.i(5, 7);
      h = rng.i(5, 7);
    } else if (t < 0.85) {
      w = rng.i(8, 12);
      h = rng.i(8, 12);
    } else {
      w = rng.i(13, 18);
      h = rng.i(13, 18);
    }
    const ang = rng.f(0, Math.PI * 2);
    const rad = R * Math.sqrt(rng.raw());
    rooms.push({
      id: i,
      cx: Math.cos(ang) * rad,
      cy: Math.sin(ang) * rad,
      w,
      h,
      type: 'combat',
      depth: 0,
      degree: 0,
    });
  }

  const PAD = 2;
  {
    const CX = new Float64Array(N);
    const CY = new Float64Array(N);
    const HW = new Float64Array(N);
    const HH = new Float64Array(N);
    for (let i = 0; i < N; i += 1) {
      CX[i] = rooms[i].cx;
      CY[i] = rooms[i].cy;
      HW[i] = rooms[i].w / 2 + PAD / 2;
      HH[i] = rooms[i].h / 2 + PAD / 2;
    }
    for (let iter = 0; iter < 300; iter += 1) {
      let moved = false;
      for (let i = 0; i < N; i += 1) {
        for (let j = i + 1; j < N; j += 1) {
          const ox = HW[i] + HW[j] - Math.abs(CX[i] - CX[j]);
          if (ox <= 0) continue;
          const oy = HH[i] + HH[j] - Math.abs(CY[i] - CY[j]);
          if (oy <= 0) continue;
          moved = true;
          if (ox < oy) {
            const s = CX[i] <= CX[j] ? -1 : 1;
            CX[i] += (s * ox) / 2;
            CX[j] -= (s * ox) / 2;
          } else {
            const s = CY[i] <= CY[j] ? -1 : 1;
            CY[i] += (s * oy) / 2;
            CY[j] -= (s * oy) / 2;
          }
        }
      }
      if (!moved) break;
    }
    for (let i = 0; i < N; i += 1) {
      rooms[i].cx = Math.round(CX[i]);
      rooms[i].cy = Math.round(CY[i]);
    }
  }

  const centers = rooms.map((r) => ({ x: r.cx, y: r.cy }));
  let delEdges = delaunay(centers);
  if (delEdges.length === 0) {
    delEdges = [];
    for (let i = 0; i < N - 1; i += 1) delEdges.push([i, i + 1]);
  }
  const elen = (e: [number, number]) =>
    Math.hypot(centers[e[0]].x - centers[e[1]].x, centers[e[0]].y - centers[e[1]].y);

  const adj: Array<Array<{ b: number; w: number; idx: number }>> = Array.from({ length: N }, () => []);
  delEdges.forEach((e, idx) => {
    const w = elen(e);
    adj[e[0]].push({ b: e[1], w, idx });
    adj[e[1]].push({ b: e[0], w, idx });
  });
  const inT = new Uint8Array(N);
  inT[0] = 1;
  let inCount = 1;
  const mstIdx = new Set<number>();
  while (inCount < N) {
    let best: { b: number; w: number; idx: number } | null = null;
    for (let a = 0; a < N; a += 1) {
      if (!inT[a]) continue;
      for (const e of adj[a]) {
        if (!inT[e.b] && (!best || e.w < best.w)) best = e;
      }
    }
    if (!best) break;
    inT[best.b] = 1;
    inCount += 1;
    mstIdx.add(best.idx);
  }
  if (inCount < N) {
    return {
      valid: false,
      seed,
      rooms: [],
      edges: [],
      canvasRooms: [],
      canvasWalls: [],
      canvasObjects: [],
      stats: { roomCount: 0, edgeCount: 0 },
      error: 'MST disconnected',
    };
  }

  let mstLenSum = 0;
  for (const i of mstIdx) mstLenSum += elen(delEdges[i]);
  const mstMean = mstLenSum / Math.max(1, mstIdx.size);
  const edges: MutableEdge[] = [];
  delEdges.forEach((e, idx) => {
    if (mstIdx.has(idx)) {
      edges.push({ a: e[0], b: e[1], isLoop: false, isCritical: false });
    } else if (elen(e) < mstMean * 2.2 && rng.chance(params.loopChance)) {
      edges.push({ a: e[0], b: e[1], isLoop: true, isCritical: false });
    }
  });
  for (const e of edges) {
    rooms[e.a].degree += 1;
    rooms[e.b].degree += 1;
  }

  /* Leaf guard (Dungeon Forge): large dungeons need dead ends — prune loops until ≥3 leaves. */
  if (N >= 20) {
    let leafCount = 0;
    for (let i = 0; i < N; i += 1) if (rooms[i].degree === 1) leafCount += 1;
    while (leafCount < 3) {
      let bi = -1;
      let bs = -1;
      for (let i = 0; i < edges.length; i += 1) {
        const e = edges[i];
        if (!e.isLoop) continue;
        const s = (rooms[e.a].degree === 2 ? 1 : 0) + (rooms[e.b].degree === 2 ? 1 : 0);
        const L = Math.hypot(
          centers[e.a].x - centers[e.b].x,
          centers[e.a].y - centers[e.b].y,
        );
        const score = s * 10000 + L;
        if (score > bs) {
          bs = score;
          bi = i;
        }
      }
      if (bi < 0) break;
      const e = edges[bi];
      if (--rooms[e.a].degree === 1) leafCount += 1;
      if (--rooms[e.b].degree === 1) leafCount += 1;
      edges.splice(bi, 1);
    }
  }

  const gAdj: Array<Array<{ b: number; i: number }>> = Array.from({ length: N }, () => []);
  edges.forEach((e, i) => {
    gAdj[e.a].push({ b: e.b, i });
    gAdj[e.b].push({ b: e.a, i });
  });

  let boss = 0;
  for (let i = 1; i < N; i += 1) {
    if (rooms[i].w * rooms[i].h > rooms[boss].w * rooms[boss].h) boss = i;
  }
  const distFrom = (src: number) => {
    const D = new Int32Array(N).fill(-1);
    D[src] = 0;
    const q = [src];
    for (let h = 0; h < q.length; h += 1) {
      const a = q[h];
      for (const e of gAdj[a]) {
        if (D[e.b] < 0) {
          D[e.b] = D[a] + 1;
          q.push(e.b);
        }
      }
    }
    return D;
  };
  const dB = distFrom(boss);
  let entrance = -1;
  let bestD = -1;
  for (let i = 0; i < N; i += 1) {
    if (i !== boss && rooms[i].degree === 1 && dB[i] > bestD) {
      bestD = dB[i];
      entrance = i;
    }
  }
  if (entrance < 0) {
    for (let i = 0; i < N; i += 1) {
      if (i !== boss && dB[i] > bestD) {
        bestD = dB[i];
        entrance = i;
      }
    }
  }
  if (entrance < 0) {
    return {
      valid: false,
      seed,
      rooms: [],
      edges: [],
      canvasRooms: [],
      canvasWalls: [],
      canvasObjects: [],
      stats: { roomCount: 0, edgeCount: 0 },
      error: 'entrance unresolved',
    };
  }
  const dE = distFrom(entrance);
  let maxDepth = 1;
  for (let i = 0; i < N; i += 1) if (dE[i] > maxDepth) maxDepth = dE[i];
  rooms.forEach((r, i) => {
    r.depth = Math.max(0, dE[i]);
  });
  rooms[entrance].type = 'entrance';
  rooms[boss].type = 'boss';

  /* Critical path entrance → boss (Dungeon Forge). */
  const par = new Int32Array(N).fill(-1);
  const pe = new Int32Array(N).fill(-1);
  {
    const q = [entrance];
    const vis = new Uint8Array(N);
    vis[entrance] = 1;
    for (let h = 0; h < q.length; h += 1) {
      const a = q[h];
      for (const e of gAdj[a]) {
        if (!vis[e.b]) {
          vis[e.b] = 1;
          par[e.b] = a;
          pe[e.b] = e.i;
          q.push(e.b);
        }
      }
    }
  }
  const critRooms = new Set<number>();
  for (let c = boss; c !== -1; c = par[c]) {
    critRooms.add(c);
    if (pe[c] >= 0) edges[pe[c]].isCritical = true;
    if (c === entrance) break;
  }

  const leaves: number[] = [];
  for (let i = 0; i < N; i += 1) {
    if (i !== entrance && i !== boss && rooms[i].degree === 1) leaves.push(i);
  }
  leaves.sort((a, b) => rooms[b].depth - rooms[a].depth);
  leaves.slice(0, 4).forEach((i) => {
    rooms[i].type = 'treasure';
  });

  const shrineC: number[] = [];
  for (let i = 0; i < N; i += 1) {
    const r = rooms[i];
    if (
      r.type === 'combat' &&
      !critRooms.has(i) &&
      r.depth > maxDepth * 0.3 &&
      r.depth < maxDepth * 0.85
    ) {
      shrineC.push(i);
    }
  }
  for (let k = 0; k < 2 && shrineC.length > 0; k += 1) {
    const j = shrineC.splice(rng.i(0, shrineC.length - 1), 1)[0];
    rooms[j].type = 'shrine';
  }

  const eliteC: number[] = [];
  for (const i of critRooms) {
    const r = rooms[i];
    if (r.type === 'combat' && r.depth >= maxDepth * 0.55 && r.depth <= maxDepth * 0.85) {
      eliteC.push(i);
    }
  }
  eliteC.sort((a, b) => rooms[a].depth - rooms[b].depth);
  for (let k = 0; k < Math.min(2, eliteC.length); k += 1) {
    rooms[eliteC[eliteC.length - 1 - k]].type = 'elite';
  }

  const ox = params.originX ?? 0;
  const oy = params.originY ?? 0;
  const scale = params.unitScale ?? 1;

  const canvasRooms: UnifiedCanvasRoom[] = rooms.map((r) => ({
    id: `droom-${seed}-${r.id}`,
    x: ox + (r.cx - r.w / 2) * scale,
    y: oy + (r.cy - r.h / 2) * scale,
    w: r.w * scale,
    h: r.h * scale,
    material: roomMaterialForRole(r.type),
  }));

  const canvasWalls: UnifiedCanvasWall[] = [];
  for (const r of rooms) {
    const x0 = ox + (r.cx - r.w / 2) * scale;
    const y0 = oy + (r.cy - r.h / 2) * scale;
    const x1 = ox + (r.cx + r.w / 2) * scale;
    const y1 = oy + (r.cy + r.h / 2) * scale;
    const tw = Math.max(0.35, 0.45 * scale);
    const segs: Array<[number, number, number, number]> = [
      [x0, y0, x1, y0],
      [x1, y0, x1, y1],
      [x1, y1, x0, y1],
      [x0, y1, x0, y0],
    ];
    segs.forEach(([ax, ay, bx, by], si) => {
      canvasWalls.push({
        id: `dwall-${seed}-${r.id}-${si}`,
        x1: ax,
        y1: ay,
        x2: bx,
        y2: by,
        width: tw,
      });
    });
  }
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

  const canvasObjects: UnifiedCanvasObject[] = [
    {
      id: `dlamp-${seed}-entrance`,
      type: 'lampe',
      x: ox + rooms[entrance].cx * scale,
      y: oy + rooms[entrance].cy * scale,
      size: 1.2 * scale,
      height: 1.5 * scale,
      angle: 0,
    },
    {
      id: `dchest-${seed}-boss`,
      type: 'kiste',
      x: ox + rooms[boss].cx * scale,
      y: oy + rooms[boss].cy * scale,
      size: 1.4 * scale,
      height: 1 * scale,
      angle: 0,
    },
  ];

  const frozenEdges: DungeonGeneratedEdge[] = edges.map((e) => ({
    a: e.a,
    b: e.b,
    isLoop: e.isLoop,
    isCritical: e.isCritical,
  }));

  return {
    valid: true,
    seed,
    rooms: rooms.map((r) => ({
      id: r.id,
      cx: r.cx,
      cy: r.cy,
      w: r.w,
      h: r.h,
      type: r.type,
      depth: r.depth,
    })),
    edges: frozenEdges,
    canvasRooms,
    canvasWalls,
    canvasObjects,
    stats: { roomCount: N, edgeCount: frozenEdges.length },
  };
}

/** Validate graph connectivity (all rooms reachable from any start via edges). */
export function validateDungeonConnectivity(
  roomCount: number,
  edges: readonly DungeonGeneratedEdge[],
  startRoomId = 0,
): boolean {
  if (roomCount < 2) return false;
  if (startRoomId < 0 || startRoomId >= roomCount) return false;
  const adj: number[][] = Array.from({ length: roomCount }, () => []);
  for (const e of edges) {
    if (e.a < 0 || e.b < 0 || e.a >= roomCount || e.b >= roomCount) return false;
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
  }
  const seen = new Uint8Array(roomCount);
  const q = [startRoomId];
  seen[startRoomId] = 1;
  for (let h = 0; h < q.length; h += 1) {
    for (const b of adj[q[h]]) {
      if (!seen[b]) {
        seen[b] = 1;
        q.push(b);
      }
    }
  }
  for (let i = 0; i < roomCount; i += 1) if (!seen[i]) return false;
  return true;
}

export type DungeonSemanticsValidation = {
  readonly ok: boolean;
  readonly error?: string;
  readonly entranceId: number;
  readonly bossId: number;
  readonly criticalEdgeCount: number;
  readonly loopEdgeCount: number;
  readonly roleCounts: Readonly<Record<DungeonRoomRole, number>>;
};

/** Entrance/boss uniqueness, critical path, and role inventory (Dungeon Forge semantics). */
export function validateDungeonSemantics(
  rooms: readonly DungeonGeneratedRoom[],
  edges: readonly DungeonGeneratedEdge[],
): DungeonSemanticsValidation {
  const roleCounts: Record<DungeonRoomRole, number> = {
    entrance: 0,
    combat: 0,
    elite: 0,
    treasure: 0,
    shrine: 0,
    boss: 0,
  };
  let entranceId = -1;
  let bossId = -1;
  for (const r of rooms) {
    roleCounts[r.type] += 1;
    if (r.type === 'entrance') entranceId = r.id;
    if (r.type === 'boss') bossId = r.id;
  }
  if (roleCounts.entrance !== 1 || entranceId < 0) {
    return {
      ok: false,
      error: 'expected exactly one entrance',
      entranceId,
      bossId,
      criticalEdgeCount: 0,
      loopEdgeCount: 0,
      roleCounts,
    };
  }
  if (roleCounts.boss !== 1 || bossId < 0) {
    return {
      ok: false,
      error: 'expected exactly one boss',
      entranceId,
      bossId,
      criticalEdgeCount: 0,
      loopEdgeCount: 0,
      roleCounts,
    };
  }
  if (entranceId === bossId) {
    return {
      ok: false,
      error: 'entrance and boss must differ',
      entranceId,
      bossId,
      criticalEdgeCount: 0,
      loopEdgeCount: 0,
      roleCounts,
    };
  }
  if (!validateDungeonConnectivity(rooms.length, edges, entranceId)) {
    return {
      ok: false,
      error: 'graph not connected from entrance',
      entranceId,
      bossId,
      criticalEdgeCount: 0,
      loopEdgeCount: 0,
      roleCounts,
    };
  }
  let criticalEdgeCount = 0;
  let loopEdgeCount = 0;
  for (const e of edges) {
    if (e.isCritical) criticalEdgeCount += 1;
    if (e.isLoop) loopEdgeCount += 1;
  }
  if (criticalEdgeCount < 1) {
    return {
      ok: false,
      error: 'critical path empty',
      entranceId,
      bossId,
      criticalEdgeCount,
      loopEdgeCount,
      roleCounts,
    };
  }
  return {
    ok: true,
    entranceId,
    bossId,
    criticalEdgeCount,
    loopEdgeCount,
    roleCounts,
  };
}

/** Stable fingerprint for reference / determinism tests (rooms + edges + canvas IDs). */
export function fingerprintDungeonLayout(result: DungeonGenerateResult): string {
  const rooms = result.rooms.map((r) => `${r.id}:${r.cx},${r.cy},${r.w}x${r.h}:${r.type}:${r.depth}`);
  const edges = result.edges.map(
    (e) => `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}:${e.isLoop ? 'L' : 'T'}${e.isCritical ? 'C' : ''}`,
  );
  const ids = [
    ...result.canvasRooms.map((r) => r.id),
    ...result.canvasWalls.map((w) => w.id),
    ...result.canvasObjects.map((o) => o.id),
  ];
  return `v=${result.generatorVersion};seed=${result.seed};rooms=[${rooms.join('|')}];edges=[${edges.join('|')}];ids=[${ids.join('|')}]`;
}

export function generateDungeon(params: DungeonGenerateParams): DungeonGenerateResult {
  const normalized = normalizeDungeonGenerateParams(params);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let attempt = 0;
  let seed = normalized.seed;
  let last: ReturnType<typeof tryGenerate> | null = null;
  while (attempt < 5) {
    last = tryGenerate(seed, { ...normalized, seed });
    if (
      last.valid &&
      validateDungeonConnectivity(last.rooms.length, last.edges) &&
      validateDungeonSemantics(last.rooms, last.edges).ok
    ) {
      break;
    }
    seed = (Math.imul(seed, 9301) + 49297) >>> 0;
    attempt += 1;
  }
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!last || !last.valid || !validateDungeonSemantics(last.rooms, last.edges).ok) {
    return {
      valid: false,
      seed: normalized.seed,
      generatorVersion: DUNGEON_GENERATOR_VERSION,
      params: normalized,
      rooms: [],
      edges: [],
      canvasRooms: [],
      canvasWalls: [],
      canvasObjects: [],
      stats: { attempts: attempt + 1, genMs: t1 - t0, roomCount: 0, edgeCount: 0 },
      error: last?.error ?? 'generation failed',
    };
  }
  return {
    valid: true,
    seed: last.seed,
    generatorVersion: DUNGEON_GENERATOR_VERSION,
    params: { ...normalized, seed: last.seed },
    rooms: last.rooms,
    edges: last.edges,
    canvasRooms: last.canvasRooms,
    canvasWalls: last.canvasWalls,
    canvasObjects: last.canvasObjects,
    stats: {
      attempts: attempt + 1,
      genMs: t1 - t0,
      roomCount: last.stats.roomCount,
      edgeCount: last.stats.edgeCount,
    },
  };
}

export type DungeonGeneratorMeta = {
  readonly generatorVersion: typeof DUNGEON_GENERATOR_VERSION;
  readonly seed: number;
  readonly themeKey: DungeonThemeKey;
  readonly roomCount: number;
  readonly loopChance: number;
  readonly confirmed: boolean;
  readonly manualDirty?: boolean;
};

export function buildDungeonGeneratorMeta(
  result: DungeonGenerateResult,
  confirmed: boolean,
): DungeonGeneratorMeta {
  return {
    generatorVersion: DUNGEON_GENERATOR_VERSION,
    seed: result.seed,
    themeKey: result.params.themeKey,
    roomCount: result.params.roomCount,
    loopChance: result.params.loopChance,
    confirmed,
    manualDirty: false,
  };
}

export const DUNGEON_META_KEY = 'dungeon' as const;

export function extractDungeonMetaFromGeneratorMeta(
  meta: Readonly<Record<string, unknown>> | null | undefined,
): DungeonGeneratorMeta | null {
  if (!meta) return null;
  const raw = meta[DUNGEON_META_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const seed = typeof row.seed === 'number' && Number.isFinite(row.seed) ? row.seed : null;
  const roomCount =
    typeof row.roomCount === 'number' && Number.isFinite(row.roomCount) ? row.roomCount : null;
  const loopChance =
    typeof row.loopChance === 'number' && Number.isFinite(row.loopChance) ? row.loopChance : 0.18;
  const themeRaw = typeof row.themeKey === 'string' ? row.themeKey : 'ancient';
  const themeKey = THEME_KEYS.includes(themeRaw as DungeonThemeKey)
    ? (themeRaw as DungeonThemeKey)
    : 'ancient';
  if (seed == null || roomCount == null) return null;
  return {
    generatorVersion: DUNGEON_GENERATOR_VERSION,
    seed,
    themeKey,
    roomCount,
    loopChance,
    confirmed: row.confirmed === true,
    manualDirty: row.manualDirty === true,
  };
}

export function mergeDungeonMetaIntoGeneratorMeta(
  existing: Readonly<Record<string, unknown>>,
  dungeon: DungeonGeneratorMeta,
): Record<string, unknown> {
  return {
    ...existing,
    [DUNGEON_META_KEY]: {
      generatorVersion: dungeon.generatorVersion,
      seed: dungeon.seed,
      themeKey: dungeon.themeKey,
      roomCount: dungeon.roomCount,
      loopChance: dungeon.loopChance,
      confirmed: dungeon.confirmed,
      manualDirty: dungeon.manualDirty === true,
    },
  };
}

/** True when re-running the generator would wipe confirmed/manual work without a guard. */
export function dungeonNeedsReforgeConfirm(meta: DungeonGeneratorMeta | null | undefined): boolean {
  if (!meta) return false;
  return meta.confirmed === true || meta.manualDirty === true;
}
