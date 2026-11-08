/**
 * Server-side raster optimization for the Deno Edge runtime (#645/#647).
 * Location: supabase/functions/_shared/media-server-optimize-proof.ts
 *
 * Decode PNG/JPEG/WebP → (optional box downscale) → WebP encode with a quality ladder.
 * Adopted by production item-thumbnail Meshy persist via `media-server-raster-optimize.ts`
 * after the `deno-adapter` decision in docs/media-optimizer-server-decision.md.
 *
 * Codecs: @jsquash/{png,jpeg,webp} (WASM, same family as the browser engine #630).
 */
import decodePng from 'npm:@jsquash/png@3.1.1/decode.js';
import decodeJpeg from 'npm:@jsquash/jpeg@1.6.0/decode.js';
import decodeWebp from 'npm:@jsquash/webp@1.5.0/decode.js';
import encodeWebp from 'npm:@jsquash/webp@1.5.0/encode.js';
import { sniffItemThumbnailMime } from './item-thumbnail-image.ts';

export const SERVER_PROOF_MAX_INPUT_BYTES = 10 * 1024 * 1024;
/** Mirrors browser IMAGE_ENGINE_MAX_PIXELS (4096²) — protects Edge RAM. */
export const SERVER_PROOF_MAX_PIXELS = 16_777_216;
export const SERVER_PROOF_QUALITY_LADDER = [85, 75, 65, 50] as const;

export type ServerProofStatus =
  | 'optimized'
  | 'unchanged'
  | 'unsupported'
  | 'over-budget'
  | 'failed';

export type ServerProofMetrics = {
  readonly inputBytes: number;
  readonly outputBytes: number;
  readonly width: number;
  readonly height: number;
  readonly decodeMs: number;
  readonly encodeMs: number;
  readonly totalMs: number;
  readonly rssDeltaBytes: number;
  readonly quality: number | null;
  /** PSNR (dB) of the encoded result vs. the (possibly scaled) decoded source; null if not encoded. */
  readonly psnrDb: number | null;
};

export type ServerProofResult = {
  readonly status: ServerProofStatus;
  readonly message: string;
  readonly output: Uint8Array | null;
  readonly metrics: ServerProofMetrics;
};

export type ServerProofOptions = {
  readonly maxEdge: number;
  readonly targetBytes: number;
};

type Raster = {
  readonly data: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
};

const EMPTY_METRICS: ServerProofMetrics = {
  inputBytes: 0,
  outputBytes: 0,
  width: 0,
  height: 0,
  decodeMs: 0,
  encodeMs: 0,
  totalMs: 0,
  rssDeltaBytes: 0,
  quality: null,
  psnrDb: null,
};

function toImageData(raster: Raster): ImageData {
  // Fresh ArrayBuffer-backed copy for Deno ImageData / jsquash encode typing.
  return new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height);
}

/** PNG IHDR width/height without decoding (guards RAM before WASM allocation). */
export function readPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function isGif(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
}

async function decodeRaster(bytes: Uint8Array, mime: 'image/png' | 'image/jpeg' | 'image/webp'): Promise<Raster> {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const image =
    mime === 'image/png'
      ? await decodePng(buffer)
      : mime === 'image/jpeg'
        ? await decodeJpeg(buffer)
        : await decodeWebp(buffer);
  return {
    data: new Uint8ClampedArray(image.data),
    width: image.width,
    height: image.height,
  };
}

/** Box-average downscale (alpha-weighted not needed for proof; premultiplication ignored). */
export function downscaleRaster(source: Raster, maxEdge: number): Raster {
  const longest = Math.max(source.width, source.height);
  if (longest <= maxEdge) return source;
  const scale = maxEdge / longest;
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor((y * source.height) / height);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * source.height) / height));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor((x * source.width) / width);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * source.width) / width));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const i = (sy * source.width + sx) * 4;
          r += source.data[i];
          g += source.data[i + 1];
          b += source.data[i + 2];
          a += source.data[i + 3];
          n++;
        }
      }
      const o = (y * width + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = a / n;
    }
  }
  return { data: out, width, height };
}

/** Peak signal-to-noise ratio over RGB channels (dB); Infinity if identical. */
export function psnrRgb(a: Raster, b: Raster): number {
  if (a.width !== b.width || a.height !== b.height) return Number.NaN;
  let sum = 0;
  const pixels = a.width * a.height;
  for (let p = 0; p < pixels; p++) {
    for (let c = 0; c < 3; c++) {
      const d = a.data[p * 4 + c] - b.data[p * 4 + c];
      sum += d * d;
    }
  }
  const mse = sum / (pixels * 3);
  return mse === 0 ? Number.POSITIVE_INFINITY : 10 * Math.log10((255 * 255) / mse);
}

