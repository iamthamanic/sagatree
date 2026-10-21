/**
 * ai-providers domain public barrel.
 * Location: src/domains/ai-providers/index.ts
 */
export {
  formatProviderAddedAt,
  settingsAiTabToModality,
  type AiModality,
  type AiProviderAuthKind,
  type AiProviderCredentialMeta,
  type AiProviderCredentialStatus,
  type AiProviderCredentialView,
} from './contracts';
export {
  OLLAMA_CLOUD_OPENAI_BASE,
  type OllamaSettingsUpsertInput,
  type OllamaSettingsView,
} from './ollama-settings';
