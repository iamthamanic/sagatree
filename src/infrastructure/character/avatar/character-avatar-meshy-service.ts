/**
 * character-avatar-meshy-service — client facade for avatar 3D generation (Meshy adapter today).
 * Invokes Edge Function only; never embeds provider secrets.
 * Location: src/infrastructure/character/avatar/character-avatar-meshy-service.ts
 */

import { rewriteBrowserStorageUrl, supabase } from '../../../lib/supabase';
import { isHostLibraryEnabled } from '../../host/host-library-http';
import {
  MESHY_AVATAR_IMAGE_MAX_BYTES,
  MESHY_AVATAR_PROMPT_MAX_CHARS,
  MESHY_AVATAR_PROMPT_MIN_CHARS,
  assertNoCapabilityFromProviderStatus,
  mapServerStatusToUi,
  resolveMeshyAvatarJobPrompt,
  validateMeshyAvatarImageDataUri,
  type MeshyAvatarGenerationMode,
  type MeshyAvatarJobServerStatus,
  type MeshyAvatarJobSnapshot,
  type MeshyAvatarJobUiStatus,
} from '../../../domains/character/avatar/meshy-avatar-job';
import type {
  Avatar3dGenerationProviderId,
  Avatar3dGenerationSettings,
  GenerationPresetId,
} from '../../../domains/character/avatar/generation';

export interface MeshyAvatarConfig {
  meshyConfigured: boolean;
  /** False when the Edge Function invoke itself failed (network/500) — not the same as missing BYOK. */
  edgeReachable: boolean;
  promptMinChars: number;
  promptMaxChars: number;
  imageMaxBytes: number;
  supportsImageTo3d: boolean;
  costHintDe: string;
  wiredProviderIds: string[];
  defaultProviderId: string;
  defaultPresetId: string;
}

type FunctionResponse =
  | { status: 'ok' } & Record<string, unknown>
  | { status: 'not-configured'; message: string }
  | { status: 'error'; message: string; code?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Edge signs with internal Kong host — rewrite so the browser can fetch the GLB. */
function browserModelUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return rewriteBrowserStorageUrl(value.trim());
}

