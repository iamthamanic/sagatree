/**
 * look-reference-analysis — Server-side vision call for Basic Look adaption (#352).
 * Location: supabase/functions/look-reference-analysis/index.ts
 *
 * Returns a raw structured payload for client-side domain normalization.
 * Secrets stay server-side; provider types never enter LookProfile persistence.
 *
 * Response shapes:
 * - { status: 'ok', payload: Record<string, unknown>, analyzedAtIso: string }
 * - { status: 'not-configured', message: string }
 * - { status: 'error', message: string }
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  assertOwnerScopedStoragePath,
  bytesToBase64,
  decodeLookRefBase64Image,
  isAllowedLookRefAnalysisMime,
  validateLookRefImageBytes,
} from '../_shared/look-reference-analysis-image.ts';
import {
  analyzeLookReferencesWithVision,
  resolveLookRefVisionProviderConfig,
  type LookRefVisionImagePart,
} from '../_shared/look-reference-analysis-provider.ts';
import { consumeLookReferenceAnalysisRateLimit } from '../_shared/look-reference-analysis-rate-limit.ts';
import {
  handleOptions,
  jsonResponse as sharedJsonResponse,
  type CorsOptions,
} from '../_shared/cors.ts';
import { privilegedClientBodyRejectionMessage } from '../_shared/client-trust-body.ts';

type JsonRecord = Record<string, unknown>;

const CORS_OPTS: CorsOptions = {
  methods: 'POST, OPTIONS',
  envKeys: ['LOOK_AI_ALLOWED_ORIGIN', 'CHARACTER_AI_ALLOWED_ORIGIN'],
};

const MAX_REQUEST_BYTES = 12 * 1024 * 1024;
const MIN_IMAGES = 1;
const MAX_IMAGES = 10;
const DEFAULT_RATE_LIMIT = 4;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const LOOK_MEDIA_BUCKET =
  Deno.env.get('LOOK_REFERENCE_STORAGE_BUCKET')?.trim() || 'media';

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function jsonResponse(request: Request, body: JsonRecord, status = 200): Response {
  return sharedJsonResponse(request, body, status, CORS_OPTS);
}

function getRateLimit(): number {
  const configured = Number.parseInt(
    Deno.env.get('LOOK_AI_RATE_LIMIT_PER_MINUTE') || '',
    10,
  );
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 30)
    : DEFAULT_RATE_LIMIT;
}

function getSupabaseConfig(): {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
} | null {
  const url = Deno.env.get('SUPABASE_URL')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  return url && anonKey
    ? {
        url: url.replace(/\/+$/, ''),
        anonKey,
        serviceRoleKey: serviceRoleKey || undefined,
      }
    : null;
}

async function authenticate(request: Request): Promise<string | null> {
  const config = getSupabaseConfig();
  const authorization = request.headers.get('Authorization');
  if (!config || !authorization?.startsWith('Bearer ')) return null;

  const response = await fetch(`${config.url}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: config.anonKey,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;

  const body: unknown = await response.json();
  return isRecord(body) && typeof body.id === 'string' ? body.id : null;
}

async function fetchOwnerStorageBytes(
  storagePath: string,
  ownerUserId: string,
): Promise<Uint8Array> {
  const config = getSupabaseConfig();
  if (!config?.serviceRoleKey) {
    throw new Error('Storage lookup is not configured');
  }
  const path = assertOwnerScopedStoragePath(storagePath, ownerUserId);
  const url =
    `${config.url}/storage/v1/object/${encodeURIComponent(LOOK_MEDIA_BUCKET)}/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Storage fetch failed with ${response.status}`);
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  if (buffer.byteLength > 8 * 1024 * 1024) {
    throw new Error('Stored image exceeds size limit');
  }
  return buffer;
}

type ParsedRef = {
  id: string;
  kind: 'style' | 'content';
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  weight?: number;
  label?: string;
  uri: string;
  contentBase64?: string;
  storagePath?: string;
};

function parseReferences(value: unknown): ParsedRef[] {
  if (!Array.isArray(value)) throw new Error('references must be an array');
  if (value.length < MIN_IMAGES || value.length > MAX_IMAGES) {
    throw new Error('references must contain 1 to 10 images');
  }
  const out: ParsedRef[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) throw new Error('invalid reference entry');
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const kind = entry.kind;
    const mime = typeof entry.mime === 'string' ? entry.mime.trim() : '';
    const uri = typeof entry.uri === 'string' ? entry.uri.trim() : '';
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
    if (entry.weight !== undefined) {
      if (typeof entry.weight !== 'number' || entry.weight < 0 || entry.weight > 1) {
        throw new Error('reference weight must be between 0 and 1');
      }
      weight = entry.weight;
    }
    const contentBase64 =
      typeof entry.contentBase64 === 'string' ? entry.contentBase64 : undefined;
    const storagePath =
      typeof entry.storagePath === 'string' ? entry.storagePath.trim() : undefined;
    if (!contentBase64 && !storagePath) {
      throw new Error('reference needs contentBase64 or storagePath');
    }
    out.push({
      id,
      kind,
      mime,
      weight,
      label: typeof entry.label === 'string' ? entry.label.slice(0, 80) : undefined,
      uri,
      contentBase64,
      storagePath,
    });
  }
  return out;
}

serve(async (request) => {
  const optionsResponse = handleOptions(request, CORS_OPTS);
  if (optionsResponse) return optionsResponse;
  if (request.method !== 'POST') {
    return jsonResponse(request, { status: 'error', message: 'Method not allowed' }, 405);
  }

  try {
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse(
        request,
        { status: 'error', message: 'Request too large' },
        413,
      );
    }

    const userId = await authenticate(request);
    if (!userId) {
      return jsonResponse(
        request,
        { status: 'error', message: 'Nicht angemeldet.' },
        401,
      );
    }

    const rate = consumeLookReferenceAnalysisRateLimit({
      userId,
      limit: getRateLimit(),
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (rate.ok === false) {
      return jsonResponse(
        request,
        {
          status: 'error',
          message: `Zu viele Anfragen. Bitte in ${rate.retryAfterSeconds}s erneut versuchen.`,
        },
        429,
      );
    }

    const provider = resolveLookRefVisionProviderConfig();
    if (!provider) {
      return jsonResponse(request, {
        status: 'not-configured',
        message: 'Look-Analyse ist serverseitig nicht konfiguriert.',
      });
    }

    const body: unknown = await request.json();
    const privilegedReject = privilegedClientBodyRejectionMessage(body);
    if (privilegedReject) {
      return jsonResponse(request, { status: 'error', message: privilegedReject }, 400);
    }
    if (!isRecord(body) || body.action !== 'analyze') {
      return jsonResponse(
        request,
        { status: 'error', message: 'Ungültige Anfrage.' },
        400,
      );
    }

    const displayNameHint =
      typeof body.displayNameHint === 'string'
        ? body.displayNameHint.trim().slice(0, 80)
        : undefined;

    let parsedRefs: ParsedRef[];
    try {
      parsedRefs = parseReferences(body.references);
    } catch (parseError) {
      const message =
        parseError instanceof Error ? parseError.message : 'Invalid references';
      return jsonResponse(request, { status: 'error', message }, 400);
    }

    const visionImages: LookRefVisionImagePart[] = [];
    for (const ref of parsedRefs) {
      let bytes: Uint8Array;
      try {
        if (ref.contentBase64) {
          bytes = decodeLookRefBase64Image(ref.contentBase64);
        } else if (ref.storagePath) {
          bytes = await fetchOwnerStorageBytes(ref.storagePath, userId);
        } else {
          throw new Error('Missing image bytes');
        }
        const validated = validateLookRefImageBytes(bytes, ref.mime);
        visionImages.push({
          id: ref.id,
          kind: ref.kind,
          mime: validated.mime,
          base64: bytesToBase64(validated.bytes),
          weight: ref.weight,
        });
      } catch (imageError) {
        console.error('[look-reference-analysis] image error', ref.id, imageError);
        return jsonResponse(
          request,
          {
            status: 'error',
            message: `Referenz ${ref.id} konnte nicht gelesen werden.`,
          },
          400,
        );
      }
    }

    const payload = await analyzeLookReferencesWithVision(
      provider,
      visionImages,
      displayNameHint,
    );
    const analyzedAtIso = new Date().toISOString();

    // Strip accidental secret-like keys before leaving the edge.
    const safePayload: JsonRecord = { ...payload };
    delete safePayload.apiKey;
    delete safePayload.authorization;
    delete safePayload.providerSecret;

    return jsonResponse(request, {
      status: 'ok',
      payload: safePayload,
      analyzedAtIso,
    });
  } catch (error) {
    console.error('[look-reference-analysis] failed', error);
    return jsonResponse(
      request,
      {
        status: 'error',
        message: 'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
      },
      500,
    );
  }
});
