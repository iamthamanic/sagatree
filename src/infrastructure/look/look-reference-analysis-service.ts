/**
 * look-reference-analysis-service — Look reference analysis facade (#352 / CUT-15).
 * Location: src/infrastructure/look/look-reference-analysis-service.ts
 *
 * CUT-15/CUT-21: host-only via POST `/api/v1/ai/look-reference-analysis`.
 */
import {
  normalizeLookReferenceAnalysisPayload,
  type LookReferenceAnalysisImageInput,
  type LookReferenceAnalysisOutcome,
  type LookReferenceAnalyzer,
} from '../../domains/look';
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';

export type LookReferenceAnalysisRequestImage = LookReferenceAnalysisImageInput & {
  /** Inline image for vision call. */
  readonly contentBase64?: string;
  /** Owner-scoped storage path alternative to contentBase64. */
  readonly storagePath?: string;
};

export type LookReferenceAnalysisRequest = {
  readonly references: readonly LookReferenceAnalysisRequestImage[];
  readonly displayNameHint?: string;
};

type EdgeOk = {
  status: 'ok';
  payload: Record<string, unknown>;
  analyzedAtIso: string;
};

type EdgeFail = {
  status: 'not-configured' | 'error';
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseEdgeResponse(value: unknown): EdgeOk | EdgeFail {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return {
      status: 'error',
      message: 'Die Analyse-Antwort hatte ein ungültiges Format.',
    };
  }
  if (
    value.status === 'ok' &&
    isRecord(value.payload) &&
    typeof value.analyzedAtIso === 'string'
  ) {
    return {
      status: 'ok',
      payload: value.payload,
      analyzedAtIso: value.analyzedAtIso,
    };
  }
  if (
    (value.status === 'not-configured' || value.status === 'error') &&
    typeof value.message === 'string'
  ) {
    return { status: value.status, message: value.message };
  }
  return {
    status: 'error',
    message: 'Die Analyse-Antwort hatte ein ungültiges Format.',
  };
}

function hasResponseContext(error: unknown): error is { context: Response } {
  return isRecord(error) && error.context instanceof Response;
}

async function getFunctionErrorMessage(error: unknown): Promise<string | undefined> {
  if (!hasResponseContext(error)) return undefined;
  try {
    const responseBody: unknown = await error.context.clone().json();
    const parsed = parseEdgeResponse(responseBody);
    return parsed.status === 'ok' ? undefined : parsed.message;
  } catch {
    return undefined;
  }
}

/** Matches look-reference domain aggregate budget (#639). */
const LOOK_REFERENCE_AGGREGATE_MAX_BYTES = 12 * 1024 * 1024;

function estimateBase64Bytes(b64: string | undefined): number {
  if (!b64) return 0;
  return Math.ceil((b64.length * 3) / 4);
}

function buildRequestBody(request: LookReferenceAnalysisRequest): Record<string, unknown> {
  return {
    action: 'analyze',
    displayNameHint: request.displayNameHint,
    references: request.references.map((ref) => ({
      id: ref.id,
      kind: ref.kind,
      mime: ref.mime,
      uri: ref.uri,
      weight: ref.weight,
      label: ref.label,
      contentBase64: ref.contentBase64,
      storagePath: ref.storagePath,
    })),
  };
}

async function invokeHostLookReferenceAnalysis(
  body: Record<string, unknown>,
): Promise<EdgeOk | EdgeFail> {
  const base = getHostAuthBaseUrl();
  if (base === null) {
    return {
      status: 'error',
      message: 'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
    };
  }
  const requestUrl =
    base === ''
      ? '/api/v1/ai/look-reference-analysis'
      : `${base}/api/v1/ai/look-reference-analysis`;
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      status: 'error',
      message: 'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
    };
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return {
      status: 'error',
      message: 'Look-Referenzanalyse fehlgeschlagen. Bitte erneut versuchen.',
    };
  }
  return parseEdgeResponse(data);
}

/**
 * Analyze references via host (CUT-15) or Edge + domain normalize.
 * Callers should optimize with look-reference profile before Base64 (#639).
 * Does not persist — callers must save only when outcome.ok.
 */
export async function analyzeLookReferences(
  request: LookReferenceAnalysisRequest,
): Promise<LookReferenceAnalysisOutcome> {
  const aggregateBytes = request.references.reduce(
    (sum, ref) => sum + estimateBase64Bytes(ref.contentBase64),
    0,
  );
  if (aggregateBytes > LOOK_REFERENCE_AGGREGATE_MAX_BYTES) {
    return {
      ok: false,
      code: 'edge-error',
      messageDe: `Gesamtgröße der Referenzbilder überschreitet ${(LOOK_REFERENCE_AGGREGATE_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
    };
  }

  const domainInputs: LookReferenceAnalysisImageInput[] = request.references.map(
    (ref) => ({
      id: ref.id,
      kind: ref.kind,
      mime: ref.mime,
      uri: ref.uri,
      weight: ref.weight,
      label: ref.label,
    }),
  );

  const body = buildRequestBody(request);

  const edge = await invokeHostLookReferenceAnalysis(body);
  if (edge.status !== 'ok') {
    return {
      ok: false,
      code: edge.status,
      messageDe: edge.message,
    };
  }
  return normalizeLookReferenceAnalysisPayload(edge.payload, {
    references: domainInputs,
    displayNameHint: request.displayNameHint,
    analyzedAtIso: edge.analyzedAtIso,
  });
}

/** Infrastructure analyzer implementing the domain contract. */
export function createEdgeLookReferenceAnalyzer(): LookReferenceAnalyzer {
  return {
    async analyze(input) {
      return analyzeLookReferences({
        references: input.references,
        displayNameHint: input.displayNameHint,
      });
    },
  };
}
