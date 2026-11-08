/**
 * AI provider registry — catalog of BYOK providers and modalities.
 * Location: supabase/functions/_shared/ai-provider-registry.ts
 */

export type AiModality = 'image' | '3d' | 'video' | 'audio';

export type AiProviderAuthKind = 'api_key';

export interface AiProviderDefinition {
  id: string;
  displayName: string;
  modalities: readonly AiModality[];
  auth: AiProviderAuthKind;
  docsUrl?: string;
}

/** Add new providers here — one entry + validate adapter. */
export const AI_PROVIDER_CATALOG: readonly AiProviderDefinition[] = [
  {
    id: 'meshy',
    displayName: 'Meshy',
    modalities: ['image', '3d'],
    auth: 'api_key',
    docsUrl: 'https://docs.meshy.ai/en/api/authentication',
  },
] as const;

export function listProvidersForModality(modality: AiModality): AiProviderDefinition[] {
  return AI_PROVIDER_CATALOG.filter((p) => p.modalities.includes(modality));
}

export function getProviderDefinition(providerId: string): AiProviderDefinition | null {
  return AI_PROVIDER_CATALOG.find((p) => p.id === providerId) ?? null;
}

export function isAiModality(value: string): value is AiModality {
  return value === 'image' || value === '3d' || value === 'video' || value === 'audio';
}
