/**
 * Ollama Organize settings view contracts (client-safe, no secrets).
 * Location: src/domains/ai-providers/ollama-settings.ts
 */

export const OLLAMA_CLOUD_OPENAI_BASE = 'https://ollama.com/v1';

export interface OllamaSettingsView {
  useCloud: boolean;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  keyHint: string | null;
  status: string | null;
  updatedAt: string | null;
  source: 'user' | 'env';
  cloudDefaultUrl: string;
  localDefaultUrl: string;
}

export interface OllamaSettingsUpsertInput {
  useCloud: boolean;
  baseUrl: string;
  model: string;
  apiKey?: string;
}
