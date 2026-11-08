/**
 * WASM integration proof for provider thumbnail optimize (#647).
 * Location: supabase/functions/_shared/media-server-raster-optimize.proof.ts
 * Invoked only via scripts/media-optimizer-provider-output-check.mjs.
 */
import { assert, assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import encodePng from 'npm:@jsquash/png@3.1.1/encode.js';
import { buildSyntheticRaster } from './media-server-optimize-proof.ts';
import {
  ITEM_THUMBNAIL_SERVER_OPTIMIZE,
  optimizeProviderThumbnailBytes,
} from './media-server-raster-optimize.ts';
import { sniffItemThumbnailMime } from './item-thumbnail-image.ts';

Deno.test('optimizeProviderThumbnailBytes: PNG → WebP within item-thumbnail budget', async () => {
  const raster = buildSyntheticRaster(1200, 900);
  const png = new Uint8Array(
    await encodePng(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height)),
  );
  const result = await optimizeProviderThumbnailBytes(png, ITEM_THUMBNAIL_SERVER_OPTIMIZE);
  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(sniffItemThumbnailMime(result.bytes), 'image/webp');
  assert(result.bytes.byteLength <= ITEM_THUMBNAIL_SERVER_OPTIMIZE.targetBytes);
  assert(Math.max(result.metrics.width, result.metrics.height) <= ITEM_THUMBNAIL_SERVER_OPTIMIZE.maxEdge);
});

Deno.test('optimizeProviderThumbnailBytes: unreachable budget is fail-closed', async () => {
  const raster = buildSyntheticRaster(800, 600);
  const png = new Uint8Array(
    await encodePng(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height)),
  );
  const result = await optimizeProviderThumbnailBytes(png, { maxEdge: 1024, targetBytes: 32 });
  assertEquals(result.ok, false);
  if (result.ok) return;
  assertEquals(result.status, 'over-budget');
});
