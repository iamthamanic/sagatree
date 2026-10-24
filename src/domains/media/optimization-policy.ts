/**
 * Media optimizer asset policies — profile limits for portrait/map/look/item (#625).
 * Location: src/domains/media/optimization-policy.ts
 *
 * Mirrors current product limits from epic #624. Client policies are advisory;
 * Edge/Storage MIME and owner checks remain authoritative.
 */

import type {
  AssetProfileId,
  MediaByteBudget,
  MediaKind,
  MediaOptimizeInputMeta,
} from './optimization-contract.ts';
import { classifyAgainstByteBudget } from './optimization-contract.ts';

const MiB = 1024 * 1024;

export type GifAnimationPolicy = 'allow' | 'convert-static-required' | 'reject';

export type ImageAssetPolicy = {
  readonly profileId: AssetProfileId;
  readonly kind: 'image';
  readonly allowedMimeTypes: readonly string[];
  readonly budget: MediaByteBudget;
  /** Soft max dimension hint for later engines (not a hard encode floor here). */
  readonly maxEdgePx: number;
  readonly minQuality: number;
  readonly preserveAlpha: boolean;
  readonly gifAnimation: GifAnimationPolicy;
  /** When false, engines must not emit WebP until coordinated migration completes. */
  readonly allowWebpOutput: boolean;
  readonly maxImagesPerRequest?: number;
  /** Hard aggregate JSON/Base64 request ceiling (Look analysis). */
  readonly maxAggregateRequestBytes?: number;
};

export type UnsupportedKindPolicy = {
  readonly profileId: AssetProfileId;
  readonly kind: Exclude<MediaKind, 'image'>;
  readonly supported: false;
  readonly message: string;
};

export type AssetPolicy = ImageAssetPolicy | UnsupportedKindPolicy;

const CHARACTER_PORTRAIT_POLICY: ImageAssetPolicy = {
  profileId: 'character-portrait',
  kind: 'image',
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  budget: {
    targetBytes: 1 * MiB,
    maxUploadBytes: 5 * MiB,
  },
  maxEdgePx: 2048,
  minQuality: 42,
  preserveAlpha: true,
  gifAnimation: 'convert-static-required',
  allowWebpOutput: true,
};

const MAP_PIN_POLICY: ImageAssetPolicy = {
  profileId: 'map-pin',
  kind: 'image',
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  budget: {
    targetBytes: 512 * 1024,
    maxUploadBytes: 5 * MiB,
  },
  maxEdgePx: 1024,
  minQuality: 48,
  preserveAlpha: true,
  gifAnimation: 'reject',
  allowWebpOutput: true,
};

const LOOK_REFERENCE_POLICY: ImageAssetPolicy = {
  profileId: 'look-reference',
  kind: 'image',
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  budget: {
    targetBytes: 2 * MiB,
    maxUploadBytes: 8 * MiB,
  },
  maxEdgePx: 2048,
  minQuality: 48,
  preserveAlpha: true,
  gifAnimation: 'reject',
  allowWebpOutput: true,
  maxImagesPerRequest: 10,
  maxAggregateRequestBytes: 12 * MiB,
};

/**
 * Item thumbnails: PNG/JPEG/WebP (#641) — Domain/Edge/Bucket/DB/Meshy aligned.
 */
const ITEM_THUMBNAIL_POLICY: ImageAssetPolicy = {
  profileId: 'item-thumbnail',
  kind: 'image',
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  budget: {
    targetBytes: 1 * MiB,
    maxUploadBytes: 10 * MiB,
  },
  maxEdgePx: 1024,
  minQuality: 55,
  preserveAlpha: true,
  gifAnimation: 'reject',
  allowWebpOutput: true,
};

/**
 * Account profile avatar (#682) — smaller than character-portrait; GIF rejected.
 */
const USER_AVATAR_POLICY: ImageAssetPolicy = {
  profileId: 'user-avatar',
  kind: 'image',
  allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  budget: {
    targetBytes: 400 * 1024,
    maxUploadBytes: 5 * MiB,
  },
  maxEdgePx: 768,
  minQuality: 48,
  preserveAlpha: true,
  gifAnimation: 'reject',
  allowWebpOutput: true,
};

