/**
 * Media domain barrel — optimizer contracts and asset policies (#625).
 * Location: src/domains/media/index.ts
 */

export type {
  AssetProfileId,
  MediaByteBudget,
  MediaKind,
  MediaOptimizeAbortedResult,
  MediaOptimizeFailedResult,
  MediaOptimizeFailureCode,
  MediaOptimizeInputMeta,
  MediaOptimizeOptimizedResult,
  MediaOptimizeOverBudgetResult,
  MediaOptimizeResult,
  MediaOptimizeStatus,
  MediaOptimizeUnchangedResult,
  MediaOptimizeUnsupportedResult,
} from './optimization-contract.ts';

export {
  ASSET_PROFILE_IDS,
  MEDIA_KINDS,
  MEDIA_OPTIMIZE_STATUSES,
  assertMediaOptimizeResultInvariants,
  classifyAgainstByteBudget,
  isAssetProfileId,
  isMediaKind,
  isMediaOptimizeStatus,
} from './optimization-contract.ts';

export type {
  AssetPolicy,
  GifAnimationPolicy,
  ImageAssetPolicy,
  MediaPolicyEvaluation,
  UnsupportedKindPolicy,
} from './optimization-policy.ts';

export {
  evaluateImageAgainstPolicy,
  getImageAssetPolicy,
  isMimeAllowedForProfile,
  listImageAssetPolicies,
  mustPreserveAlpha,
  normalizeImageMime,
} from './optimization-policy.ts';
