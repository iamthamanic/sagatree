/**
 * item-thumbnail-service — client facade for Workbench thumbnail upload/generate (#140/#643 / CUT-16).
 * Location: src/infrastructure/inventory/item-thumbnail-service.ts
 *
 * CUT-16: host-first via POST `/api/v1/items/thumbnail` when host library is on.
 * Legacy Edge `item-thumbnail` remains until dual-path removal (CUT-20).
 */
import { getHostAuthBaseUrl } from '../../lib/hostAuthBridge';
import { rewriteBrowserStorageUrl, supabase } from '../../lib/supabase';
import {
  ITEM_THUMBNAIL_ALLOWED_MIME,
  ITEM_THUMBNAIL_MAX_BYTES,
  isAllowedItemThumbnailMime,
  parseItemThumbnailAssetKey,
  type ItemThumbnailMime,
} from '../../domains/items';
import { isHostLibraryEnabled } from '../host/host-library-http';

export type PrepareItemThumbnailOptions = {
  readonly alreadyOptimized?: boolean;
  readonly signal?: AbortSignal;
};

/**
 * Optimize via item-thumbnail profile before Edge upload.
 * Never returns the original after a required optimize failure.
 */
export async function prepareItemThumbnailFile(
  file: File,
  signal?: AbortSignal,
): Promise<File> {
  const mime = validateThumbnailFileClient(file);
  const { optimizeMedia } = await import('../media/optimizer');
  let optimizedBytes: Uint8Array | undefined;
  const result = await optimizeMedia({
    kind: 'image',
    profileId: 'item-thumbnail',
    mimeType: mime,
    byteSize: file.size,
    bytes: file,
    signal,
    onOptimizedBytes: (bytes) => {
      optimizedBytes = bytes;
    },
  });

  if (result.status === 'unchanged') {
    return file;
  }

  if (result.status === 'optimized') {
    if (!optimizedBytes || optimizedBytes.byteLength === 0) {
      throw new Error('Thumbnail-Optimierung lieferte keine Bytes (kein stilles Original).');
    }
    if (!isAllowedItemThumbnailMime(result.outputMimeType)) {
      throw new Error(`Optimiertes MIME ${result.outputMimeType} ist nicht erlaubt.`);
    }
    const copy = new Uint8Array(optimizedBytes.byteLength);
    copy.set(optimizedBytes);
    const base = file.name.replace(/\.[^.]+$/, '') || 'thumbnail';
    const ext =
      result.outputMimeType === 'image/webp'
        ? 'webp'
        : result.outputMimeType === 'image/png'
          ? 'png'
          : 'jpg';
    return new File([copy], `${base}.${ext}`, { type: result.outputMimeType });
  }

  if (result.status === 'aborted') {
    throw new Error(result.message || 'Thumbnail-Optimierung abgebrochen.');
  }

  const message =
    'message' in result && typeof result.message === 'string'
      ? result.message
      : 'Thumbnail-Optimierung fehlgeschlagen.';
  throw new Error(message);
}

export type ItemThumbnailJobUiStatus =
  | 'idle'
  | 'waiting'
  | 'generating'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export interface ItemThumbnailConfig {
  meshyConfigured: boolean;
  maxBytes: number;
  allowedMime: readonly string[];
}

export interface ItemThumbnailUploadResult {
  assetKey: string;
  signedUrl: string;
  mime: ItemThumbnailMime;
  byteSize: number;
}

export interface ItemThumbnailJobSnapshot {
  jobId: string;
  jobStatus: ItemThumbnailJobUiStatus;
  progress: number;
  errorMessage?: string;
  assetKey?: string;
  signedUrl?: string;
}

type FunctionResponse =
  | { status: 'ok' } & Record<string, unknown>
  | { status: 'not-configured'; message: string }
  | { status: 'error'; message: string; code?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
    return { status: value.status, message: value.message, code: typeof value.code === 'string' ? value.code : undefined };
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

async function invokeHost(body: Record<string, unknown>): Promise<FunctionResponse> {
  const base = getHostAuthBaseUrl();
  if (base === null) {
    return { status: 'error', message: 'Thumbnail-Dienst nicht erreichbar.' };
  }
  const requestUrl =
    base === '' ? '/api/v1/items/thumbnail' : `${base}/api/v1/items/thumbnail`;
  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 'error', message: 'Thumbnail-Dienst nicht erreichbar.' };
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { status: 'error', message: 'Thumbnail-Dienst nicht erreichbar.' };
  }
  return parseResponse(data);
}

async function invoke(body: Record<string, unknown>): Promise<FunctionResponse> {
  if (isHostLibraryEnabled()) {
    return invokeHost(body);
  }
  const { data, error } = await supabase.functions.invoke('item-thumbnail', { body });
  if (error) {
    const serverMessage = await getFunctionErrorMessage(error);
    throw new Error(serverMessage ?? 'Thumbnail-Dienst nicht erreichbar.');
  }
  return parseResponse(data);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Datei konnte nicht gelesen werden.'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function validateThumbnailFileClient(file: File): ItemThumbnailMime {
  if (!isAllowedItemThumbnailMime(file.type)) {
    throw new Error('Nur PNG, JPEG oder WebP sind erlaubt.');
  }
  if (file.size > ITEM_THUMBNAIL_MAX_BYTES) {
    throw new Error('Datei zu groß (max. 10 MB).');
  }
  return file.type;
}

