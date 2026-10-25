/**
 * ai-provider-credentials use-cases (MIG-402 / #818).
 * Location: server/src/application/ai-provider-credentials/index.ts
 */
import type { Actor } from '../../modules/identity/index.ts';
import type { AiPorts } from '../../modules/ai/index.ts';

export function createAiProviderCredentialsUseCases(ai: AiPorts) {
  return {
    list: (actor: Actor, modality?: string | null) => ai.listCredentials(actor, modality),
    upsert: (actor: Actor, providerId: string, apiKey: string) =>
      ai.upsertCredential(actor, providerId, apiKey),
    refresh: (actor: Actor, providerId: string) => ai.refreshCredential(actor, providerId),
    delete: (actor: Actor, providerId: string) => ai.deleteCredential(actor, providerId),
  };
}
