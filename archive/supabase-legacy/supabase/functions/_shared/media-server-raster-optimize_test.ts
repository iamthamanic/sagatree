/**
 * Unit tests for provider thumbnail optimize helpers (#647) — no WASM encode.
 * Location: supabase/functions/_shared/media-server-raster-optimize_test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  ITEM_THUMBNAIL_SERVER_OPTIMIZE,
  ITEM_THUMBNAIL_SERVER_OPTIMIZE_MAX_MS,
  providerOptimizeFailureMessage,
} from './media-server-raster-optimize.ts';

Deno.test('item-thumbnail server optimize budgets match domain policy', () => {
  assertEquals(ITEM_THUMBNAIL_SERVER_OPTIMIZE.maxEdge, 1024);
  assertEquals(ITEM_THUMBNAIL_SERVER_OPTIMIZE.targetBytes, 1 * 1024 * 1024);
  assertEquals(ITEM_THUMBNAIL_SERVER_OPTIMIZE_MAX_MS, 10_000);
});

Deno.test('providerOptimizeFailureMessage keeps explicit status text', () => {
  const empty = providerOptimizeFailureMessage({
    ok: false,
    status: 'over-budget',
    message: '',
    metrics: {
      inputBytes: 1,
      outputBytes: 0,
      width: 0,
      height: 0,
      decodeMs: 0,
      encodeMs: 0,
      totalMs: 0,
      rssDeltaBytes: 0,
      quality: null,
      psnrDb: null,
    },
  });
  assertEquals(empty.includes('over-budget'), true);

  const custom = providerOptimizeFailureMessage({
    ok: false,
    status: 'failed',
    message: 'Decode/Encode fehlgeschlagen: boom',
    metrics: {
      inputBytes: 1,
      outputBytes: 0,
      width: 0,
      height: 0,
      decodeMs: 0,
      encodeMs: 0,
      totalMs: 0,
      rssDeltaBytes: 0,
      quality: null,
      psnrDb: null,
    },
  });
  assertEquals(custom, 'Decode/Encode fehlgeschlagen: boom');
});
