/**
 * look-reference-analysis use-case (MIG-412 / #828) — isolated-contract.
 * Location: server/src/application/look-reference-analysis/index.ts
 *
 * HTTP mount deferred (MIG-600). publicActivationAuthorized=false.
 * Legacy: Content-Length envelope trust; top-level secret strip only.
 */
import {
  LOOK_REF_ANALYSIS_MAX_BYTES,
  assertOwnerScopedStoragePath,
  decodeLookRefBase64Image,
  isAllowedLookRefAnalysisMime,
  validateLookRefImageBytes,
  type LookRefAnalysisMime,
} from '../../modules/look/index.ts';
import type { createLookReferenceRateLimitStore } from '../../modules/look/index.ts';

export const LOOK_REF_MAX_REQUEST_BYTES = 12 * 1024 * 1024;
export const LOOK_REF_MIN_IMAGES = 1;
export const LOOK_REF_MAX_IMAGES = 10;
export const LOOK_REF_DEFAULT_RATE_LIMIT = 4;
export const LOOK_REF_RATE_WINDOW_SECONDS = 60;

/** Legacy defect: envelope trusts Content-Length only (not actual body size). */
export function checkContentLengthEnvelope(
  contentLengthHeader: string | null,
): { ok: true } | { ok: false; status: 413; message: string } {
  const contentLength = Number(contentLengthHeader || '0');
  if (Number.isFinite(contentLength) && contentLength > LOOK_REF_MAX_REQUEST_BYTES) {
    return { ok: false, status: 413, message: 'Request too large' };
  }
  return { ok: true };
}

export type LookRefInput = {
  readonly id: string;
  readonly kind: 'style' | 'content';
  readonly mime: LookRefAnalysisMime;
  readonly uri: string;
  readonly weight?: number;
  readonly label?: string;
  readonly contentBase64?: string;
  readonly storagePath?: string;
};

export function parseLookReferences(value: unknown): LookRefInput[] {
  if (!Array.isArray(value)) throw new Error('references must be an array');
  if (value.length < LOOK_REF_MIN_IMAGES || value.length > LOOK_REF_MAX_IMAGES) {
    throw new Error('references must contain 1 to 10 images');
  }
  const out: LookRefInput[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) throw new Error('invalid reference entry');
    const rec = entry as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id.trim() : '';
    const kind = rec.kind;
    const mime = typeof rec.mime === 'string' ? rec.mime.trim() : '';
    const uri = typeof rec.uri === 'string' ? rec.uri.trim() : '';
    if (!id || ids.has(id)) throw new Error('reference id invalid or duplicate');
    ids.add(id);
    if (kind !== 'style' && kind !== 'content') {
      throw new Error('reference kind must be style or content');
    }
    if (!isAllowedLookRefAnalysisMime(mime)) {
      throw new Error('reference mime must be png, jpeg, or webp');
    }
    if (!uri) throw new Error('reference uri is required');
    let weight: number | undefined;
    if (rec.weight !== undefined) {
      if (typeof rec.weight !== 'number' || rec.weight < 0 || rec.weight > 1) {
        throw new Error('reference weight must be between 0 and 1');
      }
      weight = rec.weight;
    }
    const contentBase64 = typeof rec.contentBase64 === 'string' ? rec.contentBase64 : undefined;
    const storagePath =
      typeof rec.storagePath === 'string' ? rec.storagePath.trim() : undefined;
    if (!contentBase64 && !storagePath) {
      throw new Error('reference needs contentBase64 or storagePath');
    }
    out.push({
      id,
      kind,
      mime,
      weight,
      label: typeof rec.label === 'string' ? rec.label.slice(0, 80) : undefined,
      uri,
      contentBase64,
      storagePath,
    });
  }
  return out;
}

/** Top-level only — nested secret-like keys are NOT recursively removed (legacy defect). */
export function stripTopLevelSecrets(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const safe = { ...payload };
  delete safe.apiKey;
  delete safe.authorization;
  delete safe.providerSecret;
  return safe;
}

export type AnalyzeDeps = {
  readonly rateLimit: ReturnType<typeof createLookReferenceRateLimitStore>;
  readonly rateLimitPerMinute?: number;
  readonly fetchStorageBytes?: (
    storagePath: string,
    ownerUserId: string,
  ) => Promise<Uint8Array>;
  readonly analyzeVision?: (
    images: ReadonlyArray<{
      id: string;
      kind: 'style' | 'content';
      mime: LookRefAnalysisMime;
      base64: string;
      weight?: number;
    }>,
    displayNameHint?: string,
  ) => Promise<Record<string, unknown>>;
  readonly providerConfigured: boolean;
  readonly nowIso?: () => string;
};

