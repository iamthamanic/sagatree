/**
 * ollama-settings-service — client facade for Organize (Ollama LLM) prefs.
 * Prefers host HTTP when configured; otherwise Edge. Never persists secrets in the browser.
 * Location: src/infrastructure/ai/ollama-settings-service.ts
 */
import type {
  OllamaSettingsUpsertInput,
  OllamaSettingsView,
} from '../../domains/ai-providers/ollama-settings';
import { OLLAMA_CLOUD_OPENAI_BASE } from '../../domains/ai-providers/ollama-settings';
import { createAiInvoke, type AiInvokeFn } from './host-ai-invoke';

type FunctionResponse =
  | { status: 'ok' } & Record<string, unknown>
  | { status: 'error'; message: string; code?: string }
  | { status: 'not-configured'; message: string; code?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseResponse(value: unknown): FunctionResponse {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return { status: 'error', message: 'Ungültige Serverantwort.' };
  }
  if (value.status === 'ok') return value as FunctionResponse;
  if (
    (value.status === 'error' || value.status === 'not-configured') &&
    typeof value.message === 'string'
  ) {
    return {
      status: value.status,
      message: value.message,
      code: typeof value.code === 'string' ? value.code : undefined,
    };
  }
  return { status: 'error', message: 'Ungültige Serverantwort.' };
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

export class OllamaSettingsService {
  private readonly invokeFn: AiInvokeFn;

  constructor(invokeFn: AiInvokeFn = createAiInvoke()) {
    this.invokeFn = invokeFn;
  }

  private async invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
    return parseResponse(await this.invokeFn('ollama-settings', body));
  }

  async get(): Promise<OllamaSettingsView> {
    const response = await this.invoke({ action: 'get' });
    if (response.status !== 'ok') throw new Error(response.message);
    const settings = parseSettings(response.settings);
    if (!settings) throw new Error('Einstellungen unvollständig.');
    return settings;
  }

  async upsert(input: OllamaSettingsUpsertInput): Promise<{
    settings: OllamaSettingsView;
    models: string[];
  }> {
    const response = await this.invoke({
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
    const response = await this.invoke({
      action: 'test',
      useCloud: input.useCloud,
      baseUrl: input.baseUrl,
      ...(input.model ? { model: input.model } : {}),
      ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
    });
    if (response.status !== 'ok') throw new Error(response.message);
    return {
      message: typeof response.message === 'string' ? response.message : 'Verbindung OK.',
      models: parseModels(response.models),
    };
  }

  async listModels(input: {
    useCloud: boolean;
    baseUrl: string;
    apiKey?: string;
  }): Promise<string[]> {
    const response = await this.invoke({
      action: 'listModels',
      useCloud: input.useCloud,
      baseUrl: input.baseUrl,
      ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
    });
    if (response.status !== 'ok') throw new Error(response.message);
    return parseModels(response.models);
  }

  async clear(): Promise<OllamaSettingsView> {
    const response = await this.invoke({ action: 'clear' });
    if (response.status !== 'ok') throw new Error(response.message);
    const settings = parseSettings(response.settings);
    if (!settings) throw new Error('Reset-Antwort unvollständig.');
    return settings;
  }
}

export const ollamaSettingsService = new OllamaSettingsService();
