import type { CharacterLorePrompt } from './character-lore-prompt.ts';

export type CharacterLoreProviderName = 'openai-compatible' | 'ollama';

export interface CharacterLoreProviderConfig {
  provider: CharacterLoreProviderName;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function resolveCharacterLoreProviderConfig(): CharacterLoreProviderConfig | null {
  const providerValue = (Deno.env.get('CHARACTER_AI_PROVIDER') || 'ollama').trim();
  if (providerValue !== 'openai-compatible' && providerValue !== 'ollama') return null;

  const model = (Deno.env.get('CHARACTER_AI_MODEL') || Deno.env.get('OLLAMA_MODEL') || '').trim();
  if (!model) return null;

  if (providerValue === 'openai-compatible') {
    const baseUrl = (Deno.env.get('CHARACTER_AI_BASE_URL') || '').trim();
    const apiKey = (Deno.env.get('CHARACTER_AI_API_KEY') || '').trim();
    if (!baseUrl || !apiKey) return null;
    return {
      provider: providerValue,
      baseUrl: trimTrailingSlash(baseUrl),
      model,
      apiKey,
    };
  }

  const baseUrl = (
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractOpenAiContent(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.choices) || value.choices.length === 0) return null;
  const choice = value.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== 'string') return null;
  return choice.message.content.trim() || null;
}

function extractOllamaContent(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.message) || typeof value.message.content !== 'string') return null;
  return value.message.content.trim() || null;
}

async function generateOpenAiCompatible(
  config: CharacterLoreProviderConfig,
  prompt: CharacterLorePrompt,
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.85,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible provider returned ${response.status}`);
  }

  const body: unknown = await response.json();
  const story = extractOpenAiContent(body);
  if (!story) throw new Error('OpenAI-compatible provider returned an invalid response');
  return story;
}

async function generateOllama(
  config: CharacterLoreProviderConfig,
  prompt: CharacterLorePrompt,
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      stream: false,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      options: { temperature: 0.85 },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(`Ollama provider returned ${response.status}`);
  }

  const body: unknown = await response.json();
  const story = extractOllamaContent(body);
  if (!story) throw new Error('Ollama provider returned an invalid response');
  return story;
}

export async function generateCharacterLore(
  config: CharacterLoreProviderConfig,
  prompt: CharacterLorePrompt,
): Promise<string> {
  return config.provider === 'openai-compatible'
    ? generateOpenAiCompatible(config, prompt)
    : generateOllama(config, prompt);
}
