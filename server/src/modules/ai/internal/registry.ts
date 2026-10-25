/**
 * AI provider catalog (MIG-402).
 * Location: server/src/modules/ai/internal/registry.ts
 */
export type AiModality = 'image' | '3d' | 'video' | 'audio';

export type AiProviderDefinition = {
  readonly id: string;
  readonly displayName: string;
  readonly modalities: readonly AiModality[];
  readonly auth: 'api_key';
  readonly docsUrl?: string;
};

export const AI_PROVIDER_CATALOG: readonly AiProviderDefinition[] = [
  {
    id: 'meshy',
    displayName: 'Meshy',
    modalities: ['image', '3d'],
    auth: 'api_key',
    docsUrl: 'https://docs.meshy.ai/en/api/authentication',
  },
] as const;

export const OLLAMA_PROVIDER_ID = 'ollama';
export const OLLAMA_CLOUD_OPENAI_BASE = 'https://ollama.com/v1';
export const OLLAMA_NONE_SECRET = '__none__';

export function listProvidersForModality(modality: AiModality): AiProviderDefinition[] {
  return AI_PROVIDER_CATALOG.filter((p) => p.modalities.includes(modality));
}

export function getProviderDefinition(providerId: string): AiProviderDefinition | null {
  return AI_PROVIDER_CATALOG.find((p) => p.id === providerId) ?? null;
}

export function isAiModality(value: string): value is AiModality {
  return value === 'image' || value === '3d' || value === 'video' || value === 'audio';
}

export function looksLikeMeshyApiKey(apiKey: string): boolean {
  const trimmed = apiKey.trim();
  return trimmed.startsWith('msy_') && trimmed.length >= 20 && trimmed.length <= 200;
}
