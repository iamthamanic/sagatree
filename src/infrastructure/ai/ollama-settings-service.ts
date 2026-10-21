/**
 * ollama-settings-service — client facade for Organize (Ollama LLM) prefs.
 * Invokes Edge only; never persists secrets in the browser.
 * Location: src/infrastructure/ai/ollama-settings-service.ts
 */
import { supabase } from '../../lib/supabase';
import type {
  OllamaSettingsUpsertInput,
  OllamaSettingsView,
} from '../../domains/ai-providers/ollama-settings';
import { OLLAMA_CLOUD_OPENAI_BASE } from '../../domains/ai-providers/ollama-settings';

type FunctionResponse =
  | { status: 'ok' } & Record<string, unknown>
  | { status: 'error'; message: string; code?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseResponse(value: unknown): FunctionResponse {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return { status: 'error', message: 'Ungültige Serverantwort.' };
  }
  if (value.status === 'ok') return value as FunctionResponse;
  if (value.status === 'error' && typeof value.message === 'string') {
    return {
      status: 'error',
      message: value.message,
      code: typeof value.code === 'string' ? value.code : undefined,
    };
  }
  return { status: 'error', message: 'Ungültige Serverantwort.' };
}

function hasResponseContext(error: unknown): error is { context: Response } {
  return isRecord(error) && error.context instanceof Response;
}

async function getFunctionErrorMessage(error: unknown): Promise<string | undefined> {
  if (!hasResponseContext(error)) return undefined;
  try {
    const body: unknown = await error.context.clone().json();
    const parsed = parseResponse(body);
    return parsed.status === 'ok' ? undefined : parsed.message;
  } catch {
    return undefined;
  }
}

async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  const { data, error } = await supabase.functions.invoke('ollama-settings', { body });
  if (error) {
    const serverMessage = await getFunctionErrorMessage(error);
    throw new Error(serverMessage ?? 'Ollama-Einstellungen nicht erreichbar.');
  }
  return parseResponse(data);
}

function parseSettings(value: unknown): OllamaSettingsView | null {
  if (!isRecord(value)) return null;
  if (typeof value.baseUrl !== 'string') return null;
  return {
    useCloud: value.useCloud === true,
    baseUrl: value.baseUrl,
    model: typeof value.model === 'string' ? value.model : '',
    hasApiKey: value.hasApiKey === true,
    keyHint: typeof value.keyHint === 'string' ? value.keyHint : null,
    status: typeof value.status === 'string' ? value.status : null,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    source: value.source === 'user' ? 'user' : 'env',
    cloudDefaultUrl:
      typeof value.cloudDefaultUrl === 'string'
        ? value.cloudDefaultUrl
        : OLLAMA_CLOUD_OPENAI_BASE,
    localDefaultUrl:
      typeof value.localDefaultUrl === 'string'
        ? value.localDefaultUrl
        : 'http://ollama:11434',
  };
}

function parseModels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((m): m is string => typeof m === 'string' && m.trim().length > 0);
}

class OllamaSettingsService {
  async get(): Promise<OllamaSettingsView> {
    const response = await invoke({ action: 'get' });
    if (response.status !== 'ok') throw new Error(response.message);
    const settings = parseSettings(response.settings);
    if (!settings) throw new Error('Einstellungen unvollständig.');
    return settings;
  }

  async upsert(input: OllamaSettingsUpsertInput): Promise<{
    settings: OllamaSettingsView;
    models: string[];
  }> {
    const response = await invoke({
      action: 'upsert',
      useCloud: input.useCloud,
      baseUrl: input.baseUrl,
      model: input.model,
      ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
    });
    if (response.status !== 'ok') throw new Error(response.message);
    const settings = parseSettings(response.settings);
    if (!settings) throw new Error('Speicher-Antwort unvollständig.');
    return { settings, models: parseModels(response.models) };
  }

  async test(input: {
    useCloud: boolean;
    baseUrl: string;
    model?: string;
    apiKey?: string;
  }): Promise<{ message: string; models: string[] }> {
    const response = await invoke({
      action: 'test',
      useCloud: input.useCloud,
      baseUrl: input.baseUrl,
      ...(input.model ? { model: input.model } : {}),
      ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
    });
    if (response.status !== 'ok') throw new Error(response.message);
    return {
      message:
        typeof response.message === 'string'
          ? response.message
          : 'Verbindung OK.',
      models: parseModels(response.models),
    };
  }

  async listModels(input: {
    useCloud: boolean;
    baseUrl: string;
    apiKey?: string;
  }): Promise<string[]> {
    const response = await invoke({
      action: 'listModels',
      useCloud: input.useCloud,
      baseUrl: input.baseUrl,
      ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
    });
    if (response.status !== 'ok') throw new Error(response.message);
    return parseModels(response.models);
  }

  async clear(): Promise<OllamaSettingsView> {
    const response = await invoke({ action: 'clear' });
    if (response.status !== 'ok') throw new Error(response.message);
    const settings = parseSettings(response.settings);
    if (!settings) throw new Error('Reset-Antwort unvollständig.');
    return settings;
  }
}

export const ollamaSettingsService = new OllamaSettingsService();