class ItemThumbnailService {
  async getConfig(): Promise<ItemThumbnailConfig> {
    try {
      const response = await invoke({ action: 'config' });
      if (response.status !== 'ok') {
        return {
          meshyConfigured: false,
          maxBytes: ITEM_THUMBNAIL_MAX_BYTES,
          allowedMime: ITEM_THUMBNAIL_ALLOWED_MIME,
        };
      }
      return {
        meshyConfigured: response.meshyConfigured === true,
        maxBytes: typeof response.maxBytes === 'number' ? response.maxBytes : ITEM_THUMBNAIL_MAX_BYTES,
        allowedMime: Array.isArray(response.allowedMime)
          ? response.allowedMime.filter((m): m is string => typeof m === 'string')
          : [...ITEM_THUMBNAIL_ALLOWED_MIME],
      };
    } catch {
      return {
        meshyConfigured: false,
        maxBytes: ITEM_THUMBNAIL_MAX_BYTES,
        allowedMime: ITEM_THUMBNAIL_ALLOWED_MIME,
      };
    }
  }

  async uploadThumbnail(
    definitionId: string,
    file: File,
    options?: PrepareItemThumbnailOptions,
  ): Promise<ItemThumbnailUploadResult> {
    const prepared = options?.alreadyOptimized
      ? file
      : await prepareItemThumbnailFile(file, options?.signal);
    const mime = validateThumbnailFileClient(prepared);
    const contentBase64 = await fileToBase64(prepared);
    const response = await invoke({
      action: 'upload',
      definitionId,
      contentBase64,
      mime,
    });
    if (response.status !== 'ok') throw new Error(response.message);
    if (
      typeof response.assetKey !== 'string' ||
      typeof response.signedUrl !== 'string' ||
      typeof response.mime !== 'string' ||
      typeof response.byteSize !== 'number'
    ) {
      throw new Error('Upload-Antwort unvollständig.');
    }
    if (!isAllowedItemThumbnailMime(response.mime)) {
      throw new Error('Upload-Antwort: ungültiger MIME-Typ.');
    }
    return {
      assetKey: response.assetKey,
      signedUrl: rewriteBrowserStorageUrl(response.signedUrl),
      mime: response.mime,
      byteSize: response.byteSize,
    };
  }

  async startGenerate(definitionId: string, userExtra?: string): Promise<ItemThumbnailJobSnapshot> {
    const response = await invoke({
      action: 'generate',
      definitionId,
      userExtra: userExtra?.trim() || undefined,
    });
    if (response.status === 'not-configured') {
      throw new Error(response.message);
    }
    if (response.status !== 'ok') throw new Error(response.message);
    if (typeof response.jobId !== 'string') throw new Error('Job-ID fehlt.');
    return {
      jobId: response.jobId,
      jobStatus: typeof response.jobStatus === 'string'
        ? (response.jobStatus as ItemThumbnailJobUiStatus)
        : 'waiting',
      progress: typeof response.progress === 'number' ? response.progress : 5,
    };
  }

  async pollJob(jobId: string): Promise<ItemThumbnailJobSnapshot> {
    const response = await invoke({ action: 'status', jobId });
    if (response.status !== 'ok') throw new Error(response.message);
    if (typeof response.jobId !== 'string') throw new Error('Job-ID fehlt.');
    return {
      jobId: response.jobId,
      jobStatus: typeof response.jobStatus === 'string'
        ? (response.jobStatus as ItemThumbnailJobUiStatus)
        : 'waiting',
      progress: typeof response.progress === 'number' ? response.progress : 0,
      errorMessage: typeof response.errorMessage === 'string' ? response.errorMessage : undefined,
      assetKey: typeof response.assetKey === 'string' ? response.assetKey : undefined,
      signedUrl:
        typeof response.signedUrl === 'string'
          ? rewriteBrowserStorageUrl(response.signedUrl)
          : undefined,
    };
  }

  async loadLatestJob(definitionId: string): Promise<ItemThumbnailJobSnapshot | null> {
    const response = await invoke({ action: 'latest-job', definitionId });
    if (response.status !== 'ok') return null;
    if (!isRecord(response.job)) return null;
    const job = response.job;
    if (typeof job.jobId !== 'string') return null;
    const jobId = job.jobId;
    return {
      jobId,
      jobStatus: typeof job.jobStatus === 'string'
        ? (job.jobStatus as ItemThumbnailJobUiStatus)
        : 'idle',
      progress: typeof job.progress === 'number' ? job.progress : 0,
      errorMessage: typeof job.errorMessage === 'string' ? job.errorMessage : undefined,
      assetKey: typeof job.assetKey === 'string' ? job.assetKey : undefined,
    };
  }

  async resolveSignedUrl(assetKey: string): Promise<string | null> {
    if (!parseItemThumbnailAssetKey(assetKey)) return null;
    try {
      const response = await invoke({ action: 'resolve', assetKey });
      if (response.status !== 'ok' || typeof response.signedUrl !== 'string') return null;
      return rewriteBrowserStorageUrl(response.signedUrl);
    } catch {
      return null;
    }
  }

  async removeThumbnail(definitionId: string): Promise<void> {
    const response = await invoke({ action: 'remove', definitionId });
    if (response.status !== 'ok') throw new Error(response.message);
  }
}

export const itemThumbnailService = new ItemThumbnailService();
