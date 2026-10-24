/**
 * Versioned world/saga export-import bundles + restore drills (MIG-502 / #843).
 * Location: server/src/migration/bundles/index.ts
 *
 * Isolated-contract surface under server/src/migration/bundles. Does not cut over
 * production or shut down Supabase.
 */
export {
  BUNDLE_FORMAT,
  BUNDLE_FORMAT_VERSION,
  type BundleAssetMeta,
  type BundleAtlasNode,
  type BundleInventoryItem,
  type BundleNpc,
  type BundlePayload,
  type BundleResult,
  type ImportReport,
  type SignedBundle,
} from './types.ts';

export { checksumBundlePayload, signBundle, verifyBundleChecksum, payloadForChecksum } from './checksum.ts';
export { assertSafeRelativeToken, isSafeBundleToken } from './path-safety.ts';
export { exportHostBundle, type ExportBundleInput } from './export-bundle.ts';
export {
  importHostBundle,
  validateBundleStructure,
  type ImportBundleInput,
} from './import-bundle.ts';
export { runRestoreDrill, type RestoreDrillInput, type RestoreDrillReport } from './restore-drill.ts';
