/**
 * Host upload policy — Node-safe mirror of src/domains/media optimization policy (MIG-306).
 * Location: server/src/modules/media/internal/upload-policy.ts
 *
 * Kept local so the host can validate without importing Vite-bundler extensionless
 * domain barrels. Values must stay aligned with src/domains/media/optimization-policy.ts.
 */
export type AssetProfileId =
  | 'character-portrait'
  | 'map-pin'
  | 'look-reference'
  | 'item-thumbnail'
  | 'user-avatar';

export type MediaKind = 'image' | 'video' | 'model3d' | 'audio';

export type MediaOptimizeInputMeta = {
  readonly kind: MediaKind;
  readonly profileId: AssetProfileId;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly width?: number;
  readonly height?: number;
  readonly hasAnimation?: boolean;
  readonly hasAlpha?: boolean;
};

const PROFILE_IDS = new Set<AssetProfileId>([
  'character-portrait',
  'map-pin',
  'look-reference',
  'item-thumbnail',
  'user-avatar',
]);

const MEDIA_KINDS = new Set<MediaKind>(['image', 'video', 'model3d', 'audio']);

const MiB = 1024 * 1024;

type ImagePolicy = {
  readonly profileId: AssetProfileId;
  readonly allowedMimeTypes: readonly string[];
  readonly maxUploadBytes: number;
  readonly gifAnimation: 'allow' | 'convert-static-required' | 'reject';
};

const POLICIES: Record<AssetProfileId, ImagePolicy> = {
  'character-portrait': {
    profileId: 'character-portrait',
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    maxUploadBytes: 5 * MiB,
    gifAnimation: 'convert-static-required',
  },
  'map-pin': {
    profileId: 'map-pin',
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxUploadBytes: 5 * MiB,
    gifAnimation: 'reject',
  },
  'look-reference': {
    profileId: 'look-reference',
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxUploadBytes: 8 * MiB,
    gifAnimation: 'reject',
  },
  'item-thumbnail': {
    profileId: 'item-thumbnail',
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxUploadBytes: 10 * MiB,
    gifAnimation: 'reject',
  },
  'user-avatar': {
    profileId: 'user-avatar',
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxUploadBytes: 5 * MiB,
    gifAnimation: 'reject',
  },
};

export function isAssetProfileId(value: unknown): value is AssetProfileId {
  return typeof value === 'string' && PROFILE_IDS.has(value as AssetProfileId);
}

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === 'string' && MEDIA_KINDS.has(value as MediaKind);
}

function normalizeImageMime(mimeType: string): string {
  const t = mimeType.trim().toLowerCase();
  if (t === 'image/jpg' || t === 'image/pjpeg') return 'image/jpeg';
  return t;
}

export type HostPolicyEvaluation =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | 'unsupported-mime'
        | 'over-max-upload'
        | 'gif-not-allowed'
        | 'animation-not-allowed';
      readonly message: string;
    };

export function evaluateImageUpload(input: MediaOptimizeInputMeta): HostPolicyEvaluation {
  const policy = POLICIES[input.profileId];
  const mime = normalizeImageMime(input.mimeType);

  if (!policy.allowedMimeTypes.includes(mime)) {
    return {
      ok: false,
      reason: 'unsupported-mime',
      message: `MIME ${mime} ist für Profil ${policy.profileId} nicht erlaubt.`,
    };
  }
  if (mime === 'image/gif' && policy.gifAnimation === 'reject') {
    return {
      ok: false,
      reason: 'gif-not-allowed',
      message: `GIF ist für Profil ${policy.profileId} nicht erlaubt.`,
    };
  }
  if (input.hasAnimation === true && policy.gifAnimation === 'reject') {
    return {
      ok: false,
      reason: 'animation-not-allowed',
      message: `Animierte Bilder sind für Profil ${policy.profileId} nicht erlaubt.`,
    };
  }
  if (input.byteSize > policy.maxUploadBytes) {
    return {
      ok: false,
      reason: 'over-max-upload',
      message: `Datei ${input.byteSize} Bytes überschreitet maxUploadBytes ${policy.maxUploadBytes}.`,
    };
  }
  return { ok: true };
}
