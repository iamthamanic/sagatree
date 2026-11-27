/**
 * pbr-textures — ATL3-M01 (#1297) deterministic procedural PBR texture synthesis.
 * Location: src/infrastructure/world/atlas-three/pbr-textures.ts
 *
 * Infrastructure layer (Three.js + browser Canvas). Generates tileable albedo,
 * Sobel normal, and roughness CanvasTextures for all fantasy terrain, masonry,
 * roof, wood, and foliage surfaces — zero external asset downloads or license debt.
 */
import * as THREE from 'three';

export const ATLAS_PBR_KINDS = [
  'grass',
  'dirt',
  'moss',
  'rock',
  'snow',
  'sand',
  'gravel',
  'cobble',
  'wall',
  'plaster',
  'wood',
  'roofTile',
  'roofSlate',
  'roofMoss',
  'fabric',
] as const;

export type AtlasPbrKind = (typeof ATLAS_PBR_KINDS)[number];

export type AtlasPbrTextureSet = {
  readonly map: THREE.CanvasTexture;
  readonly normal: THREE.CanvasTexture;
  readonly rough: THREE.CanvasTexture;
};

type Rgb = readonly [number, number, number];

function hash2d(ix: number, iy: number, seed: number): number {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Tileable value noise on period `period`. */
function tileNoise(u: number, v: number, period: number, seed: number): number {
  const x = ((u % 1) + 1) % 1 * period;
  const y = ((v % 1) + 1) % 1 * period;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash2d(x0, y0, seed);
  const n10 = hash2d(x1, y0, seed);
  const n01 = hash2d(x0, y1, seed);
  const n11 = hash2d(x1, y1, seed);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

/** Tileable 4-octave fractal Brownian motion in [0, 1]. */
function tileFbm(u: number, v: number, basePeriod: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let period = basePeriod;
  for (let oct = 0; oct < 4; oct += 1) {
    sum += tileNoise(u, v, period, seed + oct * 31) * amp;
    norm += amp;
    amp *= 0.5;
    period *= 2;
  }
  return sum / norm;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  srgb: boolean,
  anisotropy: number,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function synthesizeSurface(
  kind: AtlasPbrKind,
  size: number,
  anisotropy: number,
): AtlasPbrTextureSet {
  const albedoCanvas = document.createElement('canvas');
  const normalCanvas = document.createElement('canvas');
  const roughCanvas = document.createElement('canvas');
  albedoCanvas.width = normalCanvas.width = roughCanvas.width = size;
  albedoCanvas.height = normalCanvas.height = roughCanvas.height = size;

  const aCtx = albedoCanvas.getContext('2d');
  const nCtx = normalCanvas.getContext('2d');
  const rCtx = roughCanvas.getContext('2d');
  if (!aCtx || !nCtx || !rCtx) {
    return {
      map: configureTexture(albedoCanvas, true, anisotropy),
      normal: configureTexture(normalCanvas, false, anisotropy),
      rough: configureTexture(roughCanvas, false, anisotropy),
    };
  }

  const aImg = aCtx.createImageData(size, size);
  const nImg = nCtx.createImageData(size, size);
  const rImg = rCtx.createImageData(size, size);
  const heightField = new Float32Array(size * size);
  const seed = ATLAS_PBR_KINDS.indexOf(kind) * 97 + 13;

  for (let py = 0; py < size; py += 1) {
    const v = py / size;
    for (let px = 0; px < size; px += 1) {
      const u = px / size;
      const idx = py * size + px;
      const fbm = tileFbm(u, v, 8, seed);
      const fine = tileFbm(u, v, 24, seed + 199);

      let rgb: Rgb = [140, 140, 140];
      let h = fbm * 0.65 + fine * 0.35;
      let rough = 0.88;

      switch (kind) {
        case 'grass': {
          const blades = tileNoise(u, v, 48, seed + 7);
          const patch = tileFbm(u, v, 4, seed + 51);
          rgb = mixRgb([76, 118, 66], [122, 158, 86], fbm * 0.65 + patch * 0.35);
          rgb = mixRgb(rgb, [145, 168, 92], blades * 0.25);
          h = fbm * 0.45 + blades * 0.55;
          rough = 0.92 - blades * 0.1;
          break;
        }
        case 'moss': {
          const tuft = tileFbm(u, v, 16, seed + 17);
          rgb = mixRgb([56, 94, 58], [108, 144, 78], tuft);
          h = tuft * 0.7 + fine * 0.3;
          rough = 0.95;
          break;
        }
        case 'dirt': {
          const pebbles = tileNoise(u, v, 32, seed + 9);
          rgb = mixRgb([112, 86, 60], [164, 134, 96], fbm);
          if (pebbles > 0.82) rgb = mixRgb(rgb, [142, 132, 118], 0.55);
          h = fbm * 0.6 + pebbles * 0.4;
          rough = 0.96;
          break;
        }
        case 'sand': {
          const ripple = Math.sin((u * 6 + fbm * 0.85) * Math.PI * 2) * 0.5 + 0.5;
          rgb = mixRgb([196, 178, 136], [224, 209, 168], ripple * 0.55 + fine * 0.45);
          h = ripple * 0.5 + fine * 0.5;
          rough = 0.86;
          break;
        }
        case 'gravel': {
          const grit = tileNoise(u, v, 40, seed + 23);
          rgb = mixRgb([138, 134, 122], [192, 184, 166], grit * 0.6 + fbm * 0.4);
          h = grit * 0.65 + fine * 0.35;
          rough = 0.92;
          break;
        }
        case 'rock': {
          const strata = Math.sin((v * 5 + fbm * 1.4) * Math.PI * 2) * 0.5 + 0.5;
          const crack = Math.abs(tileFbm(u, v, 12, seed + 41) - 0.5) * 2;
          rgb = mixRgb([86, 94, 92], [148, 152, 142], strata * 0.55 + fbm * 0.45);
          if (crack < 0.14) rgb = mixRgb(rgb, [46, 52, 54], 0.7);
          h = strata * 0.5 + crack * 0.35 + fine * 0.15;
          rough = 0.9;
          break;
        }
        case 'snow': {
          const drift = tileFbm(u, v, 6, seed + 61);
          rgb = mixRgb([214, 226, 234], [244, 248, 250], drift * 0.7 + fine * 0.3);
          h = drift * 0.75 + fine * 0.25;
          rough = 0.78;
          break;
        }
        case 'cobble': {
          // Organic medieval warm sandstone flagstones (soft warm earth mortar + subtle moss — zero polka-dot grid!)
          const gx = 5;
          const gy = 5;
          const warpU = u + (fbm - 0.5) * 0.045;
          const warpV = v + (fine - 0.5) * 0.045;
          const row = Math.floor(((warpV % 1) + 1) % 1 * gy);
          const su = ((((warpU % 1) + 1) % 1) * gx + (row % 2) * 0.45) % gx;
          const sv = ((((warpV % 1) + 1) % 1) * gy) % 1;
          const cellX = Math.floor(su);
          const fx = su - cellX;
          const fy = sv;
          const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
          const mortar = edge < 0.055 ? 0 : Math.min(1, (edge - 0.055) / 0.11);
          const tone = hash2d(cellX, row, seed + 88);
          const warmHue = hash2d(cellX + 7, row + 3, seed + 141);
          const stoneBase = mixRgb([152, 142, 124], [198, 184, 158], tone * 0.65 + fine * 0.35);
          const stone = mixRgb(stoneBase, [174, 166, 148], warmHue * 0.35);
          const mortarCol = fbm > 0.62 ? ([98, 108, 82] as Rgb) : ([104, 96, 84] as Rgb);
          rgb = mixRgb(mortarCol, stone, mortar);
          h = mortar * (0.68 + tone * 0.18 + fine * 0.14);
          rough = 0.78 + (1 - mortar) * 0.18;
          break;
        }
        case 'wall': {
          const cols = 4;
          const rows = 6;
          const row = Math.floor(v * rows);
          const su = (u * cols + (row % 2) * 0.48) % cols;
          const cellX = Math.floor(su);
          const fx = su - cellX;
          const fy = (v * rows) % 1;
          const edge = Math.min(fx, 1 - fx, fy, 1 - fy);
          const mortar = edge < 0.045 ? 0 : Math.min(1, (edge - 0.045) / 0.08);
          const tone = hash2d(cellX, row, seed + 77);
          const block = mixRgb([134, 128, 116], [186, 178, 160], tone * 0.62 + fbm * 0.38);
          rgb = mixRgb([84, 80, 74], block, mortar);
          h = mortar * (0.68 + fine * 0.32);
          rough = 0.86;
          break;
        }
        case 'plaster': {
          rgb = mixRgb([220, 204, 174], [244, 234, 208], fbm * 0.75 + fine * 0.25);
          h = 0.5 + (fbm - 0.5) * 0.32 + (fine - 0.5) * 0.18;
          rough = 0.91;
          break;
        }
        case 'wood': {
          const plank = Math.floor(v * 6);
          const pv = (v * 6) % 1;
          const endJoint = Math.abs((((u * 2 + plank * 0.37) % 1) + 1) % 1 - 0.5) < 0.012 ? 0.35 : 1;
          const seam = pv < 0.04 || pv > 0.96 ? 0.2 : endJoint;
          const grain =
            Math.sin((v * 46 + tileFbm(u, v, 8, seed + 12) * 5.2) * Math.PI) * 0.5 + 0.5;
          const tone = hash2d(plank, 3, seed + 33);
          const board = mixRgb([124, 84, 52], [184, 134, 84], grain * 0.55 + tone * 0.45);
          rgb = mixRgb([64, 42, 26], board, seam);
          h = seam * (0.58 + grain * 0.32 + fine * 0.1);
          rough = 0.68 + (1 - grain) * 0.18;
          break;
        }
        case 'fabric': {
          const weave = (Math.sin(u * Math.PI * 64) * Math.sin(v * Math.PI * 64)) * 0.5 + 0.5;
          const border =
            u < 0.08 || u > 0.92 || v < 0.08 || v > 0.92
              ? 1
              : u < 0.12 || u > 0.88 || v < 0.12 || v > 0.88
                ? 0.65
                : 0;
          const base = mixRgb([128, 34, 38], [166, 48, 46], fbm * 0.6 + weave * 0.4);
          const trim = mixRgb([196, 152, 68], [228, 188, 96], weave * 0.5 + fine * 0.5);
          rgb = mixRgb(base, trim, border);
          h = 0.5 + weave * 0.25 + border * 0.15;
          rough = 0.94;
          break;
        }
        case 'roofTile':
        case 'roofSlate':
        case 'roofMoss': {
          const cols = 8;
          const rows = 10;
          const row = Math.floor(v * rows);
          const su = (u * cols + (row % 2) * 0.5) % cols;
          const cellX = Math.floor(su);
          const fx = su - cellX;
          const fy = (v * rows) % 1;
          const overlap = fy;
          const gap = fx < 0.06 || fx > 0.94 || fy < 0.08 ? 0.15 : 1;
          const tone = hash2d(cellX, row, seed + 123);
          const pair: readonly [Rgb, Rgb] =
            kind === 'roofTile'
              ? [
                  [138, 66, 46],
                  [194, 102, 68],
                ]
              : kind === 'roofSlate'
                ? [
                    [62, 74, 86],
                    [104, 118, 132],
                  ]
                : [
                    [72, 98, 62],
                    [122, 138, 84],
                  ];
          const base = mixRgb(pair[0], pair[1], tone * 0.6 + fine * 0.4);
          rgb = mixRgb([36, 32, 30], base, gap * (0.72 + overlap * 0.28));
          h = gap * (0.3 + overlap * 0.65);
          rough = kind === 'roofSlate' ? 0.72 : 0.84;
          break;
        }
      }

      heightField[idx] = h;
      const o = idx * 4;
      aImg.data[o] = clampByte(rgb[0]);
      aImg.data[o + 1] = clampByte(rgb[1]);
      aImg.data[o + 2] = clampByte(rgb[2]);
      aImg.data[o + 3] = 255;

      const rb = clampByte(rough * 255);
      rImg.data[o] = rb;
      rImg.data[o + 1] = rb;
      rImg.data[o + 2] = rb;
      rImg.data[o + 3] = 255;
    }
  }

  // Sobel gradient heightfield → tangent-space normal map.
  const strength = 2.4;
  for (let py = 0; py < size; py += 1) {
    const ym = (py - 1 + size) % size;
    const yp = (py + 1) % size;
    for (let px = 0; px < size; px += 1) {
      const xm = (px - 1 + size) % size;
      const xp = (px + 1) % size;
      const tl = heightField[ym * size + xm]!;
      const tc = heightField[ym * size + px]!;
      const tr = heightField[ym * size + xp]!;
      const ml = heightField[py * size + xm]!;
      const mr = heightField[py * size + xp]!;
      const bl = heightField[yp * size + xm]!;
      const bc = heightField[yp * size + px]!;
      const br = heightField[yp * size + xp]!;
      const dx = (tr + 2 * mr + br - (tl + 2 * ml + bl)) * strength;
      const dy = (bl + 2 * bc + br - (tl + 2 * tc + tr)) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);
      const o = (py * size + px) * 4;
      nImg.data[o] = clampByte((-dx * invLen * 0.5 + 0.5) * 255);
      nImg.data[o + 1] = clampByte((-dy * invLen * 0.5 + 0.5) * 255);
      nImg.data[o + 2] = clampByte((dz * invLen * 0.5 + 0.5) * 255);
      nImg.data[o + 3] = 255;
    }
  }

  aCtx.putImageData(aImg, 0, 0);
  nCtx.putImageData(nImg, 0, 0);
  rCtx.putImageData(rImg, 0, 0);

  return {
    map: configureTexture(albedoCanvas, true, anisotropy),
    normal: configureTexture(normalCanvas, false, anisotropy),
    rough: configureTexture(roughCanvas, false, anisotropy),
  };
}

export class AtlasPbrTextureLibrary {
  private readonly sets = new Map<AtlasPbrKind, AtlasPbrTextureSet>();

  constructor(
    private readonly size: number,
    private readonly anisotropy: number,
  ) {}

  get(kind: AtlasPbrKind): AtlasPbrTextureSet {
    const cached = this.sets.get(kind);
    if (cached) return cached;
    const created = synthesizeSurface(kind, this.size, this.anisotropy);
    this.sets.set(kind, created);
    return created;
  }

  dispose(): void {
    for (const set of this.sets.values()) {
      set.map.dispose();
      set.normal.dispose();
      set.rough.dispose();
    }
    this.sets.clear();
  }
}
