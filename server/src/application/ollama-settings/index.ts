/**
 * ollama-settings use-cases (MIG-402 / #818).
 * Location: server/src/application/ollama-settings/index.ts
 */
import type { Actor } from '../../modules/identity/index.ts';
import type { AiPorts } from '../../modules/ai/index.ts';

export function createOllamaSettingsUseCases(ai: AiPorts) {
  return {
    get: (actor: Actor) => ai.getOllamaSettings(actor),
    upsert: (
      actor: Actor,
      input: { useCloud: boolean; baseUrl: string; model: string; apiKey?: string },
    ) => ai.upsertOllamaSettings(actor, input),
    test: (
      actor: Actor,
      input?: { useCloud?: boolean; baseUrl?: string; model?: string; apiKey?: string },
    ) => ai.testOllamaSettings(actor, input),
    listModels: (
      actor: Actor,
      input?: { useCloud?: boolean; baseUrl?: string; apiKey?: string },
    ) => ai.listOllamaModels(actor, input),
    clear: (actor: Actor) => ai.clearOllamaSettings(actor),
  };
}
