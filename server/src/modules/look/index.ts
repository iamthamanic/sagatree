/**
 * look module public API — MIG-412 look-reference-analysis quarantine/ports.
 * Location: server/src/modules/look/index.ts
 *
 * publicActivationAuthorized remains false for this slice (HTTP → MIG-600).
 */
export const LOOK_REFERENCE_PUBLIC_ACTIVATION_AUTHORIZED = false as const;

export {
  LOOK_REF_ANALYSIS_ALLOWED_MIME,
  LOOK_REF_ANALYSIS_MAX_BYTES,
  assertOwnerScopedStoragePath,
  bytesToBase64,
  decodeLookRefBase64Image,
  isAllowedLookRefAnalysisMime,
  sniffLookRefAnalysisMime,
  validateLookRefImageBytes,
  type LookRefAnalysisMime,
} from './internal/look-reference-image.ts';

export { createLookReferenceRateLimitStore } from './internal/look-reference-rate-limit.ts';
