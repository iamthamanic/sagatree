/**
 * Media module public API — host-side policy ports for browser optimizer contracts (MIG-306).
 * Location: server/src/modules/media/index.ts
 *
 * Source inventory (`infra-media`) has zero RPC/table/storage/realtime calls: optimization
 * stays in the browser engines under `src/infrastructure/media`. This module does not invent
 * a remote codec service; it exposes authoritative profile/MIME/budget evaluation so host
 * upload paths can DENY before bytes are stored (MIG-500 assets remain the byte store).
 */
import {
  evaluateImageAgainstPolicy,
  isMediaKind,
  type AssetProfileId,
  type MediaKind,
  type MediaOptimizeInputMeta,
  type MediaPolicyEvaluation,
} from '../../../../src/domains/media/index.ts';

export type MediaCapability =
  | { readonly kind: 'image'; readonly supported: true }
  | {
      readonly kind: Exclude<MediaKind, 'image'>;
      readonly supported: false;
      readonly status: 'unsupported';
      readonly message: string;
    };

export type MediaValidateResult =
  | { readonly ok: true; readonly kind: 'image'; readonly evaluation: Extract<MediaPolicyEvaluation, { ok: true }> }
  | {
      readonly ok: false;
      readonly error:
        | 'INVALID_PAYLOAD'
        | 'UNSUPPORTED_KIND'
        | 'UNSUPPORTED_MIME'
        | 'OVER_MAX_UPLOAD'
        | 'GIF_NOT_ALLOWED'
        | 'ANIMATION_NOT_ALLOWED'
        | 'TOO_MANY_IMAGES'
        | 'OVER_AGGREGATE_BUDGET';
      readonly message: string;
    };

export type MediaPorts = {
  readonly moduleId: 'media';
  /** Explicit capability matrix — audio/video/model3d stay degraded locally. */
  readonly capability: (kind: MediaKind) => MediaCapability;
  /**
   * Evaluate upload/optimize metadata against domain asset policies.
   * Client-claimed roles never appear here; callers pass verified Actor elsewhere.
   */
  readonly validateUpload: (
    input: MediaOptimizeInputMeta,
    options?: {
      readonly imageCountInRequest?: number;
      readonly aggregateRequestBytes?: number;
    },
  ) => MediaValidateResult;
};

const DEGRADED: Record<Exclude<MediaKind, 'image'>, string> = {
  audio: 'Audio-Optimierung ist lokal noch nicht verfügbar (degraded/unsupported).',
  video: 'Video-Optimierung ist lokal noch nicht verfügbar (degraded/unsupported).',
  model3d: '3D-Modell-Optimierung ist lokal noch nicht verfügbar (degraded/unsupported).',
};

function mapPolicyFailure(
  reason: Extract<MediaPolicyEvaluation, { ok: false }>['reason'],
): MediaValidateResult['error'] {
  switch (reason) {
    case 'unsupported-mime':
      return 'UNSUPPORTED_MIME';
    case 'over-max-upload':
      return 'OVER_MAX_UPLOAD';
    case 'gif-not-allowed':
      return 'GIF_NOT_ALLOWED';
    case 'animation-not-allowed':
      return 'ANIMATION_NOT_ALLOWED';
    case 'too-many-images':
      return 'TOO_MANY_IMAGES';
    case 'over-aggregate-budget':
      return 'OVER_AGGREGATE_BUDGET';
    default:
      return 'INVALID_PAYLOAD';
  }
}

export function createMediaPorts(): MediaPorts {
  return {
    moduleId: 'media',

    capability(kind) {
      if (!isMediaKind(kind)) {
        return {
          kind: 'audio',
          supported: false,
          status: 'unsupported',
          message: 'Unbekannte Media-Art.',
        };
      }
      if (kind === 'image') return { kind: 'image', supported: true };
      return {
        kind,
        supported: false,
        status: 'unsupported',
        message: DEGRADED[kind],
      };
    },

    validateUpload(input, options) {
      if (!input || typeof input !== 'object') {
        return { ok: false, error: 'INVALID_PAYLOAD', message: 'Media-Metadaten fehlen.' };
      }
      if (!isMediaKind(input.kind)) {
        return { ok: false, error: 'INVALID_PAYLOAD', message: 'Ungültige Media-Art.' };
      }
      if (input.kind !== 'image') {
        const cap = this.capability(input.kind);
        return {
          ok: false,
          error: 'UNSUPPORTED_KIND',
          message: cap.supported ? 'UNSUPPORTED_KIND' : cap.message,
        };
      }
      const profileId = input.profileId as AssetProfileId;
      if (typeof profileId !== 'string' || profileId.length === 0) {
        return { ok: false, error: 'INVALID_PAYLOAD', message: 'Profil fehlt.' };
      }
      const evaluation = evaluateImageAgainstPolicy(input, options);
      if (!evaluation.ok) {
        return {
          ok: false,
          error: mapPolicyFailure(evaluation.reason),
          message: evaluation.message,
        };
      }
      return { ok: true, kind: 'image', evaluation };
    },
  };
}