function parseResponse(value: unknown): FunctionResponse {
  if (!isRecord(value) || typeof value.status !== 'string') {
    return { status: 'error', message: 'Ungültige Serverantwort.' };
  }
  if (value.status === 'ok') return value as FunctionResponse;
  if (
    (value.status === 'not-configured' || value.status === 'error') &&
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

function mapJob(raw: Record<string, unknown>, modelUrl?: string): MeshyAvatarJobSnapshot {
  const serverStatus = (typeof raw.status === 'string' ? raw.status : 'failed') as MeshyAvatarJobServerStatus;
  const uiStatus: MeshyAvatarJobUiStatus = mapServerStatusToUi(serverStatus);
  return {
    jobId: typeof raw.id === 'string' ? raw.id : '',
    status: uiStatus,
    progress: typeof raw.progress === 'number' ? raw.progress : 0,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
    idempotencyKey: typeof raw.idempotency_key === 'string' ? raw.idempotency_key : '',
    errorMessage: typeof raw.error_message === 'string' ? raw.error_message : undefined,
    modelUrl,
    rigAnalysisStatus: assertNoCapabilityFromProviderStatus(serverStatus),
  };
}

async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  // FE-HOST-14: optional Meshy remains Edge-legacy; host-first returns soft unavailable
  // (config/generate callers already tolerate status=error / meshyConfigured=false).
  if (isHostLibraryEnabled()) {
    return {
      status: 'error',
      message: 'Avatar-3D-Generierung ist im Host-Modus ohne Meshy-Edge nicht verfügbar.',
    };
  }
  const { data, error } = await supabase.functions.invoke('character-avatar-meshy', { body });
  if (error) {
    return { status: 'error', message: error.message || 'Edge Function fehlgeschlagen.' };
  }
  return parseResponse(data);
}

export async function fetchMeshyAvatarConfig(): Promise<MeshyAvatarConfig> {
  const response = await invoke({ action: 'config' });
  if (response.status !== 'ok') {
    return {
      meshyConfigured: false,
      edgeReachable: false,
      promptMinChars: MESHY_AVATAR_PROMPT_MIN_CHARS,
      promptMaxChars: MESHY_AVATAR_PROMPT_MAX_CHARS,
      imageMaxBytes: MESHY_AVATAR_IMAGE_MAX_BYTES,
      supportsImageTo3d: true,
      costHintDe: 'KI-Server derzeit nicht erreichbar. Bitte Seite neu laden oder später erneut versuchen.',
      wiredProviderIds: ['meshy'],
      defaultProviderId: 'meshy',
      defaultPresetId: 'recommended',
    };
  }
  return {
    meshyConfigured: Boolean(response.meshyConfigured),
    edgeReachable: true,
    promptMinChars:
      typeof response.promptMinChars === 'number'
        ? response.promptMinChars
        : MESHY_AVATAR_PROMPT_MIN_CHARS,
    promptMaxChars:
      typeof response.promptMaxChars === 'number'
        ? response.promptMaxChars
        : MESHY_AVATAR_PROMPT_MAX_CHARS,
    imageMaxBytes:
      typeof response.imageMaxBytes === 'number'
        ? response.imageMaxBytes
        : MESHY_AVATAR_IMAGE_MAX_BYTES,
    supportsImageTo3d: response.supportsImageTo3d !== false,
    costHintDe:
      typeof response.costHintDe === 'string'
        ? response.costHintDe
        : 'Externe KI. Es entstehen Provider-Kosten.',
    wiredProviderIds: Array.isArray(response.wiredProviderIds)
      ? response.wiredProviderIds.filter((id): id is string => typeof id === 'string')
      : ['meshy'],
    defaultProviderId:
      typeof response.defaultProviderId === 'string' ? response.defaultProviderId : 'meshy',
    defaultPresetId:
      typeof response.defaultPresetId === 'string' ? response.defaultPresetId : 'recommended',
  };
}

export async function startMeshyAvatarJob(input: {
  mode: MeshyAvatarGenerationMode;
  prompt?: string;
  texturePrompt?: string;
  imageDataUri?: string;
  clientNonce: string;
  characterId?: string | null;
  providerId?: Avatar3dGenerationProviderId;
  presetId?: GenerationPresetId | 'custom';
  presetVersion?: number;
  presetDirty?: boolean;
  settings?: Avatar3dGenerationSettings;
}): Promise<MeshyAvatarJobSnapshot> {
  const mode = input.mode === 'image' ? 'image' : 'text';
  const texturePrompt = input.texturePrompt ?? '';
  const promptResolved = resolveMeshyAvatarJobPrompt({
    mode,
    prompt: input.prompt ?? '',
    texturePrompt,
  });
  if (promptResolved.ok === false) {
    throw new Error(promptResolved.message);
  }

  let imageDataUri: string | undefined;
  if (mode === 'image') {
    const imageCheck = validateMeshyAvatarImageDataUri(input.imageDataUri ?? '');
    if (!imageCheck.ok) {
      throw new Error(imageCheck.message ?? 'Bild ungültig.');
    }
    imageDataUri = imageCheck.normalized;
  }

  const response = await invoke({
    action: 'start',
    generationMode: mode,
    prompt: mode === 'text' ? promptResolved.prompt : undefined,
    texturePrompt: mode === 'image' ? texturePrompt : undefined,
    imageDataUri,
    clientNonce: input.clientNonce,
    characterId: input.characterId ?? null,
    providerId: input.providerId ?? 'meshy',
    presetId: input.presetId ?? 'recommended',
    presetVersion: input.presetVersion ?? 1,
    presetDirty: input.presetDirty === true,
    settings: input.settings,
  });
  if (response.status === 'not-configured') {
    return {
      jobId: '',
      status: 'provider-unavailable',
      progress: 0,
      prompt: promptResolved.prompt,
      idempotencyKey: '',
      errorMessage: response.message,
      rigAnalysisStatus: 'pending',
    };
  }
  if (response.status !== 'ok' || !isRecord(response.job)) {
    throw new Error(response.status === 'error' ? response.message : 'Start fehlgeschlagen.');
  }
  return mapJob(response.job as Record<string, unknown>);
}

export async function pollMeshyAvatarJob(jobId: string): Promise<MeshyAvatarJobSnapshot> {
  const response = await invoke({ action: 'poll', jobId });
  if (response.status !== 'ok' || !isRecord(response.job)) {
    throw new Error(response.status === 'error' ? response.message : 'Poll fehlgeschlagen.');
  }
  const modelUrl = browserModelUrl(response.modelUrl);
  return mapJob(response.job as Record<string, unknown>, modelUrl);
}

export async function retryMeshyAvatarJob(jobId: string): Promise<MeshyAvatarJobSnapshot> {
  const response = await invoke({ action: 'retry', jobId });
  if (response.status === 'not-configured') {
    return {
      jobId,
      status: 'provider-unavailable',
      progress: 0,
      prompt: '',
      idempotencyKey: '',
      errorMessage: response.message,
      rigAnalysisStatus: 'pending',
    };
  }
  if (response.status !== 'ok' || !isRecord(response.job)) {
    throw new Error(response.status === 'error' ? response.message : 'Retry fehlgeschlagen.');
  }
  const modelUrl = browserModelUrl(response.modelUrl);
  return mapJob(response.job as Record<string, unknown>, modelUrl);
}
