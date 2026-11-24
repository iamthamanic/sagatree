/**
 * Media optimizer contracts — pure MediaKind / budget / result types (#625).
 * Location: src/domains/media/optimization-contract.ts
 *
 * No React, no backend clients, no Browser APIs. Infrastructure engines and app intake
 * consume these contracts; client claims never replace server MIME/RLS checks.
 */

/** Top-level media class routed by the optimizer facade. */
export type MediaKind = 'image' | 'video' | 'model3d' | 'audio';

export const MEDIA_KINDS = ['image', 'video', 'model3d', 'audio'] as const satisfies readonly MediaKind[];

/**
 * Outcome of a prepare/optimize attempt.
 * `unchanged` is only valid when the original payload itself satisfies policy.
 */
export type MediaOptimizeStatus =
  | 'optimized'
  | 'unchanged'
  | 'unsupported'
  | 'over-budget'
  | 'aborted'
  | 'failed';

export const MEDIA_OPTIMIZE_STATUSES = [
  'optimized',
  'unchanged',
  'unsupported',
  'over-budget',
  'aborted',
  'failed',
] as const satisfies readonly MediaOptimizeStatus[];

/** Product asset surfaces that bind to concrete policies. */
export type AssetProfileId =
  | 'character-portrait'
  | 'map-pin'
  | 'look-reference'
  | 'item-thumbnail'
  | 'user-avatar';

export const ASSET_PROFILE_IDS = [
  'character-portrait',
  'map-pin',
  'look-reference',
  'item-thumbnail',
  'user-avatar',
] as const satisfies readonly AssetProfileId[];

/**
 * Size budget: `targetBytes` is the desired encoded size;
 * `maxUploadBytes` is the hard reject ceiling (never confuse the two).
 */
export type MediaByteBudget = {
  readonly targetBytes: number;
  readonly maxUploadBytes: number;
};

export type MediaOptimizeFailureCode =
  | 'unsupported-kind'
  | 'unsupported-mime'
  | 'over-max-upload'
  | 'over-aggregate-budget'
  | 'encode-failed'
  | 'aborted'
  | 'invalid-input'
  | 'wasm-unavailable';

export type MediaOptimizeInputMeta = {
  readonly kind: MediaKind;
  readonly profileId: AssetProfileId;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly width?: number;
  readonly height?: number;
  /** True when source is an animated GIF (or similar) that must not be silently flattened. */
  readonly hasAnimation?: boolean;
  /** True when source has an alpha channel that policy must preserve. */
  readonly hasAlpha?: boolean;
};

type MediaOptimizeResultBase = {
  readonly kind: MediaKind;
  readonly profileId: AssetProfileId;
  readonly input: MediaOptimizeInputMeta;
};

export type MediaOptimizeOptimizedResult = MediaOptimizeResultBase & {
  readonly status: 'optimized';
  readonly outputMimeType: string;
  readonly outputByteSize: number;
  readonly width?: number;
  readonly height?: number;
};

export type MediaOptimizeUnchangedResult = MediaOptimizeResultBase & {
  readonly status: 'unchanged';
  /** Echo of the validated original — required for unchanged. */
  readonly outputMimeType: string;
  readonly outputByteSize: number;
};

export type MediaOptimizeUnsupportedResult = MediaOptimizeResultBase & {
  readonly status: 'unsupported';
  readonly code: MediaOptimizeFailureCode;
  readonly message: string;
};

export type MediaOptimizeOverBudgetResult = MediaOptimizeResultBase & {
  readonly status: 'over-budget';
  readonly code: 'over-max-upload' | 'over-aggregate-budget';
  readonly message: string;
  readonly attemptedByteSize?: number;
};

export type MediaOptimizeAbortedResult = MediaOptimizeResultBase & {
  readonly status: 'aborted';
  readonly code: 'aborted';
  readonly message: string;
};

export type MediaOptimizeFailedResult = MediaOptimizeResultBase & {
  readonly status: 'failed';
  readonly code: MediaOptimizeFailureCode;
  readonly message: string;
};

export type MediaOptimizeResult =
  | MediaOptimizeOptimizedResult
  | MediaOptimizeUnchangedResult
  | MediaOptimizeUnsupportedResult
  | MediaOptimizeOverBudgetResult
  | MediaOptimizeAbortedResult
  | MediaOptimizeFailedResult;

export function isMediaKind(value: string): value is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(value);
}

export function isMediaOptimizeStatus(value: string): value is MediaOptimizeStatus {
  return (MEDIA_OPTIMIZE_STATUSES as readonly string[]).includes(value);
}

export function isAssetProfileId(value: string): value is AssetProfileId {
  return (ASSET_PROFILE_IDS as readonly string[]).includes(value);
}

/**
 * Structural invariants for optimize results.
 * Failed required optimization must never silently surface as success with an original.
 */
export function assertMediaOptimizeResultInvariants(
  result: MediaOptimizeResult,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (!isMediaKind(result.kind)) {
    return { ok: false, reason: 'invalid-kind' };
  }
  if (!isAssetProfileId(result.profileId)) {
    return { ok: false, reason: 'invalid-profile' };
  }
  if (result.kind !== result.input.kind) {
    return { ok: false, reason: 'kind-mismatch' };
  }
  if (result.profileId !== result.input.profileId) {
    return { ok: false, reason: 'profile-mismatch' };
  }

  switch (result.status) {
    case 'optimized': {
      if (result.outputByteSize <= 0) {
        return { ok: false, reason: 'optimized-empty-output' };
      }
      if (!result.outputMimeType.trim()) {
        return { ok: false, reason: 'optimized-missing-mime' };
      }
      return { ok: true };
    }
    case 'unchanged': {
      if (result.outputByteSize !== result.input.byteSize) {
        return { ok: false, reason: 'unchanged-size-mismatch' };
      }
      if (result.outputMimeType !== result.input.mimeType) {
        return { ok: false, reason: 'unchanged-mime-mismatch' };
      }
      if (result.input.byteSize <= 0) {
        return { ok: false, reason: 'unchanged-invalid-original' };
      }
      return { ok: true };
    }
    case 'unsupported':
    case 'failed': {
      if (!result.message.trim()) {
        return { ok: false, reason: 'error-missing-message' };
      }
      return { ok: true };
    }
    case 'over-budget': {
      if (result.code !== 'over-max-upload' && result.code !== 'over-aggregate-budget') {
        return { ok: false, reason: 'over-budget-bad-code' };
      }
      if (!result.message.trim()) {
        return { ok: false, reason: 'error-missing-message' };
      }
      return { ok: true };
    }
    case 'aborted': {
      if (result.code !== 'aborted') {
        return { ok: false, reason: 'aborted-bad-code' };
      }
      return { ok: true };
    }
    default: {
      const _exhaustive: never = result;
      return { ok: false, reason: `unknown-status:${String(_exhaustive)}` };
    }
  }
}

export function classifyAgainstByteBudget(
  byteSize: number,
  budget: MediaByteBudget,
): 'within-target' | 'over-target' | 'over-max-upload' {
  if (byteSize > budget.maxUploadBytes) return 'over-max-upload';
  if (byteSize > budget.targetBytes) return 'over-target';
  return 'within-target';
}
