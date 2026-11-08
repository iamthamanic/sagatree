/**
 * Production Deno Edge raster optimize adapter (#647).
 * Location: supabase/functions/_shared/media-server-raster-optimize.ts
 *
 * Adopts the #645 Deno proof (`media-server-optimize-proof.ts`) for provider
 * item-thumbnail bytes after SSRF download + before Storage persist.
 * Failures return explicit statuses — never a silent original.
 */
import {
  optimizeRasterOnServerProof,
  type ServerProofOptions,
  type ServerProofResult,
  type ServerProofStatus,
} from './media-server-optimize-proof.ts';
import {
  type ItemThumbnailMime,
  validateThumbnailBytes,
} from './item-thumbnail-image.ts';

/** Mirrors domain `item-thumbnail` policy (maxEdgePx / targetBytes). */
export const ITEM_THUMBNAIL_SERVER_OPTIMIZE: ServerProofOptions = {
  maxEdge: 1024,
  targetBytes: 1 * 1024 * 1024,
};

/** Soft wall-clock gate for Edge CPU; exceeded → failed (no persist). */
export const ITEM_THUMBNAIL_SERVER_OPTIMIZE_MAX_MS = 10_000;

export type ProviderThumbnailOptimizeOk = {
  readonly ok: true;
  readonly mime: ItemThumbnailMime;
  readonly bytes: Uint8Array;
  readonly status: Extract<ServerProofStatus, 'optimized' | 'unchanged'>;
  readonly metrics: ServerProofResult['metrics'];
};

export type ProviderThumbnailOptimizeErr = {
  readonly ok: false;
  readonly status: Exclude<ServerProofStatus, 'optimized' | 'unchanged'>;
  readonly message: string;
  readonly metrics: ServerProofResult['metrics'];
};

export type ProviderThumbnailOptimizeResult =
  | ProviderThumbnailOptimizeOk
  | ProviderThumbnailOptimizeErr;

/**
 * Optimize provider raster bytes for item-thumbnail Storage.
 * Response shape: {@link ProviderThumbnailOptimizeResult}.
 */
export async function optimizeProviderThumbnailBytes(
  input: Uint8Array,
  options: ServerProofOptions = ITEM_THUMBNAIL_SERVER_OPTIMIZE,
): Promise<ProviderThumbnailOptimizeResult> {
  const result = await optimizeRasterOnServerProof(input, options);

  if (result.metrics.totalMs > ITEM_THUMBNAIL_SERVER_OPTIMIZE_MAX_MS) {
    return {
      ok: false,
      status: 'failed',
      message: `Server-Optimierung überschritt das Zeitbudget (${ITEM_THUMBNAIL_SERVER_OPTIMIZE_MAX_MS} ms).`,
      metrics: result.metrics,
    };
  }

  if (result.status === 'optimized' || result.status === 'unchanged') {
    if (!result.output) {
      return {
        ok: false,
        status: 'failed',
        message: 'Optimierung lieferte kein Ausgabe-Byte.',
        metrics: result.metrics,
      };
    }
    try {
      const validated = validateThumbnailBytes(result.output);
      return {
        ok: true,
        mime: validated.mime,
        bytes: validated.bytes,
        status: result.status,
        metrics: result.metrics,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nach-Encode-Validierung fehlgeschlagen';
      return {
        ok: false,
        status: 'failed',
        message,
        metrics: result.metrics,
      };
    }
  }

  return {
    ok: false,
    status: result.status,
    message: result.message,
    metrics: result.metrics,
  };
}

/** Pure helper for job error text (unit-tested without WASM). */
export function providerOptimizeFailureMessage(
  result: ProviderThumbnailOptimizeErr,
): string {
  return result.message || `Server-Optimierung fehlgeschlagen (${result.status}).`;
}