const IMAGE_POLICIES: Record<AssetProfileId, ImageAssetPolicy> = {
  'character-portrait': CHARACTER_PORTRAIT_POLICY,
  'map-pin': MAP_PIN_POLICY,
  'look-reference': LOOK_REFERENCE_POLICY,
  'item-thumbnail': ITEM_THUMBNAIL_POLICY,
  'user-avatar': USER_AVATAR_POLICY,
};

export function getImageAssetPolicy(profileId: AssetProfileId): ImageAssetPolicy {
  return IMAGE_POLICIES[profileId];
}

export function listImageAssetPolicies(): readonly ImageAssetPolicy[] {
  return [
    CHARACTER_PORTRAIT_POLICY,
    MAP_PIN_POLICY,
    LOOK_REFERENCE_POLICY,
    ITEM_THUMBNAIL_POLICY,
    USER_AVATAR_POLICY,
  ];
}

export function isMimeAllowedForProfile(
  profileId: AssetProfileId,
  mimeType: string,
): boolean {
  const policy = getImageAssetPolicy(profileId);
  const normalized = normalizeImageMime(mimeType);
  return policy.allowedMimeTypes.includes(normalized);
}

export function normalizeImageMime(mimeType: string): string {
  const t = mimeType.trim().toLowerCase();
  if (t === 'image/jpg' || t === 'image/pjpeg') return 'image/jpeg';
  return t;
}

export type MediaPolicyEvaluation =
  | { readonly ok: true; readonly policy: ImageAssetPolicy }
  | {
      readonly ok: false;
      readonly reason:
        | 'unsupported-mime'
        | 'over-max-upload'
        | 'gif-not-allowed'
        | 'animation-not-allowed'
        | 'too-many-images'
        | 'over-aggregate-budget';
      readonly message: string;
      readonly policy: ImageAssetPolicy;
    };

export function evaluateImageAgainstPolicy(
  input: MediaOptimizeInputMeta,
  options?: {
    readonly imageCountInRequest?: number;
    readonly aggregateRequestBytes?: number;
  },
): MediaPolicyEvaluation {
  const policy = getImageAssetPolicy(input.profileId);
  const mime = normalizeImageMime(input.mimeType);

  if (!policy.allowedMimeTypes.includes(mime)) {
    return {
      ok: false,
      reason: 'unsupported-mime',
      message: `MIME ${mime} ist für Profil ${policy.profileId} nicht erlaubt.`,
      policy,
    };
  }

  if (mime === 'image/gif' && policy.gifAnimation === 'reject') {
    return {
      ok: false,
      reason: 'gif-not-allowed',
      message: `GIF ist für Profil ${policy.profileId} nicht erlaubt.`,
      policy,
    };
  }

  if (input.hasAnimation === true && policy.gifAnimation === 'reject') {
    return {
      ok: false,
      reason: 'animation-not-allowed',
      message: `Animierte Bilder sind für Profil ${policy.profileId} nicht erlaubt.`,
      policy,
    };
  }

  const classed = classifyAgainstByteBudget(input.byteSize, policy.budget);
  if (classed === 'over-max-upload') {
    return {
      ok: false,
      reason: 'over-max-upload',
      message: `Datei ${input.byteSize} Bytes überschreitet maxUploadBytes ${policy.budget.maxUploadBytes}.`,
      policy,
    };
  }

  if (
    typeof policy.maxImagesPerRequest === 'number' &&
    typeof options?.imageCountInRequest === 'number' &&
    options.imageCountInRequest > policy.maxImagesPerRequest
  ) {
    return {
      ok: false,
      reason: 'too-many-images',
      message: `Zu viele Bilder (${options.imageCountInRequest}); Maximum ${policy.maxImagesPerRequest}.`,
      policy,
    };
  }

  if (
    typeof policy.maxAggregateRequestBytes === 'number' &&
    typeof options?.aggregateRequestBytes === 'number' &&
    options.aggregateRequestBytes > policy.maxAggregateRequestBytes
  ) {
    return {
      ok: false,
      reason: 'over-aggregate-budget',
      message: `Gesamtrequest ${options.aggregateRequestBytes} Bytes überschreitet ${policy.maxAggregateRequestBytes}.`,
      policy,
    };
  }

  return { ok: true, policy };
}

/** True when policy treats alpha as mandatory to preserve (no silent flatten). */
export function mustPreserveAlpha(policy: ImageAssetPolicy, hasAlpha: boolean): boolean {
  return policy.preserveAlpha && hasAlpha;
}
