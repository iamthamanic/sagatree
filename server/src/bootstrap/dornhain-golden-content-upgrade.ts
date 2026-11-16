/**
 * dornhain-golden-content-upgrade — idempotent Golden content upgrade for existing worlds.
 * Location: server/src/bootstrap/dornhain-golden-content-upgrade.ts
 *
 * ATL3-V01 round 3 (#1295): worlds bootstrapped before the committed Dungeon-Forge Krypta /
 * Dornhain heightfield keep their old Golden canvas until a world reset. On every ensure the
 * Golden hierarchy seed asks {@link isUntouchedLegacyGoldenCanvas}: only a canvas whose
 * content is byte-for-byte (after canonical normalisation) one of the shipped legacy Golden
 * canvases is upgraded. Any user edit changes the signature → the map is never touched.
 * Pure: no DB access (the seed owns the UPDATE).
 */
import { createHash } from 'node:crypto';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : null;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const list = (v: unknown): Rec[] => (Array.isArray(v) ? v.filter(isRec) : []);
const byId = (a: unknown[], b: unknown[]) => String(a[0]).localeCompare(String(b[0]));

/**
 * Canonical content signature of a stored `unifiedCanvas` (rooms, walls, doors, objects, strokes,
 * heightfield). Invariant under the product re-persist (`serializeUnifiedCanvasDoc`: key order,
 * `angle: 0`, empty `doors`, layers/locks/demoSeed) — those are not content.
 */
export function goldenCanvasContentSignature(canvas: unknown): string | null {
  if (!isRec(canvas)) return null;
  const rooms = list(canvas.rooms)
    .map((r) => [str(r.id), num(r.x), num(r.y), num(r.w), num(r.h), str(r.material), r.secret === true])
    .sort(byId);
  const walls = list(canvas.walls)
    .map((w) => [str(w.id), num(w.x1), num(w.y1), num(w.x2), num(w.y2), num(w.width)])
    .sort(byId);
  const doors = list(canvas.doors)
    .map((d) => [str(d.id), str(d.wallId), num(d.t), num(d.width)])
    .sort(byId);
  const objects = list(canvas.objects)
    .map((o) => [
      str(o.id),
      str(o.type),
      num(o.x),
      num(o.y),
      num(o.size),
      num(o.height) && (num(o.height) as number) > 0 ? num(o.height) : null,
      num(o.angle) ?? 0,
      num(o.z),
      o.secret === true,
    ])
    .sort(byId);
  const strokes = list(canvas.strokes)
    .map((s) => [
      str(s.id),
      str(s.material),
      num(s.width),
      Array.isArray(s.points)
        ? s.points.map((p) => (Array.isArray(p) ? [num(p[0]), num(p[1])] : null))
        : [],
    ])
    .sort(byId);
  const hf = isRec(canvas.heightfield) ? canvas.heightfield : null;
  const heightfield = hf
    ? [
        num(hf.originX),
        num(hf.originZ),
        num(hf.cellSize),
        num(hf.cols),
        num(hf.rows),
        num(hf.waterLevel),
        Array.isArray(hf.heights) ? hf.heights.map(num) : [],
      ]
    : null;
  const body = JSON.stringify({ rooms, walls, doors, objects, strokes, heightfield });
  return createHash('sha256').update(body).digest('hex').slice(0, 32);
}

/** Pre-V01 Golden Krypta (main before ATL3-V01, ATL2-A03 seed) — kept verbatim for the upgrade check. */
export const DORNHAIN_GOLDEN_CRYPT_V1_CANVAS = {
  rooms: [
    { id: 'g.crypt.hall', material: 'stein', x: 240, y: 240, w: 360, h: 280 },
    { id: 'g.crypt.vault', material: 'erde', x: 320, y: 560, w: 200, h: 160 },
  ],
  walls: [
    { id: 'g.crypt.w1', x1: 240, y1: 240, x2: 600, y2: 240, width: 10 },
    { id: 'g.crypt.w2', x1: 240, y1: 240, x2: 240, y2: 520, width: 10 },
    { id: 'g.crypt.w3', x1: 600, y1: 240, x2: 600, y2: 520, width: 10 },
  ],
  objects: [
    { id: 'g.crypt.relic', type: 'kiste', x: 400, y: 360, size: 0.5 },
    { id: 'g.crypt.lamp', type: 'lampe', x: 300, y: 300, size: 0.35 },
  ],
  strokes: [],
} as const;

/**
 * Signatures of shipped-but-superseded Golden canvases that are not reproducible from current
 * code. `crypt-v01-round2`: forge crypt of PR #1302 round 2 (centerline `dcorr-*` wall bars,
 * normalised prop sizes) — only dev/CI worlds of that branch can carry it.
 */
export const DORNHAIN_GOLDEN_LEGACY_SIGNATURES: Readonly<Record<string, readonly string[]>> = {
  'dornhain.map.loc.crypt': ['bccaf84b4a1049ee145cf5230d306207'],
};

/** Legacy Golden canvases for `seedKey`, derived from the current Golden canvas where possible. */
export function legacyGoldenCanvasSignatures(seedKey: string, currentCanvas: unknown): readonly string[] {
  const out = [...(DORNHAIN_GOLDEN_LEGACY_SIGNATURES[seedKey] ?? [])];
  if (seedKey === 'dornhain.map.loc.crypt') {
    const v1 = goldenCanvasContentSignature(DORNHAIN_GOLDEN_CRYPT_V1_CANVAS);
    if (v1) out.push(v1);
  }
  if (seedKey === 'dornhain.map.place.dornhain' && isRec(currentCanvas) && isRec(currentCanvas.heightfield)) {
    // Pre-V01 Dornhain = identical town content without the canonical heightfield.
    const { heightfield: _hf, ...flat } = currentCanvas;
    const sig = goldenCanvasContentSignature(flat);
    if (sig) out.push(sig);
  }
  return out;
}

/**
 * True when the stored canvas is an untouched superseded Golden canvas for `seedKey` (safe to
 * replace). False for the current Golden canvas (idempotent) and for any user-edited canvas.
 */
export function isUntouchedLegacyGoldenCanvas(seedKey: string, storedCanvas: unknown, currentCanvas: unknown): boolean {
  const stored = goldenCanvasContentSignature(storedCanvas);
  if (!stored) return false;
  if (stored === goldenCanvasContentSignature(currentCanvas)) return false;
  return legacyGoldenCanvasSignatures(seedKey, currentCanvas).includes(stored);
}
