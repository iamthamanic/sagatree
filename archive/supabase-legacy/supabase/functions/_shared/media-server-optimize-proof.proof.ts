/**
 * Deno proof tests for server-side raster optimization (#645).
 * Location: supabase/functions/_shared/media-server-optimize-proof.proof.ts
 *
 * Not named *_test.ts — CI's blanket `deno test` has no --allow-read for WASM.
 * Invoked only via scripts/media-optimizer-server-proof-check.mjs.
 *
 * Real PNG/JPEG/WebP bytes are produced by the same WASM codecs (no network fixtures).
 */
import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import encodePng from 'npm:@jsquash/png@3.1.1/encode.js';
import encodeJpeg from 'npm:@jsquash/jpeg@1.6.0/encode.js';
import encodeWebp from 'npm:@jsquash/webp@1.5.0/encode.js';
import {
  buildSyntheticRaster,
  optimizeRasterOnServerProof,
  SERVER_PROOF_MAX_PIXELS,
} from './media-server-optimize-proof.ts';
import { sniffItemThumbnailMime } from './item-thumbnail-image.ts';

const OPTIONS = { maxEdge: 1024, targetBytes: 512 * 1024 } as const;
/** Generous CI ceilings; real numbers are in docs/media-optimizer-server-decision.md. */
const MAX_TOTAL_MS = 15_000;
const MAX_RSS_DELTA_BYTES = 512 * 1024 * 1024;

function toImageData(raster: { data: Uint8ClampedArray; width: number; height: number }): ImageData {
  return new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height);
}

const raster = buildSyntheticRaster(1600, 1200);
const imageData = toImageData(raster);

const fixtures = {
  png: new Uint8Array(await encodePng(imageData)),
  jpeg: new Uint8Array(await encodeJpeg(imageData, { quality: 92 })),
  webp: new Uint8Array(await encodeWebp(imageData, { quality: 95 })),
};

for (const [name, bytes] of Object.entries(fixtures)) {
  Deno.test(`server proof: ${name} → WebP within budget, quality and resource ceilings`, async () => {
    const result = await optimizeRasterOnServerProof(bytes, OPTIONS);
    assertEquals(result.status, 'optimized', result.message);
    assert(result.output);
    assertEquals(sniffItemThumbnailMime(result.output), 'image/webp');
    assert(result.metrics.outputBytes <= OPTIONS.targetBytes);
    assert(Math.max(result.metrics.width, result.metrics.height) <= OPTIONS.maxEdge);
    assert((result.metrics.psnrDb ?? 0) >= 28, `PSNR ${result.metrics.psnrDb}`);
    assert(result.metrics.totalMs < MAX_TOTAL_MS, `totalMs ${result.metrics.totalMs}`);
    assert(result.metrics.rssDeltaBytes < MAX_RSS_DELTA_BYTES, `rss ${result.metrics.rssDeltaBytes}`);
  });
}

Deno.test('server proof: small WebP inside budget is unchanged', async () => {
  const small = buildSyntheticRaster(64, 64);
  const bytes = new Uint8Array(await encodeWebp(toImageData(small), { quality: 80 }));
  const result = await optimizeRasterOnServerProof(bytes, OPTIONS);
  assertEquals(result.status, 'unchanged');
  assertEquals(result.output, bytes);
});

Deno.test('server proof: alpha PNG keeps alpha channel through WebP', async () => {
  const alpha = buildSyntheticRaster(256, 256, true);
  const png = new Uint8Array(await encodePng(toImageData(alpha)));
  const result = await optimizeRasterOnServerProof(png, OPTIONS);
  assertEquals(result.status, 'optimized', result.message);
});

Deno.test('server proof: GIF and unknown bytes are explicit unsupported', async () => {
  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0]);
  assertEquals((await optimizeRasterOnServerProof(gif, OPTIONS)).status, 'unsupported');
  assertEquals((await optimizeRasterOnServerProof(new Uint8Array([1, 2, 3, 4]), OPTIONS)).status, 'unsupported');
});

Deno.test('server proof: unreachable targetBytes is over-budget, never a silent original', async () => {
  const result = await optimizeRasterOnServerProof(fixtures.png, { maxEdge: 1024, targetBytes: 64 });
  assertEquals(result.status, 'over-budget');
  assertEquals(result.output, null);
});

Deno.test('server proof: truncated PNG is failed with no output', async () => {
  const result = await optimizeRasterOnServerProof(fixtures.png.slice(0, 200), OPTIONS);
  assertEquals(result.status, 'failed');
  assertEquals(result.output, null);
});

Deno.test('server proof: oversized PNG header is rejected before WASM allocation', async () => {
  const forged = fixtures.png.slice(0, 64);
  const view = new DataView(forged.buffer);
  view.setUint32(16, 8000);
  view.setUint32(20, 8000);
  assert(8000 * 8000 > SERVER_PROOF_MAX_PIXELS);
  const result = await optimizeRasterOnServerProof(forged, OPTIONS);
  assertEquals(result.status, 'over-budget');
});