function failure(
  status: Exclude<ServerProofStatus, 'optimized' | 'unchanged'>,
  message: string,
  partial: Partial<ServerProofMetrics>,
): ServerProofResult {
  return { status, message, output: null, metrics: { ...EMPTY_METRICS, ...partial } };
}

/**
 * Explicit statuses only — never a silent original after failure.
 * Response shape: {@link ServerProofResult}.
 */
export async function optimizeRasterOnServerProof(
  input: Uint8Array,
  options: ServerProofOptions,
): Promise<ServerProofResult> {
  const startedAt = performance.now();
  const rssBefore = Deno.memoryUsage().rss;
  const base = { inputBytes: input.byteLength };

  if (input.byteLength === 0 || input.byteLength > SERVER_PROOF_MAX_INPUT_BYTES) {
    return failure('over-budget', 'Eingabegröße außerhalb des Serverbudgets.', base);
  }
  if (isGif(input)) {
    return failure('unsupported', 'GIF wird serverseitig nicht optimiert (Animation bliebe nicht erhalten).', base);
  }
  const mime = sniffItemThumbnailMime(input);
  if (!mime) {
    return failure('unsupported', 'Unbekanntes Bildformat (Magic Bytes).', base);
  }
  if (mime === 'image/png') {
    const dims = readPngDimensions(input);
    if (!dims || dims.width < 1 || dims.height < 1 || dims.width * dims.height > SERVER_PROOF_MAX_PIXELS) {
      return failure('over-budget', 'PNG-Abmessungen überschreiten das Pixelbudget.', base);
    }
  }

  try {
    const decodeStart = performance.now();
    const decoded = await decodeRaster(input, mime);
    const decodeMs = performance.now() - decodeStart;
    if (decoded.width * decoded.height > SERVER_PROOF_MAX_PIXELS) {
      return failure('over-budget', 'Bild überschreitet das Pixelbudget.', { ...base, decodeMs });
    }
    const source = downscaleRaster(decoded, options.maxEdge);
    const resized = source !== decoded;

    if (mime === 'image/webp' && !resized && input.byteLength <= options.targetBytes) {
      return {
        status: 'unchanged',
        message: 'WebP bereits innerhalb Budget.',
        output: input,
        metrics: {
          ...EMPTY_METRICS,
          ...base,
          outputBytes: input.byteLength,
          width: decoded.width,
          height: decoded.height,
          decodeMs,
          totalMs: performance.now() - startedAt,
        },
      };
    }

    const encodeStart = performance.now();
    let lastBytes = 0;
    for (const quality of SERVER_PROOF_QUALITY_LADDER) {
      const encoded = new Uint8Array(await encodeWebp(toImageData(source), { quality }));
      lastBytes = encoded.byteLength;
      if (encoded.byteLength <= options.targetBytes) {
        const encodeMs = performance.now() - encodeStart;
        const roundTrip = await decodeRaster(encoded, 'image/webp');
        return {
          status: 'optimized',
          message: 'Zu WebP optimiert.',
          output: encoded,
          metrics: {
            inputBytes: input.byteLength,
            outputBytes: encoded.byteLength,
            width: source.width,
            height: source.height,
            decodeMs,
            encodeMs,
            totalMs: performance.now() - startedAt,
            rssDeltaBytes: Deno.memoryUsage().rss - rssBefore,
            quality,
            psnrDb: psnrRgb(source, roundTrip),
          },
        };
      }
    }
    return failure('over-budget', 'Zielbytes auch bei niedrigster Qualität nicht erreichbar.', {
      ...base,
      outputBytes: lastBytes,
      width: source.width,
      height: source.height,
      decodeMs,
      encodeMs: performance.now() - encodeStart,
      totalMs: performance.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Decode-/Encode-Fehler';
    console.error('[media-server-proof] decode/encode failed', message);
    return failure('failed', `Decode/Encode fehlgeschlagen: ${message}`, base);
  }
}

/** Synthetic photo-like RGBA fixture (gradients + deterministic noise) for reproducible proofs. */
export function buildSyntheticRaster(width: number, height: number, withAlpha = false): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  let seed = 1234567;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const noise = (seed >>> 24) % 24;
      const i = (y * width + x) * 4;
      data[i] = (x / width) * 200 + noise;
      data[i + 1] = (y / height) * 200 + noise;
      data[i + 2] = ((x + y) / (width + height)) * 255;
      data[i + 3] = withAlpha ? Math.round((x / width) * 255) : 255;
    }
  }
  return { data, width, height };
}
