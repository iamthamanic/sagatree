/**
 * Meshy BYOK validate + balance adapter.
 * Location: supabase/functions/_shared/ai-provider-meshy.ts
 */

export type MeshyValidateResult =
  | {
      ok: true;
      credits: number;
    }
  | {
      ok: false;
      code: 'invalid' | 'network' | 'unknown';
      message: string;
    };

type FetchLike = typeof fetch;

const DEFAULT_BASE = 'https://api.meshy.ai/openapi/v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function looksLikeMeshyApiKey(apiKey: string): boolean {
  const trimmed = apiKey.trim();
  return trimmed.startsWith('msy_') && trimmed.length >= 20 && trimmed.length <= 200;
}

export async function validateMeshyApiKey(
  apiKey: string,
  options?: {
    baseUrl?: string;
    fetchImpl?: FetchLike;
  },
): Promise<MeshyValidateResult> {
  const trimmed = apiKey.trim();
  if (!looksLikeMeshyApiKey(trimmed)) {
    return {
      ok: false,
      code: 'invalid',
      message: 'Ungültiges Meshy-API-Key-Format (erwartet msy_…).',
    };
  }

  const baseUrl = (options?.baseUrl?.trim() || DEFAULT_BASE).replace(/\/+$/, '');
  const fetchImpl = options?.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(`${baseUrl}/balance`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        code: 'invalid',
        message: 'Meshy-API-Key wurde abgelehnt.',
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        code: 'network',
        message: `Meshy-Balance-Check fehlgeschlagen (${response.status}).`,
      };
    }

    const body: unknown = await response.json();
    if (!isRecord(body) || typeof body.balance !== 'number' || !Number.isFinite(body.balance)) {
      return {
        ok: false,
        code: 'unknown',
        message: 'Meshy-Balance-Antwort ungültig.',
      };
    }

    return { ok: true, credits: Math.max(0, Math.round(body.balance)) };
  } catch {
    return {
      ok: false,
      code: 'network',
      message: 'Meshy konnte nicht erreicht werden.',
    };
  }
}
