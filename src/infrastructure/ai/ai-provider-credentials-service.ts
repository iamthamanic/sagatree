/**
 * ai-provider-credentials-service — client facade for Settings BYOK providers.
 * Prefers host HTTP when configured; otherwise Edge. Never persists secrets in the browser.
 * Location: src/infrastructure/ai/ai-provider-credentials-service.ts
 */
import type {
  AiModality,
  AiProviderAuthKind,
  AiProviderCredentialStatus,
  AiProviderCredentialView,
} from '../../domains/ai-providers';
import { createAiInvoke, type AiInvokeFn } from './host-ai-invoke';

type FunctionResponse =
  | { status: 'ok' } & Record<string, unknown>
  | { status: 'error'; message: string; code?: string }
  | { status: 'not-configured'; message: string };

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

function parseModality(value: unknown): AiModality | null {
  if (value === 'image' || value === '3d' || value === 'video' || value === 'audio') return value;
  return null;
}

function parseAuth(_value: unknown): AiProviderAuthKind {
  return 'api_key';
}

function parseStatus(value: unknown): AiProviderCredentialStatus | null {
  if (value === 'active' || value === 'invalid' || value === 'revoked') return value;
  return null;
}

function parseProviderView(value: unknown): AiProviderCredentialView | null {
  if (!isRecord(value) || typeof value.providerId !== 'string') return null;
  const modalities = Array.isArray(value.modalities)
    ? value.modalities.filter((m): m is AiModality => parseModality(m) !== null)
    : [];
  const meta = isRecord(value.meta) ? value.meta : {};
  const credits =
    typeof meta.credits === 'number' && Number.isFinite(meta.credits)
      ? Math.max(0, Math.round(meta.credits))
      : undefined;

  return {
    providerId: value.providerId,
    displayName: typeof value.displayName === 'string' ? value.displayName : value.providerId,
    modalities,
    auth: parseAuth(value.auth),
    docsUrl: typeof value.docsUrl === 'string' ? value.docsUrl : null,
    configured: value.configured === true,
    keyHint: typeof value.keyHint === 'string' ? value.keyHint : null,
    status: parseStatus(value.status),
    addedAt: typeof value.addedAt === 'string' ? value.addedAt : null,
    lastValidatedAt: typeof value.lastValidatedAt === 'string' ? value.lastValidatedAt : null,
    meta: credits === undefined ? {} : { credits },
  };
}

export class AiProviderCredentialsService {
  private readonly invokeFn: AiInvokeFn;

  constructor(invokeFn: AiInvokeFn = createAiInvoke()) {
    this.invokeFn = invokeFn;
  }

  private async invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
    return parseResponse(await this.invokeFn('provider-credentials', body));
  }

  async list(modality?: AiModality): Promise<AiProviderCredentialView[]> {
    const response = await this.invoke({
      action: 'list',
      ...(modality ? { modality } : {}),
    });
    if (response.status !== 'ok') throw new Error(response.message);
    const providers = Array.isArray(response.providers) ? response.providers : [];
    return providers
      .map((row) => parseProviderView(row))
      .filter((row): row is AiProviderCredentialView => row !== null);
  }

  async upsert(providerId: string, apiKey: string): Promise<AiProviderCredentialView> {
    const response = await this.invoke({
      action: 'upsert',
      providerId,
      apiKey,
    });
    if (response.status !== 'ok') throw new Error(response.message);
    const provider = parseProviderView(response.provider);
    if (!provider) throw new Error('Speicher-Antwort unvollständig.');
    return provider;
  }

  async refresh(providerId: string): Promise<AiProviderCredentialView> {
    const response = await this.invoke({ action: 'refresh', providerId });
    if (response.status !== 'ok') throw new Error(response.message);
    const provider = parseProviderView(response.provider);
    if (!provider) throw new Error('Aktualisierungs-Antwort unvollständig.');
    return provider;
  }

  async delete(providerId: string): Promise<void> {
    const response = await this.invoke({ action: 'delete', providerId });
    if (response.status !== 'ok') throw new Error(response.message);
  }
}

export const aiProviderCredentialsService = new AiProviderCredentialsService();
