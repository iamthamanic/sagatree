/**
 * host-product-deny — FE-HOST-09 explicit German DENY for residual Edge/RPC surfaces.
 * Location: src/infrastructure/host/host-product-deny.ts
 *
 * Used when host-first is on but a legacy Supabase Edge/RPC product path has no
 * host successor yet. Fail closed — never hang on GoTrue/PostgREST.
 */
import { isHostLibraryEnabled } from './host-library-http';

export function assertHostProductSurfaceAvailable(surfaceLabelDe: string): void {
  if (!isHostLibraryEnabled()) return;
  throw new Error(`${surfaceLabelDe} ist im Host-Modus noch nicht verfügbar.`);
}

export function hostProductUnavailableResult(
  surfaceLabelDe: string,
): { readonly ok: false; readonly message: string } {
  return {
    ok: false,
    message: `${surfaceLabelDe} ist im Host-Modus noch nicht verfügbar.`,
  };
}
