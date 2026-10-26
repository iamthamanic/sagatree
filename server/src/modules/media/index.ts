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
  evaluateImageUpload,
  isAssetProfileId,
  isMediaKind,
  type MediaKind,
  type MediaOptimizeInputMeta,
} from './internal/upload-policy.ts';

export type { MediaKind, MediaOptimizeInputMeta, AssetProfileId } from './internal/upload-policy.ts';

export type MediaCapability =
  | { readonly kind: 'image'; readonly supported: true }
  | {
      readonly kind: Exclude<MediaKind, 'image'>;
      readonly supported: false;
      readonly status: 'unsupported';
      readonly message: string;
    };

export type MediaValidateResult =
  | { readonly ok: true; readonly kind: 'image' }
  | {
      readonly ok: false;
      readonly error:
        | 'INVALID_PAYLOAD'
        | 'UNSUPPORTED_KIND'
        | 'UNSUPPORTED_MIME'
        | 'OVER_MAX_UPLOAD'
        | 'GIF_NOT_ALLOWED'
        | 'ANIMATION_NOT_ALLOWED';
      readonly message: string;
    };

export type MediaPorts = {
  readonly moduleId: 'media';
  /** Explicit capability matrix — audio/video/model3d stay degraded locally. */
  readonly capability: (kind: MediaKind) => MediaCapability;
  /**
   * Evaluate upload/optimize metadata against host upload policy.
   * Client-claimed roles never appear here; callers pass verified Actor elsewhere.
   */
  readonly validateUpload: (input: MediaOptimizeInputMeta) => MediaValidateResult;
};

const DEGRADED: Record<Exclude<MediaKind, 'image'>, string> = {
  audio: 'Audio-Optimierung ist lokal noch nicht verfügbar (degraded/unsupported).',
  video: 'Video-Optimierung ist lokal noch nicht verfügbar (degraded/unsupported).',
  model3d: '3D-Modell-Optimierung ist lokal noch nicht verfügbar (degraded/unsupported).',
};

function mapPolicyFailure(
  reason: 'unsupported-mime' | 'over-max-upload' | 'gif-not-allowed' | 'animation-not-allowed',
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

    validateUpload(input) {
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
      if (!isAssetProfileId(input.profileId)) {
        return { ok: false, error: 'INVALID_PAYLOAD', message: 'Unbekanntes oder fehlendes Asset-Profil.' };
      }
      if (
        typeof input.byteSize !== 'number' ||
        !Number.isFinite(input.byteSize) ||
        input.byteSize <= 0
      ) {
        return {
          ok: false,
          error: 'INVALID_PAYLOAD',
          message: 'byteSize muss eine positive endliche Zahl sein.',
        };
      }
      const evaluation = evaluateImageUpload(input);
      if (!evaluation.ok) {
        return {
          ok: false,
          error: mapPolicyFailure(evaluation.reason),
          message: evaluation.message,
        };
      }
      return { ok: true, kind: 'image' };
    },
  };
}

/** MIG-408 quarantine surface — not a public host route. */
export {
  EXPORT_PDF_IS_VALIDATED_PIPELINE,
  EXPORT_PUBLIC_ACTIVATION_AUTHORIZED,
  buildExport,
  exportJson,
  exportMarkdown,
  exportPdf,
  parseImportContent,
} from './internal/export-quarantine.ts';

/** MIG-416 Edge media Map quarantine — not a public host route. */
export {
  MEDIA_EDGE_MAP_IS_DURABLE_STORAGE,
  MEDIA_EDGE_PUBLIC_ACTIVATION_AUTHORIZED,
  createMediaEdgeStore,
  deleteMedia,
  getMedia,
  getMimeType,
  listMedia,
  updateMediaTags,
  uploadMedia,
  type MediaEdgeStore,
  type QuarantineMedia,
} from './internal/media-edge-quarantine.ts';
