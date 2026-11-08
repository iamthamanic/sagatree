/**
 * Resolve Meshy API key: user credential first, host only when explicitly allowed.
 * Location: supabase/functions/_shared/ai-provider-resolve-meshy.ts
 */
import {
  decryptProviderSecret,
  parseCredentialsEncryptionKey,
} from './ai-provider-crypto.ts';

export interface SupabaseServiceConfig {
  url: string;
  serviceRoleKey: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function hostAiProviderKeysAllowed(
  env: { get(key: string): string | undefined } = Deno.env,
): boolean {
  return env.get('AI_PROVIDER_ALLOW_HOST_KEYS') === '1';
}

export function resolveHostMeshyApiKey(
  env: { get(key: string): string | undefined } = Deno.env,
): string | null {
  if (!hostAiProviderKeysAllowed(env)) return null;
  const apiKey = env.get('MESHY_API_KEY')?.trim() ?? '';
  return apiKey || null;
}

async function loadEncryptedMeshySecret(
  config: SupabaseServiceConfig,
  userId: string,
): Promise<string | null> {
  const response = await fetch(
    `${config.url}/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.meshy&status=eq.active&select=secret_ciphertext&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) return null;
  const body: unknown = await response.json();
  if (!Array.isArray(body) || body.length === 0) return null;
  const row = body[0];
  if (!isRecord(row) || typeof row.secret_ciphertext !== 'string') return null;
  return row.secret_ciphertext;
}

/** Returns plaintext Meshy key for generate, or null (fail-closed). */
export async function resolveMeshyApiKeyForUser(
  userId: string,
  config: SupabaseServiceConfig,
  env: { get(key: string): string | undefined } = Deno.env,
): Promise<string | null> {
  const encKey = parseCredentialsEncryptionKey(env.get('CREDENTIALS_ENCRYPTION_KEY'));
  if (encKey) {
    try {
      const ciphertext = await loadEncryptedMeshySecret(config, userId);
      if (ciphertext) {
        const plaintext = await decryptProviderSecret(ciphertext, encKey);
        if (plaintext.trim()) return plaintext.trim();
      }
    } catch (error) {
      console.error(
        'meshy user credential decrypt failed',
        error instanceof Error ? error.message : 'unknown',
      );
    }
  }

  return resolveHostMeshyApiKey(env);
}

/** Config flag for UI — user active meshy OR allowed host key OR mock. */
export async function isMeshyConfiguredForUser(
  userId: string,
  config: SupabaseServiceConfig,
  env: { get(key: string): string | undefined } = Deno.env,
): Promise<boolean> {
  if (env.get('ITEM_THUMBNAIL_MESHY_MOCK') === '1' || env.get('ITEM_MODEL3D_MESHY_MOCK') === '1') {
    return true;
  }

  const response = await fetch(
    `${config.url}/rest/v1/user_ai_provider_credentials?user_id=eq.${encodeURIComponent(userId)}&provider_id=eq.meshy&status=eq.active&select=id&limit=1`,
    {
      headers: {
        Authorization: `Bearer ${config.serviceRoleKey}`,
        apikey: config.serviceRoleKey,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (response.ok) {
    const body: unknown = await response.json();
    if (Array.isArray(body) && body.length > 0) return true;
  }

  return resolveHostMeshyApiKey(env) !== null;
}