export type AnalyzeResult =
  | { readonly status: 'ok'; readonly payload: Record<string, unknown>; readonly analyzedAtIso: string }
  | { readonly status: 'not-configured'; readonly message: string }
  | { readonly status: 'error'; readonly message: string; readonly httpStatus: number };

export function createLookReferenceAnalysisUseCase(deps: AnalyzeDeps) {
  return {
    async analyze(input: {
      readonly actorId: string;
      readonly contentLengthHeader: string | null;
      readonly body: unknown;
    }): Promise<AnalyzeResult> {
      const envelope = checkContentLengthEnvelope(input.contentLengthHeader);
      if (!envelope.ok) {
        return { status: 'error', message: envelope.message, httpStatus: 413 };
      }

      const configured = deps.rateLimitPerMinute;
      const limit =
        typeof configured === 'number' && Number.isFinite(configured) && configured > 0
          ? Math.min(configured, 30)
          : LOOK_REF_DEFAULT_RATE_LIMIT;
      const rate = deps.rateLimit.consume({
        userId: input.actorId,
        limit,
        windowSeconds: LOOK_REF_RATE_WINDOW_SECONDS,
      });
      if (rate.ok === false) {
        return {
          status: 'error',
          message: `Zu viele Anfragen. Bitte in ${rate.retryAfterSeconds}s erneut versuchen.`,
          httpStatus: 429,
        };
      }

      if (!deps.providerConfigured) {
        return {
          status: 'not-configured',
          message: 'Look-Analyse ist serverseitig nicht konfiguriert.',
        };
      }

      if (
        typeof input.body !== 'object' ||
        input.body === null ||
        (input.body as Record<string, unknown>).action !== 'analyze'
      ) {
        return { status: 'error', message: 'Ungültige Anfrage.', httpStatus: 400 };
      }

      const body = input.body as Record<string, unknown>;
      const displayNameHint =
        typeof body.displayNameHint === 'string'
          ? body.displayNameHint.trim().slice(0, 80)
          : undefined;

      let parsed: LookRefInput[];
      try {
        parsed = parseLookReferences(body.references);
      } catch (e) {
        return {
          status: 'error',
          message: e instanceof Error ? e.message : 'Invalid references',
          httpStatus: 400,
        };
      }

      const visionImages: Array<{
        id: string;
        kind: 'style' | 'content';
        mime: LookRefAnalysisMime;
        base64: string;
        weight?: number;
      }> = [];

      for (const ref of parsed) {
        try {
          let bytes: Uint8Array;
          if (ref.contentBase64) {
            bytes = decodeLookRefBase64Image(ref.contentBase64);
          } else if (ref.storagePath) {
            const path = assertOwnerScopedStoragePath(ref.storagePath, input.actorId);
            if (!deps.fetchStorageBytes) throw new Error('Storage lookup is not configured');
            bytes = await deps.fetchStorageBytes(path, input.actorId);
            if (bytes.byteLength > LOOK_REF_ANALYSIS_MAX_BYTES) {
              throw new Error('Stored image exceeds size limit');
            }
          } else {
            throw new Error('Missing image bytes');
          }
          const validated = validateLookRefImageBytes(bytes, ref.mime);
          visionImages.push({
            id: ref.id,
            kind: ref.kind,
            mime: validated.mime,
            base64: Buffer.from(validated.bytes).toString('base64'),
            weight: ref.weight,
          });
        } catch {
          return {
            status: 'error',
            message: `Referenz ${ref.id} konnte nicht gelesen werden.`,
            httpStatus: 400,
          };
        }
      }

      if (!deps.analyzeVision) {
        return {
          status: 'error',
          message: 'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
          httpStatus: 500,
        };
      }

      let payload: Record<string, unknown>;
      try {
        payload = await deps.analyzeVision(visionImages, displayNameHint);
      } catch {
        return {
          status: 'error',
          message: 'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
          httpStatus: 500,
        };
      }
      const safePayload = stripTopLevelSecrets(payload);
      return {
        status: 'ok',
        payload: safePayload,
        analyzedAtIso: deps.nowIso?.() ?? new Date().toISOString(),
      };
    },
  };
}
