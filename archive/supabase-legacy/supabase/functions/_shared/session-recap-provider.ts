/**
 * session-recap-provider — Reuse character-lore provider env with SESSION_RECAP_* override (#573).
 * Location: supabase/functions/_shared/session-recap-provider.ts
 */
import type { SessionRecapPrompt } from './session-recap-prompt.ts';
import {
  generateCharacterLore,
  resolveCharacterLoreProviderConfig,
  type CharacterLoreProviderConfig,
} from './character-lore-provider.ts';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

/** Prefer SESSION_RECAP_AI_*; fall back to CHARACTER_AI_* / Ollama. */
export function resolveSessionRecapProviderConfig(): CharacterLoreProviderConfig | null {
  const providerValue = (
    Deno.env.get('SESSION_RECAP_AI_PROVIDER') ||
    Deno.env.get('CHARACTER_AI_PROVIDER') ||
    'ollama'
  ).trim();
  if (providerValue !== 'openai-compatible' && providerValue !== 'ollama') return null;

  const model = (
    Deno.env.get('SESSION_RECAP_AI_MODEL') ||
    Deno.env.get('CHARACTER_AI_MODEL') ||
    Deno.env.get('OLLAMA_MODEL') ||
    ''
  ).trim();
  if (!model) return null;

  if (providerValue === 'openai-compatible') {
    const baseUrl = (
      Deno.env.get('SESSION_RECAP_AI_BASE_URL') ||
      Deno.env.get('CHARACTER_AI_BASE_URL') ||
      ''
    ).trim();
    const apiKey = (
      Deno.env.get('SESSION_RECAP_AI_API_KEY') ||
      Deno.env.get('CHARACTER_AI_API_KEY') ||
      ''
    ).trim();
    if (!baseUrl || !apiKey) return null;
    return {
      provider: providerValue,
      baseUrl: trimTrailingSlash(baseUrl),
      model,
      apiKey,
    };
  }

  const baseUrl = (
    Deno.env.get('SESSION_RECAP_AI_BASE_URL') ||
    Deno.env.get('CHARACTER_AI_BASE_URL') ||
    Deno.env.get('OLLAMA_HOST') ||
    'http://ollama:11434'
  ).trim();

  return {
    provider: providerValue,
    baseUrl: trimTrailingSlash(baseUrl),
    model,
  };
}

export async function generateSessionRecapSummary(
  config: CharacterLoreProviderConfig,
  prompt: SessionRecapPrompt,
): Promise<string> {
  // character-lore generator accepts { system, user } — compatible shape.
  return generateCharacterLore(config, {
    version: prompt.version,
    system: prompt.system,
    user: prompt.user,
  });
}

export { resolveCharacterLoreProviderConfig };
