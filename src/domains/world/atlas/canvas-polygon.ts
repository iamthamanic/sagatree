/**
 * canvas-polygon — closed coast / area polygon helpers for UnifiedCanvasRoom.
 * Location: src/domains/world/atlas/canvas-polygon.ts
 *
 * Pure domain — no React / Host. Used by parse, pick, 2D/3D render bridges.
 */

export type CanvasPoint = readonly [number, number];

export type CanvasBBox = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

const EPS = 1e-9;

export function isFinitePoint(p: unknown): p is CanvasPoint {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    typeof p[0] === 'number' &&
    typeof p[1] === 'number' &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1])
  );
}

/** Drop consecutive duplicates; keep ring open (first ≠ last required). */
export function sanitizePolygonPoints(
  raw: readonly CanvasPoint[],
): CanvasPoint[] | null {
  if (raw.length < 3) return null;
  const out: [number, number][] = [];
  for (const p of raw) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
    const last = out[out.length - 1];
    if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < EPS) continue;
    out.push([p[0], p[1]]);
  }
  if (out.length >= 2) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < EPS) out.pop();
  }
  return out.length >= 3 ? out : null;
}

export function bboxFromPoints(points: readonly CanvasPoint[]): CanvasBBox | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  if (!(w > 0) || !(h > 0)) return null;
  return { x: minX, y: minY, w, h };
}

/** Ray-cast point-in-polygon (boundary counts as inside). */
export function pointInPolygon(
  x: number,
  y: number,
  points: readonly CanvasPoint[],
): boolean {
  if (points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const onEdge =
      Math.abs((xj - xi) * (y - yi) - (yj - yi) * (x - xi)) < 1e-6 &&
      x >= Math.min(xi, xj) - EPS &&
      x <= Math.max(xi, xj) + EPS &&
      y >= Math.min(yi, yj) - EPS &&
      y <= Math.max(yi, yj) + EPS;
    if (onEdge) return true;
    if (yi === yj) continue;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function cross(o: CanvasPoint, a: CanvasPoint, b: CanvasPoint): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function pointInTriangle(
  p: CanvasPoint,
  a: CanvasPoint,
  b: CanvasPoint,
  c: CanvasPoint,
): boolean {
  const b1 = cross(p, a, b) < 0;
  const b2 = cross(p, b, c) < 0;
  const b3 = cross(p, c, a) < 0;
  return b1 === b2 && b2 === b3;
}

function polygonSignedArea(points: readonly CanvasPoint[]): number {
  let a = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/**
 * Ear-clip triangulation → triangle index triples into `points`.
 * Falls back to fan from vertex 0 when ear clipping stalls.
 */
export function triangulatePolygon(
  points: readonly CanvasPoint[],
): readonly (readonly [number, number, number])[] {
  const n = points.length;
  if (n < 3) return [];
  if (n === 3) return [[0, 1, 2]];

  const ccw = polygonSignedArea(points) >= 0;
  const idx: number[] = [];
  for (let i = 0; i < n; i += 1) idx.push(i);
  const tris: [number, number, number][] = [];
  let guard = 0;
  while (idx.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let i = 0; i < idx.length; i += 1) {
      const i0 = idx[(i + idx.length - 1) % idx.length];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % idx.length];
      const areaSign = cross(points[i0], points[i1], points[i2]);
      const earOk = ccw ? areaSign > EPS : areaSign < -EPS;
      if (!earOk) continue;
      let blocked = false;
      for (let k = 0; k < idx.length; k += 1) {
        const pi = idx[k];
        if (pi === i0 || pi === i1 || pi === i2) continue;
        if (pointInTriangle(points[pi], points[i0], points[i1], points[i2])) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      tris.push([i0, i1, i2]);
      idx.splice(i, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (idx.length === 3) {
    tris.push([idx[0], idx[1], idx[2]]);
    return tris;
  }
  const fan: [number, number, number][] = [];
  for (let i = 1; i < n - 1; i += 1) fan.push([0, i, i + 1]);
  return fan;
}

export function translatePolygon(
  points: readonly CanvasPoint[],
  dx: number,
  dy: number,
): CanvasPoint[] {
  return points.map(([x, y]) => [x + dx, y + dy] as const);
}
